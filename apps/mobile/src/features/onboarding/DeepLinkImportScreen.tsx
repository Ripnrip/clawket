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
import { ChevronLeft, Link2 } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { useAppTheme } from '../../theme';
import { FontSize, FontWeight, Radius, Space, TimingPreset } from '../../theme/tokens';
import { hapticLight } from './haptics';
import { readClipboardImport, parseImportText } from '../../services/deepLinkImport';
import type { GatewayScanPayload } from '../../hooks/gatewayScanFlow';

type Props = {
  onPayload: (payload: GatewayScanPayload) => void;
  onManualEntry: () => void;
  onBack: () => void;
};

type Phase = 'reading' | 'waiting' | 'manual';

export function DeepLinkImportScreen({
  onPayload,
  onManualEntry,
  onBack,
}: Props): React.JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('onboarding');
  const colors = theme.colors;
  const [phase, setPhase] = useState<Phase>('reading');
  const processedRef = useRef<string | null>(null);

  const iconProgress = useSharedValue(0);
  const textProgress = useSharedValue(0);

  useEffect(() => {
    iconProgress.value = withTiming(1, { duration: TimingPreset.slow, easing: Easing.out(Easing.ease) });
    textProgress.value = withDelay(200, withTiming(1, { duration: TimingPreset.normal, easing: Easing.out(Easing.ease) }));
  }, [iconProgress, textProgress]);

  useEffect(() => {
    if (phase !== 'reading') return;

    const handlePayload = (payload: GatewayScanPayload) => {
      onPayload(payload);
    };

    // Attempt clipboard import immediately
    void readClipboardImport().then((payload) => {
      if (payload) {
        handlePayload(payload);
        return;
      }
      setPhase('waiting');
    }).catch(() => {
      setPhase('waiting');
    });

    // Also listen for inbound deep links while on this screen
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (processedRef.current === url) return;
      const payload = parseImportText(url);
      if (payload) {
        processedRef.current = url;
        handlePayload(payload);
      }
    });

    // Handle cold-start deep link
    void Linking.getInitialURL().then((url) => {
      if (!url || processedRef.current) return;
      const payload = parseImportText(url);
      if (payload) {
        processedRef.current = url;
        handlePayload(payload);
      }
    });

    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = useCallback(() => {
    void hapticLight();
    onBack();
  }, [onBack]);

  const handleManualEntry = useCallback(() => {
    void hapticLight();
    onManualEntry();
  }, [onManualEntry]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconProgress.value,
    transform: [{ scale: interpolate(iconProgress.value, [0, 1], [0.5, 1]) }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textProgress.value,
    transform: [{ translateY: interpolate(textProgress.value, [0, 1], [16, 0]) }],
  }));

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
          <Link2 size={48} color={colors.primary} strokeWidth={1.5} />
        </Animated.View>

        <Animated.View style={[styles.textContent, textStyle]}>
          {phase === 'reading' && (
            <Text style={[styles.title, { color: colors.text }]}>
              {t('onboarding.deeplink.checking')}
            </Text>
          )}

          {phase === 'waiting' && (
            <>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('onboarding.deeplink.waiting')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('onboarding.deeplink.waitingSubtitle')}
              </Text>
            </>
          )}
        </Animated.View>
      </View>

      <View style={styles.actionArea}>
        <Pressable
          onPress={handleManualEntry}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>
            {t('onboarding.deeplink.enterManually')}
          </Text>
        </Pressable>
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
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
  },
});