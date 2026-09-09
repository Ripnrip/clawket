import { StorageService } from '../../services/storage';

/**
 * Determines whether the onboarding flow should be shown.
 *
 * Returns `true` if:
 * - No gateway config has been saved yet, OR
 * - Onboarding has never been completed before (first launch)
 *
 * Returns `false` once the user has both completed onboarding
 * AND has a gateway config saved.
 */
export async function shouldShowOnboarding(): Promise<boolean> {
  const [onboardingCompleted, hasConfig] = await Promise.all([
    StorageService.isOnboardingCompleted(),
    StorageService.getGatewayConfig(),
  ]);

  // If onboarding was explicitly completed, don't show it again
  if (onboardingCompleted) return false;

  // If there's already a valid config, the user has set up before
  // — skip onboarding even if the flag wasn't set (upgrade scenario)
  if (hasConfig?.url) return false;

  return true;
}
