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
import { ChevronLeft, Link, QrCode, Terminal, Wifi } from 'lucide-react-native';
import { useAppTheme } from '../../theme';
import { FontSize, FontWeight, Radius, Space, SpringPreset, TimingPreset } from '../../theme/tokens';
import type { ConnectMethod } from './types';
import { analyticsEvents } from '../../services/analytics/events';
import { hapticMedium } from './haptics';

type Props = {
  onSelect: (method: ConnectMethod) => void;
  onBack: () => void;
};

type MethodCardData = {
  method: ConnectMethod;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  titleKey: string;
  descKey: string;
  showBeta?: boolean;
};

const METHODS: MethodCardData[] = [
  {
    method: 'qr',
    icon: QrCode,
    titleKey: 'onboarding.connectMethod.qr.title',
    descKey: 'onboarding.connectMethod.qr.description',
  },
  {
    method: 'nearby',
    icon: Wifi,
    titleKey: 'onboarding.connectMethod.nearby.title',
    descKey: 'onboarding.connectMethod.nearby.description',
    showBeta: true,
  },
  {
    method: 'manual',
    icon: Terminal,
    titleKey: 'onboarding.connectMethod.manual.title',
    descKey: 'onboarding.connectMethod.manual.description',
  },
  {
    method: 'deeplink',
    icon: Link,
    titleKey: 'onboarding.connectMethod.deeplink.title',
    descKey: 'onboarding.connectMethod.deeplink.description',
  },
];

export function ConnectMethodScreen({ onSelect, onBack }: Props): React.JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('onboarding');
  const colors = theme.colors;

  // Stagger entrance animation progress values
  const headerProgress = useSharedValue(0);
  const cardProgress = METHODS.map(() => useSharedValue(0));

  useEffect(() => {
    headerProgress.value = withTiming(1, {
      duration: TimingPreset.normal,
      easing: Easing.out(Easing.ease),
    });
    cardProgress.forEach((sv, index) => {
      sv.value = withDelay(
        100 + index * 80,
        withSpring(1, SpringPreset.gentle),
      );
    });
  }, [headerProgress, cardProgress]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerProgress.value,
    transform: [{ translateY: interpolate(headerProgress.value, [0, 1], [16, 0]) }],
  }));

  const handleSelect = (method: ConnectMethod): void => {
    analyticsEvents.onboardingConnectMethodSelected({ method, source: 'connect_method_screen' });
    void hapticMedium();
    onSelect(method);
  };

  const handleBack = (): void => {
    void hapticMedium();
    onBack();
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
        </Pressable>
      </View>

      <Animated.View style={[styles.titleSection, headerStyle]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('onboarding.connectMethod.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('onboarding.connectMethod.subtitle')}
        </Text>
      </Animated.View>

      {/* Method cards */}
      <View style={styles.cardsContainer}>
        {METHODS.map((data, index) => (
          <MethodCard
            key={data.method}
            data={data}
            progress={cardProgress[index]}
            colors={colors}
            styles={styles}
            t={t}
            onPress={() => handleSelect(data.method)}
          />
        ))}
      </View>
    </View>
  );
}

type MethodCardProps = {
  data: MethodCardData;
  progress: Animated.SharedValue<number>;
  colors: import('../../theme').AppTheme['colors'];
  styles: ReturnType<typeof createStyles>;
  t: ReturnType<typeof useTranslation>['t'];
  onPress: () => void;
};

function MethodCard({ data, progress, colors, styles, t, onPress }: MethodCardProps): React.JSX.Element {
  const pressed = useSharedValue(0);
  const Icon = data.icon;

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [24, 0]) },
      { scale: interpolate(pressed.value, [0, 1], [1, 0.97]) },
    ],
  }));

  const handlePressIn = (): void => {
    pressed.value = withSpring(1, SpringPreset.snappy);
  };

  const handlePressOut = (): void => {
    pressed.value = withSpring(0, SpringPreset.snappy);
  };

  return (
    <Animated.View style={entranceStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon size={24} color={colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.cardText}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t(data.titleKey)}
            </Text>
            {data.showBeta ? (
              <View style={[styles.betaBadge, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.betaText, { color: colors.primary }]}>
                  {t('onboarding.connectMethod.nearby.beta')}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            {t(data.descKey)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: import('../../theme').AppTheme['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: Space.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      marginBottom: Space.lg,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -Space.sm,
    },
    titleSection: {
      marginBottom: Space.xxl,
    },
    title: {
      fontSize: 24,
      fontWeight: FontWeight.bold,
      letterSpacing: -0.5,
      marginBottom: Space.sm,
    },
    subtitle: {
      fontSize: FontSize.lg,
      lineHeight: 22,
    },
    cardsContainer: {
      gap: Space.md,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.lg,
      paddingVertical: Space.lg,
      paddingHorizontal: Space.lg,
      borderRadius: Radius.lg,
      borderWidth: 1,
    },
    cardIcon: {
      width: 48,
      height: 48,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardText: {
      flex: 1,
      gap: Space.xs,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.sm,
    },
    cardTitle: {
      fontSize: FontSize.xl,
      fontWeight: FontWeight.semibold,
    },
    cardDescription: {
      fontSize: FontSize.base,
      lineHeight: 20,
    },
    betaBadge: {
      paddingHorizontal: Space.sm,
      paddingVertical: 2,
      borderRadius: Radius.sm,
    },
    betaText: {
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
    },
  });
}
