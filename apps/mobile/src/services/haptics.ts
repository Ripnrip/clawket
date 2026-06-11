import * as Haptics from 'expo-haptics';

function fireAndForget(task: Promise<unknown> | void): void {
  void Promise.resolve(task).catch(() => {});
}

export function triggerLightImpact(): void {
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function triggerRigidImpact(): void {
  fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
}

export function triggerSelectionHaptic(): void {
  fireAndForget(Haptics.selectionAsync());
}

// 🎉 The Triumphant Buzz — a gentle success purr for a job well done
export function triggerSuccessHaptic(): void {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

// 🌙 The Cautionary Hum — a soft nudge when something needs a second glance
export function triggerWarningHaptic(): void {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

// 🌩️ The Stormy Rumble — a firm tap when the show hits a temporary intermission
export function triggerErrorHaptic(): void {
  fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export function triggerDragStartHaptic(): void {
  triggerLightImpact();
}

export function triggerDragEndHaptic(): void {
  triggerLightImpact();
}
