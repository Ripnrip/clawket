jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// requestIdleCallback is not available in Node.js test env
if (typeof requestIdleCallback === 'undefined') {
  (globalThis as any).requestIdleCallback = (cb: () => void) => cb();
}

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

jest.mock('../constants/app-version', () => ({
  APP_PACKAGE_VERSION: '1.2.3',
}));

jest.mock('./storage', () => ({
  StorageService: {
    getAutoAppReviewState: jest.fn(),
    setAutoAppReviewState: jest.fn(),
  },
}));

import * as StoreReview from 'expo-store-review';
import { scheduleAutomaticAppReview, shouldAttemptAutomaticReview } from './auto-app-review';
import { StorageService } from './storage';

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('auto app review', () => {
  const mockedStoreReview = StoreReview as jest.Mocked<typeof StoreReview>;
  const mockedStorage = StorageService as jest.Mocked<typeof StorageService>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('requires at least one day of use before attempting', () => {
    expect(shouldAttemptAutomaticReview({
      nowMs: 2 * 24 * 60 * 60 * 1000,
      appVersion: '1.2.3',
      state: {
        firstSeenAtMs: 24 * 60 * 60 * 1000 + 1,
      },
    })).toBe(false);
  });

  it('blocks repeated attempts in the same app version', () => {
    expect(shouldAttemptAutomaticReview({
      nowMs: 100 * 24 * 60 * 60 * 1000,
      appVersion: '1.2.3',
      state: {
        firstSeenAtMs: 1,
        lastAttemptAtMs: 99 * 24 * 60 * 60 * 1000,
        lastAttemptVersion: '1.2.3',
      },
    })).toBe(false);
  });

  it('blocks repeated attempts within thirty days', () => {
    expect(shouldAttemptAutomaticReview({
      nowMs: 100 * 24 * 60 * 60 * 1000,
      appVersion: '1.2.4',
      state: {
        firstSeenAtMs: 1,
        lastAttemptAtMs: 80 * 24 * 60 * 60 * 1000 + 1,
        lastAttemptVersion: '1.2.2',
      },
    })).toBe(false);
  });

  it('stores first-seen time instead of prompting on the first eligible trigger', async () => {
    mockedStorage.getAutoAppReviewState.mockResolvedValueOnce(null);

    scheduleAutomaticAppReview('agent_created', { delayMs: 0 });
    jest.runAllTimers();
    await flushMicrotasks();

    expect(mockedStorage.setAutoAppReviewState).toHaveBeenCalledWith({
      firstSeenAtMs: expect.any(Number),
    });
    expect(mockedStoreReview.requestReview).not.toHaveBeenCalled();
  });

  it('requests review and records the attempt when all gates pass', async () => {
    mockedStorage.getAutoAppReviewState.mockResolvedValueOnce({
      firstSeenAtMs: Date.now() - 2 * 24 * 60 * 60 * 1000,
    });
    mockedStoreReview.isAvailableAsync.mockResolvedValueOnce(true);
    mockedStoreReview.requestReview.mockResolvedValueOnce();

    scheduleAutomaticAppReview('cron_created', { delayMs: 0 });
    jest.runAllTimers();
    await flushMicrotasks();

    expect(mockedStoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(mockedStorage.setAutoAppReviewState).toHaveBeenCalledWith({
      firstSeenAtMs: expect.any(Number),
      lastAttemptAtMs: expect.any(Number),
      lastAttemptVersion: '1.2.3',
    });
  });
});
