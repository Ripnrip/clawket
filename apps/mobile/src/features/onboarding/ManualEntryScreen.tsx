import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useAppTheme } from '../../theme';
import { FontSize, FontWeight, Radius, Space } from '../../theme/tokens';
import { onboardingAnalytics } from './onboardingAnalytics';
import { hapticLight } from './haptics';

type Props = {
  onSubmit: (url: string, token: string) => void;
  onBack: () => void;
};

export function ManualEntryScreen({ onSubmit, onBack }: Props): React.JSX.Element {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('onboarding');
  const colors = theme.colors;

  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError(t('onboarding.manual.errorRequired'));
      return;
    }

    onboardingAnalytics.manualSubmitted({
      has_url: true,
      has_token: token.trim().length > 0,
    });
    void hapticLight();
    onSubmit(trimmedUrl, token.trim());
  }, [url, token, t, onSubmit]);

  const handleBack = useCallback(() => {
    void hapticLight();
    onBack();
  }, [onBack]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {t('onboarding.manual.title')}
          </Text>

          {/* URL field */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {t('onboarding.manual.urlLabel')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={url}
              onChangeText={(text) => {
                setUrl(text);
                setError(null);
              }}
              placeholder={t('onboarding.manual.urlPlaceholder')}
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
            />
          </View>

          {/* Token field */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              {t('onboarding.manual.tokenLabel')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={token}
              onChangeText={setToken}
              placeholder={t('onboarding.manual.tokenPlaceholder')}
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : null}
        </ScrollView>

        {/* Connect button */}
        <View style={styles.actionArea}>
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.connectButton,
              { backgroundColor: colors.primary },
              pressed && styles.connectButtonPressed,
            ]}
          >
            <Text style={[styles.connectButtonText, { color: colors.primaryText }]}>
              {t('onboarding.manual.connect')}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  scrollContent: {
    paddingBottom: Space.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: Space.xl,
  },
  field: {
    gap: Space.sm,
    marginBottom: Space.lg,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  input: {
    fontSize: FontSize.lg,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: FontSize.base,
    marginTop: Space.sm,
  },
  actionArea: {
    paddingTop: Space.lg,
  },
  connectButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: Space.lg,
    borderRadius: Radius.lg,
  },
  connectButtonPressed: {
    opacity: 0.88,
  },
  connectButtonText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
  },
});
