import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { analyticsEvents } from '../../../services/analytics/events';
import { triggerErrorHaptic, triggerSuccessHaptic } from '../../../services/haptics';
import { useAppContext } from '../../../contexts/AppContext';
import type { GatewayModelProviderInfo } from '../../../services/gateway-backend-operations';
import { ConnectionState, GatewayBackendKind, SessionInfo } from '../../../types';

export type ModelInfo = {
  id: string;
  name: string;
  provider: string;
};

type ModelSelectionState = {
  currentModel: string;
  currentProvider: string;
  currentBaseUrl?: string;
  note?: string | null;
  models: ModelInfo[];
  providers?: GatewayModelProviderInfo[];
};

type CurrentModelState = {
  currentModel: string;
  currentProvider: string;
  currentBaseUrl?: string;
  note?: string | null;
};

function resolveProviderModel(model: ModelInfo): string {
  const modelRef = model.id.trim() || model.name;
  if (modelRef.includes('/')) return modelRef;
  const provider = model.provider.trim() || 'unknown';
  return `${provider}/${modelRef}`;
}

type Props = {
  connectionState: ConnectionState;
  gateway: {
    listModels: () => Promise<ModelInfo[]>;
    listSessions?: (opts?: { limit?: number }) => Promise<SessionInfo[]>;
    getCurrentModelState?: () => Promise<CurrentModelState>;
    getModelSelectionState: () => Promise<ModelSelectionState>;
    setModelSelection: (params: {
      model: string;
      provider?: string;
      scope?: 'global' | 'session';
      sessionKey?: string | null;
    }) => Promise<ModelSelectionState>;
    getBackendKind: () => GatewayBackendKind;
  };
  sessionKey: string | null;
  setInput: (value: string) => void;
  setSessions: (updater: (prev: SessionInfo[]) => SessionInfo[]) => void;
  submitMessage: (text: string, images: []) => Promise<boolean> | boolean | void;
};

// 🎚️ The Retry Commander — Orchestrating Exponential Backoff
interface RetryState {
  attempt: number;
  lastError: string | null;
}

const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000;
const RETRY_BACKOFF_MULTIPLIER = 2;

