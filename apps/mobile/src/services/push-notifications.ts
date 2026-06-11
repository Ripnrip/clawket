/**
 * 🔔 The Herald's Bell — Push Notification Client
 *
 * "When the agent has tidings to share, this bell rings true across the void,
 *  rousing the seeker from afar. It speaks only when welcomed, never uninvited."
 *
 * - The Spellbinding Museum Director of Distant Tidings
 *
 * Client-side push notification plumbing for Clawket (Expo SDK 55 / iOS-first).
 * This file requests permission, fetches the RAW APNs device token, persists it,
 * and wires foreground/response listeners. It does NOT auto-run at boot — the
 * caller (a default-OFF settings toggle) decides when to register.
 *
 * 📮 Delivery model: a self-hosted Hermes backend sends pushes via APNs directly
 * (token-based .p8 auth), so we want the RAW APNs token from
 * getDevicePushTokenAsync() — NOT an Expo push token. See registerForPushNotifications.
 *
 * ⚠️ Boundary note: the raw APNs token is stored under its OWN key
 * (clawket.apnsPushToken.v1). Do NOT route it through the relay handshake's
 * `deviceToken` slot — that field is a relay auth credential, a different beast.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { StorageService } from './storage';
import { analyticsEvents } from './analytics/events';

// 🪟 Foreground presentation — SDK 53+ uses shouldShowBanner/shouldShowList
// (the old shouldShowAlert was retired). Set once at module load so it's
// installed before any notification can arrive.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = 'default';

export type ApnsPushToken = { type: 'ios' | 'android'; data: string };

export type RegistrationResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'permission-denied' | 'not-a-device' | 'no-token' | 'error'; error?: unknown };

export type PushListenerHandlers = {
  onReceived?: (notification: Notifications.Notification) => void;
  onResponse?: (response: Notifications.NotificationResponse) => void;
};

// 🌙 The Gatekeeper's Glance — peek at the current permission verdict
export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.status;
}

// 🔓 The Polite Knock — ask for permission only if not already decided.
// iOS reports finer state under settings.ios; the root status is our verdict.
export async function requestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (existing.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowProvisional: false, // explicit opt-in: show the real system prompt
      },
    });
    status = requested.status;
  }

  return status === 'granted';
}

// 📡 The Token Summons — fetch the raw APNs token (physical devices only;
// simulators have no APNs token, so we bail gracefully).
export async function getApnsDeviceToken(): Promise<ApnsPushToken | null> {
  if (!Device.isDevice) return null;
  const token = await Notifications.getDevicePushTokenAsync();
  return { type: token.type as 'ios' | 'android', data: String(token.data) };
}

// 📻 The Channel Forge — Android requires a channel; harmless no-op on iOS.
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * 🎫 The Grand Registration — Welcomes the seeker into the push circle.
 *
 * Call ONLY after the user opts in (feature default OFF). Order:
 *   channel → permission → raw APNs token → persist. Each gate can turn us
 *   back with a precise reason so the UI can explain what happened.
 */
export async function registerForPushNotifications(): Promise<RegistrationResult> {
  try {
    await ensureAndroidChannel();

    const granted = await requestNotificationPermission();
    analyticsEvents.pushPermissionRequested({
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      granted,
    });
    if (!granted) return { ok: false, reason: 'permission-denied' };

    const token = await getApnsDeviceToken();
    if (!token) {
      return { ok: false, reason: Device.isDevice ? 'no-token' : 'not-a-device' };
    }

    await StorageService.setApnsPushToken(token.data);
    await StorageService.setPushNotificationsEnabled(true);
    analyticsEvents.pushTokenRegistered({
      platform: token.type === 'ios' ? 'ios' : 'android',
    });

    return { ok: true, token: token.data };
  } catch (error) {
    return { ok: false, reason: 'error', error };
  }
}

// 🚪 The Graceful Exit — forget the token + flip the flag off. The caller
// should also tell the Hermes sender to drop the token (push.unregister).
export async function unregisterPushNotifications(): Promise<void> {
  await StorageService.setApnsPushToken(null);
  await StorageService.setPushNotificationsEnabled(false);
  analyticsEvents.pushNotificationsDisabled({});
}

// 📬 The Stored Scroll — hand the persisted token to whoever delivers it to Hermes
export async function getStoredApnsToken(): Promise<string | null> {
  return StorageService.getApnsPushToken();
}

/**
 * 👂 The Listening Ears — wire foreground-received + tap-response handlers.
 * Returns a cleanup fn; use it as the teardown in a useEffect.
 */
export function addPushListeners(handlers: PushListenerHandlers): () => void {
  const receivedSub = Notifications.addNotificationReceivedListener((n) => {
    handlers.onReceived?.(n);
  });
  const responseSub = Notifications.addNotificationResponseReceivedListener((r) => {
    handlers.onResponse?.(r);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
