import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { ArrowRight, MessageCircle } from 'lucide-react-native';
import { useAppTheme } from '../../theme';
import { FontSize, FontWeight, Radius, Space, SpringPreset, TimingPreset } from '../../theme/tokens';
import { onboardingAnalytics } from './onboardingAnalytics';
import { hapticLight } from './haptics';
import { LottieAnimationView } from './LottieView';

type Props = {
  isFirstLaunch: boolean;
  onGetStarted: () => void;
  onSkip: () => void;
};

export function WelcomeScreen({ isFirstLaunch, onGetStarted, onSkip }: Props): React.JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('onboarding');

  const colors = theme.colors;

  // Animation progress values — 0 = hidden, 1 = visible
  const titleProgress = useSharedValue(0);
  const subtitleProgress = useSharedValue(0);
  const buttonProgress = useSharedValue(0);

  // Pulsing circle for the logo placeholder
  const pulseScale = useSharedValue(0.8);

  useEffect(() => {
    titleProgress.value = withTiming(1, { duration: TimingPreset.slow, easing: Easing.out(Easing.ease) });
    subtitleProgress.value = withDelay(
      200,
      withTiming(1, { duration: TimingPreset.slow, easing: Easing.out(Easing.ease) }),
    );
    buttonProgress.value = withDelay(
      400,
      withSpring(1, SpringPreset.sheet),
    );
    pulseScale.value = withRepeat(
      withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [titleProgress, subtitleProgress, buttonProgress, pulseScale]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleProgress.value,
    transform: [
      {
        translateY: interpolate(titleProgress.value, [0, 1], [24, 0]),
      },
    ],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleProgress.value,
    transform: [
      {
        translateY: interpolate(subtitleProgress.value, [0, 1], [16, 0]),
      },
    ],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonProgress.value,
    transform: [
      {
        translateY: interpolate(buttonProgress.value, [0, 1], [16, 0]),
      },
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleGetStarted = (): void => {
    onboardingAnalytics.started({ is_first_launch: isFirstLaunch });
    void hapticLight();
    onGetStarted();
  };

  const handleSkip = (): void => {
    onboardingAnalytics.skipped({ step: 'welcome' });
    void hapticLight();
    onSkip();
  };

  const gradientColors = useMemo<[string, string]>(
    () => [colors.primarySoft, colors.background],
    [colors.primarySoft, colors.background],
  );

  return (
    <View style={[styles.container, { backgroundColor: gradientColors[1], paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Logo / animation area */}
      <View style={styles.logoArea}>
        <View style={styles.logoContainer}>
          <LottieAnimationView animationKey="welcome" width={140} height={140} />
        </View>
      </View>

      {/* Text content */}
      <View style={styles.textContent}>
        <Animated.View style={titleStyle}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('onboarding.welcome.title')}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.subtitleWrapper, subtitleStyle]}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('onboarding.welcome.subtitle')}
          </Text>
        </Animated.View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Animated.View style={buttonStyle}>
          <Pressable
            onPress={handleGetStarted}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
              {t('onboarding.welcome.getStarted')}
            </Text>
            <ArrowRight size={20} color={colors.primaryText} strokeWidth={2.5} />
          </Pressable>
        </Animated.View>

        <Animated.View style={buttonStyle}>
          <Pressable
            onPress={handleSkip}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
          >
            <Text style={[styles.skipLink, { color: colors.textMuted }]}>
              {t('onboarding.welcome.haveConnection')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
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
  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Space.xxxl,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    alignItems: 'center',
    gap: Space.md,
    paddingBottom: Space.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitleWrapper: {
    paddingHorizontal: Space.xl,
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: Space.lg,
    paddingBottom: Space.xxxl,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
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
  skipLink: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
});