export function useChatModelPicker({
  connectionState,
  gateway,
  sessionKey,
  setInput,
  setSessions,
  submitMessage,
}: Props) {
  const { foregroundEpoch, gatewayEpoch } = useAppContext();
  const isFocused = useIsFocused();
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const [modelPickerLoading, setModelPickerLoading] = useState(false);
  const [modelPickerError, setModelPickerError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [availableProviders, setAvailableProviders] = useState<GatewayModelProviderInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [currentModelProvider, setCurrentModelProvider] = useState<string | null>(null);

  const lastForegroundEpochRef = useRef<number | null>(null);

  // 🎒 The Last-Good Cache — Preserves sanity across transient disconnects
  const lastGoodModelsRef = useRef<ModelInfo[]>([]);
  const lastGoodProvidersRef = useRef<GatewayModelProviderInfo[]>([]);
  const retryStateRef = useRef<RetryState>({ attempt: 0, lastError: null });
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hermes and OpenClaw expose different model-selection APIs on the
  // gateway client: Hermes uses `getModelSelectionState` / `setModelSelection`
  // with global scope, while OpenClaw lists models via `listModels` and
  // reads the current model from the session list. This boolean is the
  // single source of truth for that dispatch — the callbacks below read
  // it instead of calling `gateway.getBackendKind()` inline. The backend
  // cannot change without a new `gateway` reference, which is already in
  // each callback's dep list, so callback memoization stays correct.
  const usesHermesModelApi = gateway.getBackendKind() === 'hermes';

  const hydrateHermesModelSelection = useCallback((selection: ModelSelectionState) => {
    const models = selection.models ?? [];
    const providers = selection.providers ?? [];
    setAvailableModels(models);
    setAvailableProviders(providers);
    setCurrentModel(selection.currentModel?.trim() || null);
    setCurrentModelProvider(selection.currentProvider?.trim() || null);
    // 🎒 Cache successful load directly from fresh data (no stale-closure read)
    if (models.length > 0) {
      lastGoodModelsRef.current = models;
      lastGoodProvidersRef.current = providers;
    }
  }, []);

  const hydrateOpenClawModels = useCallback((models: ModelInfo[]) => {
    setAvailableModels(models);
    setAvailableProviders([]);
    // 🎒 Cache successful load directly from fresh data
    if (models.length > 0) {
      lastGoodModelsRef.current = models;
      lastGoodProvidersRef.current = [];
    }
  }, []);

  const hydrateOpenClawCurrentModel = useCallback((sessions: SessionInfo[]) => {
    const trimmedSessionKey = sessionKey?.trim() || null;
    const selected = trimmedSessionKey
      ? sessions.find((session) => session.key === trimmedSessionKey) ?? null
      : null;
    const fallback = selected ?? sessions[0] ?? null;
    setCurrentModel(fallback?.model?.trim() || null);
    setCurrentModelProvider(fallback?.modelProvider?.trim() || null);
  }, [sessionKey]);

  /**
   * 🎚️ The Resilient Loader — Loads models with retry and last-good cache
   *
   * Retry strategy:
   * - 1st failure: immediate retry (1s delay)
   * - 2nd failure: exponential backoff (2s delay)
   * - 3rd failure: give up, show error + last-good cache
   *
   * The last-good cache ensures users can still select from previously-loaded
   * models during transient network hiccups or gateway reconnections.
   */
  const loadModelsForPicker = useCallback(async () => {
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (connectionState !== 'ready') {
      const errorMsg = 'Gateway is not connected.';
      setModelPickerError(errorMsg);
      // 🎒 Restore from last-good cache on disconnect
      if (lastGoodModelsRef.current.length > 0) {
        setAvailableModels(lastGoodModelsRef.current);
        setAvailableProviders(lastGoodProvidersRef.current);
      } else {
        setAvailableModels([]);
        setAvailableProviders([]);
      }
      setModelPickerLoading(false);
      return;
    }

    setModelPickerLoading(true);
    setModelPickerError(null);

    const attemptLoad = async (attemptNumber: number): Promise<void> => {
      try {
        if (usesHermesModelApi) {
          // 🐍 Providers arrive pre-normalized from gateway-backend-operations.ts.
          // hydrateHermesModelSelection caches fresh data into the last-good refs.
          hydrateHermesModelSelection(await gateway.getModelSelectionState());
        } else {
          hydrateOpenClawModels(await gateway.listModels());
        }

        // ✅ Success — reset retry state
        retryStateRef.current = { attempt: 0, lastError: null };
        setModelPickerError(null);
        setModelPickerLoading(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);

        if (attemptNumber < MAX_RETRY_ATTEMPTS) {
          // 🔄 Retry with exponential backoff
          const delay = BASE_RETRY_DELAY_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, attemptNumber);
          retryStateRef.current = {
            attempt: attemptNumber + 1,
            lastError: msg,
          };

          retryTimeoutRef.current = setTimeout(() => {
            attemptLoad(attemptNumber + 1);
          }, delay);

          // Update error to show retry in progress
          setModelPickerError(`Loading models... (retry ${attemptNumber + 1}/${MAX_RETRY_ATTEMPTS})`);
        } else {
          // 🛑 Max retries reached — show error + restore from cache
          setModelPickerError(msg || 'Failed to load models after multiple attempts.');
          setModelPickerLoading(false);

          // 🎒 Restore from last-good cache
          if (lastGoodModelsRef.current.length > 0) {
            setAvailableModels(lastGoodModelsRef.current);
            setAvailableProviders(lastGoodProvidersRef.current);
          } else {
            setAvailableModels([]);
            setAvailableProviders([]);
          }
        }
      }
    };

    await attemptLoad(0);
  }, [
    connectionState,
    gateway,
    usesHermesModelApi,
    hydrateHermesModelSelection,
    hydrateOpenClawModels,
  ]);

  const refreshCurrentModel = useCallback(async () => {
    if (!usesHermesModelApi) {
      if (connectionState !== 'ready' || typeof gateway.listSessions !== 'function') return;
      try {
        hydrateOpenClawCurrentModel(await gateway.listSessions({ limit: 100 }));
      } catch {
        // Keep the last visible state; model refresh should be non-disruptive in chat.
      }
      return;
    }
    if (connectionState !== 'ready') return;
    try {
      const currentState = typeof gateway.getCurrentModelState === 'function'
        ? await gateway.getCurrentModelState()
        : await gateway.getModelSelectionState();
      setCurrentModel(currentState.currentModel?.trim() || null);
      setCurrentModelProvider(currentState.currentProvider?.trim() || null);
    } catch {
      // Keep the last visible state; model refresh should be non-disruptive in chat.
    }
  }, [connectionState, gateway, usesHermesModelApi, hydrateOpenClawCurrentModel]);

  const openModelPicker = useCallback((): boolean => {
    if (connectionState !== 'ready') {
      return false;
    }
    setModelPickerVisible(true);
    void loadModelsForPicker();
    return true;
  }, [connectionState, loadModelsForPicker]);

  const retryModelPickerLoad = useCallback(() => {
    void loadModelsForPicker();
  }, [loadModelsForPicker]);

  useEffect(() => {
    void refreshCurrentModel();
  }, [gatewayEpoch, refreshCurrentModel, sessionKey]);

  useEffect(() => {
    if (!isFocused) return;
    void refreshCurrentModel();
  }, [isFocused, refreshCurrentModel]);

  useEffect(() => {
    if (!isFocused) return;
    if (lastForegroundEpochRef.current === foregroundEpoch) return;
    lastForegroundEpochRef.current = foregroundEpoch;
    void refreshCurrentModel();
  }, [foregroundEpoch, isFocused, refreshCurrentModel]);

  // 🧹 The Janitor — Sweep away pending retries when the hook unmounts,
  // preventing the dreaded "setState on unmounted component" specter.
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  const onSelectModel = useCallback((selected: ModelInfo) => {
    const providerModel = resolveProviderModel(selected);
    if (!providerModel.trim()) return;
    const modelId = selected.id.trim() || selected.name.trim();
    const providerId = selected.provider.trim() || undefined;

    analyticsEvents.chatModelSelected({
      provider_model: providerModel,
      model_id: modelId,
      model_name: selected.name || selected.id,
      provider: providerId || 'unknown',
      source: 'chat_model_picker',
      session_key_present: Boolean(sessionKey),
    });

    if (usesHermesModelApi) {
      setCurrentModel(modelId || null);
      setCurrentModelProvider(providerId ?? null);
      setModelPickerVisible(false);
      if (connectionState !== 'ready') {
        return;
      }
      void gateway.setModelSelection({
        model: modelId,
        ...(providerId ? { provider: providerId } : {}),
        scope: 'global',
      }).then((selection) => {
        hydrateHermesModelSelection(selection);
        // 🎉 A triumphant purr — the model has answered the summons
        triggerSuccessHaptic();
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setModelPickerError(msg || 'Failed to switch model.');
        // 🌩️ A firm rumble — the switch hit a temporary intermission
        triggerErrorHaptic();
        void refreshCurrentModel();
      });
      return;
    }

    // Optimistically update current session's model label so ChatHeader updates immediately
    const slashIdx = providerModel.indexOf('/');
    const model = slashIdx >= 0 ? providerModel.slice(slashIdx + 1) : providerModel;
    const provider = slashIdx >= 0 ? providerModel.slice(0, slashIdx) : undefined;
    setCurrentModel(model || null);
    setCurrentModelProvider(provider ?? null);
    setSessions((prev) =>
      prev.map((session) =>
        session.key === sessionKey
          ? { ...session, model, modelProvider: provider }
          : session,
      ),
    );

    if (connectionState !== 'ready' || !sessionKey) {
      setModelPickerVisible(false);
      setInput(`/model ${providerModel}`);
      return;
    }

    setModelPickerVisible(false);
    void Promise.resolve(submitMessage(`/model ${providerModel}`, [])).then((sent) => {
      if (sent === false) {
        setInput(`/model ${providerModel}`);
      }
    });
  }, [
    connectionState,
    gateway,
    usesHermesModelApi,
    hydrateHermesModelSelection,
    refreshCurrentModel,
    sessionKey,
    setInput,
    setSessions,
    submitMessage,
  ]);

  const currentModelHeaderLabel = currentModel
    ? (currentModelProvider ? `${currentModelProvider}/${currentModel}` : currentModel)
    : null;

  return {
    availableModels,
    availableProviders,
    currentModel,
    currentModelHeaderLabel,
    currentModelProvider,
    modelPickerError,
    modelPickerLoading,
    modelPickerVisible,
    onSelectModel,
    openModelPicker,
    refreshCurrentModel,
    retryModelPickerLoad,
    setModelPickerVisible,
  };
}
