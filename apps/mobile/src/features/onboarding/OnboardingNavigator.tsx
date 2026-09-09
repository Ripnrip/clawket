import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import { useAppTheme } from '../../theme';
import { GatewayClient } from '../../services/gateway';
import { StorageService } from '../../services/storage';
import type { GatewayConfig } from '../../types';
import type { QRScanResult } from '../../screens/ConfigScreen/qrPayload';
import { QRScannerScreen } from '../../screens/ConfigScreen/QRScannerScreen';
import {
  claimRelayPairing,
  type GatewayScanPayload,
} from '../../hooks/gatewayScanFlow';
import { WelcomeScreen } from './WelcomeScreen';
import { ConnectMethodScreen } from './ConnectMethodScreen';
import { ManualEntryScreen } from './ManualEntryScreen';
import { ConnectingScreen } from './ConnectingScreen';
import { NearbyDiscoveryScreen } from './NearbyDiscoveryScreen';
import { DeepLinkImportScreen } from './DeepLinkImportScreen';
import { SuccessScreen } from './SuccessScreen';
import { analyticsEvents } from '../../services/analytics/events';
import { hapticError } from './haptics';
import type { ConnectMethod, OnboardingComplete, OnboardingSkip } from './types';

// ─── Navigator param list ───

export type OnboardingStackParamList = {
  Welcome: undefined;
  ConnectMethod: undefined;
  QRScanner: undefined;
  ManualEntry: { url?: string; token?: string } | undefined;
  NearbyDiscovery: undefined;
  DeepLinkImport: undefined;
  Connecting: undefined;
  Success: { config: GatewayConfig; method: ConnectMethod; startedAt: number };
};

const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

// ─── Props ───

type Props = {
  isFirstLaunch: boolean;
  gateway: GatewayClient;
  onComplete: OnboardingComplete;
  onSkip: OnboardingSkip;
};

// ─── Navigator component ───

