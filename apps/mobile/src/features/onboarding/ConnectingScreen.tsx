import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
import { useAppTheme } from '../../theme';
import { FontSize, FontWeight, Space, TimingPreset } from '../../theme/tokens';

type Props = {
  error?: { message: string } | null;
};

export function ConnectingScreen({ error }: Props): React.JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('onboarding');
  const colors = theme.colors;

  const textProgress = useSharedValue(0);

  useEffect(() => {
    textProgress.value = withDelay(
      200,
      withTiming(1, { duration: TimingPreset.normal, easing: Easing.out(Easing.ease) }),
    );
  }, [textProgress]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textProgress.value,
    transform: [{ translateY: interpolate(textProgress.value, [0, 1], [12, 0]) }],
  }));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Animated.View style={[styles.content, textStyle]}>
        {error ? (
          <>
            <Text style={[styles.title, { color: colors.error }]}>
              {error.message}
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>
              {t('onboarding.connecting.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('onboarding.connecting.subtitle')}
            </Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xxl,
  },
  content: {
    alignItems: 'center',
    gap: Space.md,
  },
  title: {
    fontSize: 22,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
});
