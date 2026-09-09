import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { ChevronLeft } from 'lucide-react-native';
import { useAppTheme } from '../../theme';
import { FontSize, FontWeight, Radius, Space, TimingPreset } from '../../theme/tokens';
import { LottieAnimationView } from './LottieView';
import { hapticLight } from './haptics';
import {
  isNearbyDiscoverySupported,
  startNearbyDiscovery,
  stopNearbyDiscovery,
  addNearbyGatewayListener,
  addNearbyErrorListener,
  resolveNearbyOutcome,
  type DiscoveredNearbyGateway,
} from '../../services/nearbyDiscovery';
import type { GatewayScanPayload } from '../../hooks/gatewayScanFlow';

type Props = {
  onReady: (payload: GatewayScanPayload) => void;
  onNeedsCredentials: (url: string) => void;
  onManualEntry: () => void;
  onBack: () => void;
};

type ScanPhase = 'browsing' | 'connecting' | 'timeout' | 'error' | 'unsupported';

const TIMEOUT_MS = 15_000;

export function NearbyDiscoveryScreen({
  onReady,
  onNeedsCredentials,
  onManualEntry,
  onBack,
}: Props): React.JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('onboarding');
  const colors = theme.colors;
  const [phase, setPhase] = useState<ScanPhase>(
    isNearbyDiscoverySupported() ? 'browsing' : 'unsupported'
  );
  const [foundName, setFoundName] = useState('');
  const connectedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iconProgress = useSharedValue(0);
  const textProgress = useSharedValue(0);

  useEffect(() => {
    if (phase !== 'browsing') return;
    iconProgress.value = withTiming(1, { duration: TimingPreset.slow, easing: Easing.out(Easing.ease) });
    textProgress.value = withDelay(200, withTiming(1, { duration: TimingPreset.normal, easing: Easing.out(Easing.ease) }));

    void startNearbyDiscovery();

    const gatewaySub = addNearbyGatewayListener((gateway: DiscoveredNearbyGateway) => {
      if (connectedRef.current) return;
      const outcome = resolveNearbyOutcome(gateway);
      if (outcome.kind === 'ready') {
        connectedRef.current = true;
        setFoundName(gateway.name);
        setPhase('connecting');
        void hapticLight();
        onReady(outcome.payload);
      } else if (outcome.kind === 'needsCredentials') {
        connectedRef.current = true;
        setFoundName(gateway.name);
        setPhase('connecting');
        void hapticLight();
        onNeedsCredentials(outcome.url);
      }
      // 'unusable' — keep scanning
    });

    const errorSub = addNearbyErrorListener(() => {
      if (connectedRef.current) return;
      connectedRef.current = true;
      setPhase('error');
      void stopNearbyDiscovery();
    });

    timeoutRef.current = setTimeout(() => {
      if (!connectedRef.current) {
        connectedRef.current = true;
        setPhase('timeout');
        void stopNearbyDiscovery();
      }
    }, TIMEOUT_MS);

    return () => {
      gatewaySub?.remove();
      errorSub?.remove();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      connectedRef.current = true;
      void stopNearbyDiscovery();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconProgress.value,
    transform: [{ scale: interpolate(iconProgress.value, [0, 1], [0.5, 1]) }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textProgress.value,
    transform: [{ translateY: interpolate(textProgress.value, [0, 1], [16, 0]) }],
  }));

  const handleBack = useCallback(() => {
    void hapticLight();
    onBack();
  }, [onBack]);

  const handleManualEntry = useCallback(() => {
    void hapticLight();
    onManualEntry();
  }, [onManualEntry]);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Animated.View style={[styles.iconContainer, { backgroundColor: colors.primarySoft }, iconStyle]}>
          <LottieAnimationView animationKey="nearby" width={96} height={96} />
        </Animated.View>

        <Animated.View style={[styles.textContent, textStyle]}>
          {phase === 'browsing' && (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('onboarding.nearbyDiscovery.looking')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('onboarding.nearbyDiscovery.subtitle')}
              </Text>
            </>
          )}

          {phase === 'connecting' && (
            <Text style={[styles.title, { color: colors.text }]}>
              {t('onboarding.nearbyDiscovery.found', { name: foundName })}
            </Text>
          )}

          {phase === 'timeout' && (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('onboarding.nearbyDiscovery.noGateways')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('onboarding.nearbyDiscovery.subtitle')}
              </Text>
            </>
          )}

          {phase === 'unsupported' && (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('onboarding.nearbyDiscovery.unsupported')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('onboarding.nearbyDiscovery.subtitle')}
              </Text>
            </>
          )}

          {phase === 'error' && (
            <Text style={[styles.title, { color: colors.error }]}>
              {t('onboarding.nearbyDiscovery.error')}
            </Text>
          )}
        </Animated.View>
      </View>

      {(phase === 'timeout' || phase === 'unsupported' || phase === 'error') && (
        <View style={styles.actionArea}>
          <Pressable
            onPress={handleManualEntry}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryText }]}>
              {t('onboarding.nearbyDiscovery.enterManually')}
            </Text>
          </Pressable>
        </View>
      )}

      {phase === 'browsing' && (
        <View style={styles.actionArea}>
          <Pressable
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
          >
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>
              {t('onboarding.cancel')}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginBottom: Space.lg,
    alignSelf: 'stretch',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Space.sm,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xl,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    alignItems: 'center',
    gap: Space.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.lg,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Space.xl,
  },
  actionArea: {
    alignItems: 'center',
    gap: Space.lg,
    paddingBottom: Space.xxxl,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: Space.lg,
    borderRadius: Radius.lg,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
  },
  cancelText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
});