/**
 * 🧪 The Herald's Trial — proving the push bell rings only when welcomed
 *
 * Covers the opt-in registration flow, permission gating, raw-APNs-token path,
 * simulator guard, persistence, and listener cleanup. expo-notifications and
 * expo-device are mocked locally so we never touch a real device or APNs. 🛡️
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
  requestNotificationPermission,
  getApnsDeviceToken,
  addPushListeners,
  getStoredApnsToken,
} from './push-notifications';
import { StorageService } from './storage';

// Local, richer mocks than jest.setup (which lacks getDevicePushTokenAsync etc.)
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3 },
}));

// Backing flag so individual tests can flip simulator vs device.
const deviceState = { isDevice: true };
jest.mock('expo-device', () => ({
  get isDevice() {
    return deviceState.isDevice;
  },
}));

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('push-notifications service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await StorageService.setApnsPushToken(null);
    await StorageService.setPushNotificationsEnabled(false);
    deviceState.isDevice = true;
  });

  describe('requestNotificationPermission', () => {
    it('returns true without re-prompting when already granted', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);

      const granted = await requestNotificationPermission();

      expect(granted).toBe(true);
      expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('prompts when undetermined and honors the result', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
      mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);

      const granted = await requestNotificationPermission();

      expect(granted).toBe(true);
      expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('returns false when the user denies', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
      mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

      expect(await requestNotificationPermission()).toBe(false);
    });
  });

  describe('getApnsDeviceToken', () => {
    it('returns the raw APNs token on a physical device', async () => {
      mockedNotifications.getDevicePushTokenAsync.mockResolvedValue({ type: 'ios', data: 'abc123' } as never);

      expect(await getApnsDeviceToken()).toEqual({ type: 'ios', data: 'abc123' });
    });

    it('returns null on a simulator (no APNs token)', async () => {
      deviceState.isDevice = false;

      expect(await getApnsDeviceToken()).toBeNull();
      expect(mockedNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
    });
  });

  describe('registerForPushNotifications', () => {
    it('registers, persists the token, and flips the opt-in flag', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
      mockedNotifications.getDevicePushTokenAsync.mockResolvedValue({ type: 'ios', data: 'tok-789' } as never);
      const setToken = jest.spyOn(StorageService, 'setApnsPushToken');
      const setEnabled = jest.spyOn(StorageService, 'setPushNotificationsEnabled');

      const result = await registerForPushNotifications();

      expect(result).toEqual({ ok: true, token: 'tok-789' });
      // SecureStore is a stateless stub in tests, so assert the persistence calls
      expect(setToken).toHaveBeenCalledWith('tok-789');
      expect(setEnabled).toHaveBeenCalledWith(true);
      setToken.mockRestore();
      setEnabled.mockRestore();
    });

    it('stops at permission-denied without fetching a token', async () => {
      mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as never);
      mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);

      const result = await registerForPushNotifications();

      expect(result).toEqual({ ok: false, reason: 'permission-denied' });
      expect(mockedNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
      expect(await getStoredApnsToken()).toBeNull();
    });

    it('reports not-a-device on a simulator', async () => {
      deviceState.isDevice = false;
      mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);

      const result = await registerForPushNotifications();

      expect(result).toEqual({ ok: false, reason: 'not-a-device' });
    });

    it('returns an error result when registration throws', async () => {
      mockedNotifications.getPermissionsAsync.mockRejectedValue(new Error('kaboom'));

      const result = await registerForPushNotifications();

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('error');
    });
  });

  describe('unregisterPushNotifications', () => {
    it('clears the token and disables the flag', async () => {
      const setToken = jest.spyOn(StorageService, 'setApnsPushToken');
      const setEnabled = jest.spyOn(StorageService, 'setPushNotificationsEnabled');

      await unregisterPushNotifications();

      expect(setToken).toHaveBeenCalledWith(null);
      expect(setEnabled).toHaveBeenCalledWith(false);
      setToken.mockRestore();
      setEnabled.mockRestore();
    });
  });

  describe('addPushListeners', () => {
    it('wires both listeners and removes them via the cleanup fn', () => {
      const receivedRemove = jest.fn();
      const responseRemove = jest.fn();
      mockedNotifications.addNotificationReceivedListener.mockReturnValue({ remove: receivedRemove } as never);
      mockedNotifications.addNotificationResponseReceivedListener.mockReturnValue({ remove: responseRemove } as never);

      const cleanup = addPushListeners({ onReceived: jest.fn(), onResponse: jest.fn() });

      expect(mockedNotifications.addNotificationReceivedListener).toHaveBeenCalledTimes(1);
      expect(mockedNotifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);

      cleanup();
      expect(receivedRemove).toHaveBeenCalledTimes(1);
      expect(responseRemove).toHaveBeenCalledTimes(1);
    });
  });
});
