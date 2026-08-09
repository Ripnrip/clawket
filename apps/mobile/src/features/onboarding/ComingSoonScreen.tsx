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
import { ChevronLeft, Compass } from 'lucide-react-native';
import { useAppTheme } from '../../theme';
import { FontSize, FontWeight, Radius, Space, SpringPreset, TimingPreset } from '../../theme/tokens';
import { hapticLight } from './haptics';

type Props = {
  onBack: () => void;
};

export function ComingSoonScreen({ onBack }: Props): React.JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('onboarding');
  const colors = theme.colors;

  const iconProgress = useSharedValue(0);
  const textProgress = useSharedValue(0);
  const buttonProgress = useSharedValue(0);

  useEffect(() => {
    iconProgress.value = withSpring(1, SpringPreset.gentle);
    textProgress.value = withDelay(
      200,
      withTiming(1, { duration: TimingPreset.normal, easing: Easing.out(Easing.ease) }),
    );
    buttonProgress.value = withDelay(400, withSpring(1, SpringPreset.sheet));
  }, [iconProgress, textProgress, buttonProgress]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconProgress.value,
    transform: [{ scale: interpolate(iconProgress.value, [0, 1], [0.5, 1]) }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textProgress.value,
    transform: [{ translateY: interpolate(textProgress.value, [0, 1], [16, 0]) }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonProgress.value,
    transform: [{ translateY: interpolate(buttonProgress.value, [0, 1], [16, 0]) }],
  }));

  const handleBack = (): void => {
    void hapticLight();
    onBack();
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
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
          <Compass size={48} color={colors.primary} strokeWidth={1.5} />
        </Animated.View>

        <Animated.View style={[styles.textContent, textStyle]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('onboarding.comingSoon.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('onboarding.comingSoon.subtitle')}
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={buttonStyle}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>
            {t('onboarding.comingSoon.goBack')}
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
    },
    subtitle: {
      fontSize: FontSize.lg,
      textAlign: 'center',
    },
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      paddingVertical: Space.lg,
      borderRadius: Radius.lg,
      borderWidth: 1,
      marginBottom: Space.xxl,
    },
    buttonPressed: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: FontSize.xl,
      fontWeight: FontWeight.semibold,
    },
  });
}
