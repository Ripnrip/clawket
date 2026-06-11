import { useGatewayConfigForm } from '../../../hooks/useGatewayConfigForm';
import { useAppContext } from '../../../contexts/AppContext';
import { useAppTheme } from '../../../theme';
import { useGatewayRuntimeSettings } from './useGatewayRuntimeSettings';

export function useConfigScreenController() {
  const {
    gateway,
    gatewayEpoch,
    config: initialConfig,
    debugMode,
    pushNotificationsEnabled,
    showAgentAvatar,
    showModelUsage,
    onSaved,
    onReset,
    onDebugToggle,
    onPushNotificationsToggle,
    onShowAgentAvatarToggle,
    onShowModelUsageToggle,
    execApprovalEnabled,
    onExecApprovalToggle,
    canvasEnabled,
    onCanvasToggle,
    nodeEnabled,
    onNodeEnabledToggle,
    chatFontSize,
    onChatFontSizeChange,
    speechRecognitionLanguage,
    onSpeechRecognitionLanguageChange,
  } = useAppContext();
  const { theme, mode, accentId, setMode, setAccentId, systemScheme, resolvedScheme } = useAppTheme();

  const form = useGatewayConfigForm({
    gateway,
    initialConfig,
    debugMode,
    onSaved,
    onReset,
  });

  const gatewayRuntimeSettings = useGatewayRuntimeSettings({
    gateway,
    gatewayEpoch,
    hasActiveGateway: Boolean(initialConfig?.url),
  });

  return {
    gateway,
    hasActiveGateway: Boolean(initialConfig?.url),
    theme,
    mode,
    accentId,
    setMode,
    setAccentId,
    systemScheme,
    resolvedScheme,
    debugMode,
    pushNotificationsEnabled,
    showAgentAvatar,
    showModelUsage,
    onDebugToggle,
    onPushNotificationsToggle,
    onShowAgentAvatarToggle,
    onShowModelUsageToggle,
    execApprovalEnabled,
    onExecApprovalToggle,
    canvasEnabled,
    onCanvasToggle,
    nodeEnabled,
    onNodeEnabledToggle,
    chatFontSize,
    onChatFontSizeChange,
    speechRecognitionLanguage,
    onSpeechRecognitionLanguageChange,
    ...gatewayRuntimeSettings,
    ...form,
  };
}
