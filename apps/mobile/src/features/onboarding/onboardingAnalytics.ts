import { posthogClient } from '../../services/analytics/posthog';
import type { ConnectMethod } from './types';

type AnalyticsValue = boolean | number | string | null | undefined;
type AnalyticsProperties = Record<string, AnalyticsValue>;

function compactProperties(properties: AnalyticsProperties): Record<string, boolean | number | string> {
  return Object.entries(properties).reduce<Record<string, boolean | number | string>>((acc, [key, value]) => {
    if (value === null || value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
}

function capture(event: string, properties: AnalyticsProperties = {}): void {
  posthogClient?.capture(event, compactProperties(properties));
}

export const onboardingAnalytics = {
  started(properties: { is_first_launch: boolean }): void {
    capture('onboarding_started', properties);
  },

  stepViewed(properties: { step: string }): void {
    capture('onboarding_step_viewed', properties);
  },

  connectMethodSelected(properties: { method: ConnectMethod; source: string }): void {
    capture('onboarding_connect_method_selected', properties);
  },

  qrScanned(properties: { success: boolean; error_code?: string }): void {
    capture('onboarding_qr_scanned', properties);
  },

  manualSubmitted(properties: { has_url: boolean; has_token: boolean }): void {
    capture('onboarding_manual_submitted', properties);
  },

  connectionResolved(properties: {
    method: ConnectMethod;
    result: 'success' | 'failure';
    duration_ms: number;
    error_code?: string;
  }): void {
    capture('onboarding_connection_resolved', properties);
  },

  completed(properties: { method: ConnectMethod; total_duration_ms: number }): void {
    capture('onboarding_completed', properties);
  },

  skipped(properties: { step: string }): void {
    capture('onboarding_skipped', properties);
  },
};
