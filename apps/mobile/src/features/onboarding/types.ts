import type { GatewayConfig } from '../../types';

/**
 * The ordered steps in the onboarding flow.
 * The navigator transitions between these based on user choices.
 */
export enum OnboardingStep {
  /** Landing screen with welcome message and Get Started button. */
  Welcome = 'welcome',
  /** Connection method picker (QR, nearby, manual, deeplink). */
  ConnectMethod = 'connectMethod',
  /** QR scanner is active. */
  Scanning = 'scanning',
  /** Manual URL + token entry form. */
  ManualEntry = 'manualEntry',
  /** Attempting to connect / validate the gateway config. */
  Connecting = 'connecting',
  /** Connection succeeded — show success screen. */
  Success = 'success',
}

/** How the user chose to connect to their gateway. */
export type ConnectMethod = 'qr' | 'nearby' | 'manual' | 'deeplink';

/** Result of a connection attempt during onboarding. */
export type ConnectionResult = 'success' | 'failure';

/** Error metadata when a connection fails. */
export interface OnboardingError {
  /** Machine-readable error code for analytics. */
  code: string;
  /** Human-readable message shown to the user. */
  message: string;
}

/** Internal onboarding state managed by the navigator. */
export interface OnboardingState {
  currentStep: OnboardingStep;
  selectedMethod: ConnectMethod | null;
  connectionResult: ConnectionResult | null;
  /** Timestamp (ms) when the onboarding flow started — used for duration analytics. */
  startedAt: number;
  /** Timestamp (ms) when the connection attempt began — used for connection duration analytics. */
  connectionStartedAt: number | null;
  /** The gateway config that was successfully connected (if any). */
  resolvedConfig: GatewayConfig | null;
  /** Error from the last connection attempt (if any). */
  error: OnboardingError | null;
}

/** Called when onboarding completes successfully. */
export type OnboardingComplete = (config: GatewayConfig) => void;

/** Called when onboarding is skipped or dismissed. */
export type OnboardingSkip = () => void;
