import * as Haptics from 'expo-haptics';

/**
 * Light impact — for button taps, step transitions.
 * Haptics should never crash the app, so all calls are fire-and-forget
 * with silent error catching.
 */
export async function hapticLight(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silent — haptics should never crash
  }
}

/**
 * Medium impact — for method selection, more deliberate actions.
 */
export async function hapticMedium(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Silent
  }
}

/**
 * Success notification — for connection success.
 */
export async function hapticSuccess(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Silent
  }
}

/**
 * Error notification — for connection failure.
 */
export async function hapticError(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Silent
  }
}

/**
 * Selection feedback — for scrolling through options.
 */
export async function hapticSelection(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch {
    // Silent
  }
}
