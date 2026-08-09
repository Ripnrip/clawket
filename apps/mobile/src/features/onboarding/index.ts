// Barrel export for the onboarding feature
export { OnboardingNavigator } from './OnboardingNavigator';
export type { OnboardingStackParamList } from './OnboardingNavigator';

export { WelcomeScreen } from './WelcomeScreen';
export { ConnectMethodScreen } from './ConnectMethodScreen';
export { ManualEntryScreen } from './ManualEntryScreen';
export { ConnectingScreen } from './ConnectingScreen';
export { ComingSoonScreen } from './ComingSoonScreen';
export { SuccessScreen } from './SuccessScreen';

export { shouldShowOnboarding } from './shouldShowOnboarding';

export { onboardingAnalytics } from './onboardingAnalytics';

export {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticError,
  hapticSelection,
} from './haptics';

export {
  OnboardingStep,
} from './types';
export type {
  ConnectMethod,
  OnboardingState,
  OnboardingError,
  OnboardingComplete,
  OnboardingSkip,
  ConnectionResult,
} from './types';
