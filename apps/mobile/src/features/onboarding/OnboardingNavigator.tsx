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
import { WelcomeScreen } from './WelcomeScreen';
import { ConnectMethodScreen } from './ConnectMethodScreen';
import { ManualEntryScreen } from './ManualEntryScreen';
import { ConnectingScreen } from './ConnectingScreen';
import { ComingSoonScreen } from './ComingSoonScreen';
import { SuccessScreen } from './SuccessScreen';
import { onboardingAnalytics } from './onboardingAnalytics';
import { hapticError } from './haptics';
import type { ConnectMethod, OnboardingComplete, OnboardingSkip } from './types';

// ─── Navigator param list ───

export type OnboardingStackParamList = {
  Welcome: undefined;
  ConnectMethod: undefined;
  QRScanner: undefined;
  ManualEntry: undefined;
  Connecting: undefined;
  ComingSoon: { method: ConnectMethod };
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

  // Connecting error state
  const [connectingError, setConnectingError] = useState<{ message: string } | null>(null);

  // ─── Connection logic ───

  const resolveConnection = useCallback(
    async (config: GatewayConfig): Promise<GatewayConfig> => {
      // Save config to storage
      await StorageService.setGatewayConfig(config);
      // Configure the gateway client
      gateway.configure(config);
      // Mark onboarding as completed
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
          onboardingAnalytics.connectionResolved({
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
          onboardingAnalytics.connectionResolved({
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
        case 'deeplink':
          navigation.navigate('ComingSoon', { method });
          break;
      }
    },
    [],
  );

  const handleQrScanned = useCallback(
    (result: QRScanResult, navigation: OnboardingNavigationProp) => {
      onboardingAnalytics.qrScanned({ success: true });

      // Build a GatewayConfig from the QR scan result
      const config: GatewayConfig = {
        url: result.url,
        token: result.token,
        password: result.password,
        backendKind: result.backendKind,
        transportKind: result.transportKind,
        mode: result.mode,
        ...(result.hermes ? { hermes: result.hermes } : {}),
        ...(result.relay ? { relay: result.relay } : {}),
      };

      handleConnect(config, 'qr', navigation);
    },
    [handleConnect],
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
    onboardingAnalytics.stepViewed({ step });
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
              onBack={() => props.navigation.goBack()}
              onSubmit={(url, token) => handleManualSubmit(url, token, props.navigation)}
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

      <OnboardingStack.Screen name="ComingSoon" options={screenOptions}>
        {(props) => (
          <ComingSoonScreen onBack={() => props.navigation.goBack()} />
        )}
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
