import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Check, MessageCircle } from 'lucide-react-native';
import { useAppTheme } from '../../theme';
import { FontSize, FontWeight, Radius, Space, SpringPreset, TimingPreset } from '../../theme/tokens';
import type { GatewayConfig } from '../../types';
import type { ConnectMethod, OnboardingComplete } from './types';
import { analyticsEvents } from '../../services/analytics/events';
import { hapticSuccess } from './haptics';
import { LottieAnimationView } from './LottieView';

type Props = {
  config: GatewayConfig;
  method: ConnectMethod;
  startedAt: number;
  onComplete: OnboardingComplete;
};

export function SuccessScreen({ config, method, startedAt, onComplete }: Props): React.JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('onboarding');
  const colors = theme.colors;

  // Animation values
  const circleScale = useSharedValue(0);
  const checkProgress = useSharedValue(0);
  const textProgress = useSharedValue(0);
  const buttonProgress = useSharedValue(0);

  const hasFiredRef = React.useRef(false);

  useEffect(() => {
    void hapticSuccess();

    // Circle pops in
    circleScale.value = withSpring(1, SpringPreset.sheet);

    // Checkmark draws after circle
    checkProgress.value = withDelay(
      300,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) }),
    );

    // Text appears
    textProgress.value = withDelay(
      600,
      withTiming(1, { duration: TimingPreset.normal, easing: Easing.out(Easing.ease) }),
    );

    // Button slides up
    buttonProgress.value = withDelay(
      800,
      withSpring(1, SpringPreset.sheet),
    );

    // Fire analytics once on mount
    if (!hasFiredRef.current) {
      hasFiredRef.current = true;
      const totalDuration = Date.now() - startedAt;
      analyticsEvents.onboardingCompleted({
        method,
        total_duration_ms: totalDuration,
      });
    }
  }, [circleScale, checkProgress, textProgress, buttonProgress, method, startedAt]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: interpolate(circleScale.value, [0, 0.5, 1], [0, 0.5, 1]),
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkProgress.value,
    transform: [{ scale: interpolate(checkProgress.value, [0, 1], [0.5, 1]) }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textProgress.value,
    transform: [{ translateY: interpolate(textProgress.value, [0, 1], [16, 0]) }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonProgress.value,
    transform: [{ translateY: interpolate(buttonProgress.value, [0, 1], [16, 0]) }],
  }));

  const gatewayDisplay = useMemo(() => {
    const display = config.hermes?.displayName ?? config.relay?.displayName;
    return display ?? config.url;
  }, [config]);

  const handleComplete = (): void => {
    onComplete(config);
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Animated success illustration */}
      <View style={styles.illustrationArea}>
        <LottieAnimationView animationKey="success" width={160} height={160} />
      </View>

      {/* Text content */}
      <Animated.View style={[styles.textContent, textStyle]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('onboarding.success.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('onboarding.success.subtitle')}
        </Text>

        {/* Gateway info */}
        <View style={[styles.gatewayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.gatewayIcon, { backgroundColor: colors.primarySoft }]}>
            <MessageCircle size={20} color={colors.primary} strokeWidth={2} />
          </View>
          <Text style={[styles.gatewayUrl, { color: colors.text }]} numberOfLines={1}>
            {gatewayDisplay}
          </Text>
        </View>
      </Animated.View>

      {/* Action button */}
      <Animated.View style={[styles.actionArea, buttonStyle]}>
        <Pressable
          onPress={handleComplete}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.primary },
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
            {t('onboarding.success.startChatting')}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: import('../../theme').AppTheme['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Space.xxl,
    },
    illustrationArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContent: {
      alignItems: 'center',
      width: '100%',
      gap: Space.md,
      paddingBottom: Space.xl,
    },
    title: {
      fontSize: 28,
      fontWeight: FontWeight.bold,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: FontSize.lg,
      textAlign: 'center',
    },
    gatewayCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.md,
      width: '100%',
      paddingVertical: Space.md,
      paddingHorizontal: Space.lg,
      borderRadius: Radius.lg,
      borderWidth: 1,
      marginTop: Space.lg,
    },
    gatewayIcon: {
      width: 36,
      height: 36,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gatewayUrl: {
      flex: 1,
      fontSize: FontSize.base,
      fontWeight: FontWeight.medium,
    },
    actionArea: {
      width: '100%',
      paddingBottom: Space.xxl,
    },
    primaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      paddingVertical: Space.lg,
      borderRadius: Radius.lg,
    },
    primaryButtonPressed: {
      opacity: 0.88,
    },
    primaryButtonText: {
      fontSize: FontSize.xl,
      fontWeight: FontWeight.semibold,
    },
  });
}