export function OnboardingNavigator({ isFirstLaunch, gateway, onComplete, onSkip }: Props): React.JSX.Element {
  const { theme } = useAppTheme();
  const colors = theme.colors;

  // Track the onboarding flow start time for analytics
  const startedAtRef = useRef<number>(Date.now());
  const selectedMethodRef = useRef<ConnectMethod>('manual');
  const connectionStartedAtRef = useRef<number | null>(null);

  // In-flight relay claim deduplication (mirrors useGatewayConfigForm pattern)
  const relayClaimInFlightRef = useRef<Map<string, Promise<GatewayScanPayload>>>(new Map());

  // Connecting error state
  const [connectingError, setConnectingError] = useState<{ message: string } | null>(null);

  // ─── Connection logic ───

  const resolveConnection = useCallback(
    async (config: GatewayConfig): Promise<GatewayConfig> => {
      // Save config to storage
      await StorageService.setGatewayConfig(config);
      // Configure and connect the gateway client
      gateway.configure(config);
      gateway.connect();

      // Probe the connection to verify the gateway is reachable.
      // Give it up to 10s to establish and verify the connection.
      const GATEWAY_PROBE_TIMEOUT_MS = 10_000;
      const isReachable = await gateway.probeConnection(GATEWAY_PROBE_TIMEOUT_MS);
      if (!isReachable) {
        throw new Error('Could not reach the gateway. Please check the URL and try again.');
      }

      // Only mark onboarding as completed once the gateway is verified
      await StorageService.setOnboardingCompleted();
      return config;
    },
    [gateway],
  );

  const handleConnect = useCallback(
    (
      config: GatewayConfig,
      method: ConnectMethod,
      navigation: OnboardingNavigationProp,
    ) => {
      connectionStartedAtRef.current = Date.now();
      selectedMethodRef.current = method;
      setConnectingError(null);
      navigation.navigate('Connecting');

      void resolveConnection(config)
        .then((resolvedConfig) => {
          const durationMs = connectionStartedAtRef.current
            ? Date.now() - connectionStartedAtRef.current
            : 0;
          analyticsEvents.onboardingConnectionResolved({
            method,
            result: 'success',
            duration_ms: durationMs,
          });
          // Reset the stack to show only the Success screen
          navigation.reset({
            index: 0,
            routes: [{
              name: 'Success',
              params: {
                config: resolvedConfig,
                method,
                startedAt: startedAtRef.current,
              },
            }],
          });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Connection failed';
          const durationMs = connectionStartedAtRef.current
            ? Date.now() - connectionStartedAtRef.current
            : 0;
          analyticsEvents.onboardingConnectionResolved({
            method,
            result: 'failure',
            duration_ms: durationMs,
            error_code: 'connection_error',
          });
          void hapticError();
          setConnectingError({ message });
          // Navigate back to the previous screen after showing the error briefly
          setTimeout(() => {
            setConnectingError(null);
            navigation.goBack();
          }, 2500);
        });
    },
    [resolveConnection],
  );

  // ─── Event handlers ───

  const handleWelcomeGetStarted = useCallback((navigation: OnboardingNavigationProp) => {
    navigation.navigate('ConnectMethod');
  }, []);

  const handleWelcomeSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  const handleMethodSelect = useCallback(
    (method: ConnectMethod, navigation: OnboardingNavigationProp) => {
      selectedMethodRef.current = method;
      switch (method) {
        case 'qr':
          navigation.navigate('QRScanner');
          break;
        case 'manual':
          navigation.navigate('ManualEntry');
          break;
        case 'nearby':
          navigation.navigate('NearbyDiscovery');
          break;
        case 'deeplink':
          navigation.navigate('DeepLinkImport');
          break;
      }
    },
    [],
  );

  const handleConnectFromScanResult = useCallback(
    (
      result: GatewayScanPayload,
      method: ConnectMethod,
      navigation: OnboardingNavigationProp,
    ) => {
      // If the payload contains relay data with an access code, claim it first
      // before building a GatewayConfig. This mirrors the ConfigScreen flow.
      const claimTask = result.relay?.accessCode
        ? claimRelayPairing(result, relayClaimInFlightRef)
        : Promise.resolve(result);

      void claimTask
        .then((resolved) => {
          const config: GatewayConfig = {
            url: resolved.url,
            token: resolved.token,
            password: resolved.password,
            backendKind: resolved.backendKind,
            transportKind: resolved.transportKind,
            mode: resolved.mode,
            ...(resolved.hermes ? { hermes: resolved.hermes } : {}),
            ...(resolved.relay ? { relay: resolved.relay } : {}),
          };
          handleConnect(config, method, navigation);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Could not claim this pairing code.';
          analyticsEvents.onboardingConnectionResolved({
            method,
            result: 'failure',
            duration_ms: 0,
            error_code: 'relay_claim_error',
          });
          void hapticError();
          setConnectingError({ message });
          setTimeout(() => {
            setConnectingError(null);
            navigation.goBack();
          }, 2500);
        });
    },
    [handleConnect],
  );

  const handleQrScanned = useCallback(
    (result: QRScanResult, navigation: OnboardingNavigationProp) => {
      analyticsEvents.onboardingQrScanned({ success: true });
      handleConnectFromScanResult(result as GatewayScanPayload, 'qr', navigation);
    },
    [handleConnectFromScanResult],
  );

  const handleNearbyReady = useCallback(
    (payload: GatewayScanPayload, navigation: OnboardingNavigationProp) => {
      handleConnectFromScanResult(payload, 'nearby', navigation);
    },
    [handleConnectFromScanResult],
  );

  const handleNearbyNeedsCredentials = useCallback(
    (url: string, navigation: OnboardingNavigationProp) => {
      navigation.navigate('ManualEntry', { url });
    },
    [],
  );

  const handleDeepLinkPayload = useCallback(
    (payload: GatewayScanPayload, navigation: OnboardingNavigationProp) => {
      handleConnectFromScanResult(payload, 'deeplink', navigation);
    },
    [handleConnectFromScanResult],
  );

  const handleManualSubmit = useCallback(
    (url: string, token: string, navigation: OnboardingNavigationProp) => {
      const config: GatewayConfig = {
        url,
        ...(token ? { token } : {}),
      };
      handleConnect(config, 'manual', navigation);
    },
    [handleConnect],
  );

  const handleSuccess = useCallback(
    (config: GatewayConfig) => {
      onComplete(config);
    },
    [onComplete],
  );

  // ─── Screen options ───

  const screenOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
      animation: 'slide_from_right',
      gestureEnabled: true,
      fullScreenGestureEnabled: true,
    }),
    [colors.background],
  );

  const connectingScreenOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
      gestureEnabled: false,
      animation: 'fade',
    }),
    [colors.background],
  );

  const successScreenOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
      gestureEnabled: false,
      animation: 'fade',
    }),
    [colors.background],
  );

  // ─── Analytics step viewed tracking ───
  const lastStepViewedRef = useRef<string>('');
  const trackStepViewed = useCallback((step: string) => {
    if (lastStepViewedRef.current === step) return;
    lastStepViewedRef.current = step;
    analyticsEvents.onboardingStepViewed({ step });
  }, []);

  return (
    <OnboardingStack.Navigator screenOptions={screenOptions} initialRouteName="Welcome">
      <OnboardingStack.Screen name="Welcome">
        {(props) => {
          trackStepViewed('welcome');
          return (
            <WelcomeScreen
              isFirstLaunch={isFirstLaunch}
              onGetStarted={() => handleWelcomeGetStarted(props.navigation)}
              onSkip={handleWelcomeSkip}
            />
          );
        }}
      </OnboardingStack.Screen>

      <OnboardingStack.Screen name="ConnectMethod">
        {(props) => {
          trackStepViewed('connectMethod');
          return (
            <ConnectMethodScreen
              onBack={() => props.navigation.goBack()}
              onSelect={(method) => handleMethodSelect(method, props.navigation)}
            />
          );
        }}
      </OnboardingStack.Screen>

      <OnboardingStack.Screen name="QRScanner">
        {(props) => {
          trackStepViewed('scanning');
          return (
            <QRScannerScreen
              onScanned={(result) => handleQrScanned(result, props.navigation)}
              onCancel={() => props.navigation.goBack()}
            />
          );
        }}
      </OnboardingStack.Screen>

      <OnboardingStack.Screen name="ManualEntry">
        {(props) => {
          trackStepViewed('manualEntry');
          return (
            <ManualEntryScreen
              initialUrl={props.route.params?.url}
              initialToken={props.route.params?.token}
              onBack={() => props.navigation.goBack()}
              onSubmit={(url, token) => handleManualSubmit(url, token, props.navigation)}
            />
          );
        }}
      </OnboardingStack.Screen>

      <OnboardingStack.Screen name="NearbyDiscovery">
        {(props) => {
          trackStepViewed('nearbyDiscovery');
          return (
            <NearbyDiscoveryScreen
              onReady={(payload) => handleNearbyReady(payload, props.navigation)}
              onNeedsCredentials={(url) => handleNearbyNeedsCredentials(url, props.navigation)}
              onManualEntry={() => props.navigation.navigate('ManualEntry')}
              onBack={() => props.navigation.goBack()}
            />
          );
        }}
      </OnboardingStack.Screen>

      <OnboardingStack.Screen name="DeepLinkImport">
        {(props) => {
          trackStepViewed('deepLinkImport');
          return (
            <DeepLinkImportScreen
              onPayload={(payload) => handleDeepLinkPayload(payload, props.navigation)}
              onManualEntry={() => props.navigation.navigate('ManualEntry')}
              onBack={() => props.navigation.goBack()}
            />
          );
        }}
      </OnboardingStack.Screen>

      <OnboardingStack.Screen name="Connecting" options={connectingScreenOptions}>
        {() => {
          trackStepViewed('connecting');
          return <ConnectingScreen error={connectingError} />;
        }}
      </OnboardingStack.Screen>

      <OnboardingStack.Screen name="Success" options={successScreenOptions}>
        {(props) => {
          trackStepViewed('success');
          const { config, method, startedAt } = props.route.params;
          return (
            <SuccessScreen
              config={config}
              method={method}
              startedAt={startedAt}
              onComplete={handleSuccess}
            />
          );
        }}
      </OnboardingStack.Screen>
    </OnboardingStack.Navigator>
  );
}

// Navigation type alias used in callbacks above
type OnboardingNavigationProp = NativeStackNavigationProp<OnboardingStackParamList>;
