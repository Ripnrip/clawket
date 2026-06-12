/**
 * 🧪 The Dark-Stage Trial — proving Live Activities are truly inert until summoned
 *
 * The whole point of this scaffold is that it SHIPS DARK: with no native module
 * compiled in (the current binary) and the flag OFF, every call must be a safe
 * no-op that never throws and never starts an activity. These tests lock that
 * guarantee in so a future change can't accidentally light the stage early. 🛡️
 *
 * NOTE: the service captures `requireOptionalNativeModule(...)` at import time
 * (top-level const), so each test re-imports the module via jest.isolateModules
 * after configuring the flag + native mock. That mirrors real app startup, where
 * the native stage either exists or doesn't when the bundle first loads.
 */

let mockFlag = false;
let mockNative: null | {
  areActivitiesEnabled: jest.Mock;
  start: jest.Mock;
  update: jest.Mock;
  end: jest.Mock;
};

jest.mock('../config/public', () => ({
  get liveActivitiesEnabled() {
    return mockFlag;
  },
}));

jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: () => mockNative,
}));

type LiveActivitiesModule = typeof import('./live-activities');

// Re-import the service fresh so the top-level requireOptionalNativeModule()
// binds to the current mockNative.
function loadService(): LiveActivitiesModule {
  let mod!: LiveActivitiesModule;
  jest.isolateModules(() => {
    mod = require('./live-activities');
  });
  return mod;
}

function makeNative(enabled = true) {
  return {
    areActivitiesEnabled: jest.fn(() => enabled),
    start: jest.fn(() => Promise.resolve('act-1')),
    update: jest.fn(() => Promise.resolve()),
    end: jest.fn(() => Promise.resolve()),
  };
}

describe('live-activities (ships dark)', () => {
  beforeEach(() => {
    mockFlag = false;
    mockNative = null;
    jest.clearAllMocks();
  });

  describe('dark build: no native module', () => {
    it('reports unavailable even with the flag on', () => {
      mockFlag = true; // flag on, but native absent
      const svc = loadService();
      expect(svc.areLiveActivitiesAvailable()).toBe(false);
    });

    it('startAgentActivity returns null and never throws', async () => {
      mockFlag = true;
      const svc = loadService();
      await expect(
        svc.startAgentActivity({ title: 'T', status: 'S', progress: 0.5 }),
      ).resolves.toBeNull();
    });

    it('update/end are safe no-ops', async () => {
      const svc = loadService();
      await expect(svc.updateAgentActivity('x', 'S', 0.2)).resolves.toBeUndefined();
      await expect(svc.endAgentActivity('x')).resolves.toBeUndefined();
    });
  });

  describe('flag OFF but native present', () => {
    it('stays dark — no activity starts even though the stage exists', async () => {
      mockNative = makeNative(true);
      mockFlag = false;
      const svc = loadService();

      expect(svc.areLiveActivitiesAvailable()).toBe(false);
      expect(await svc.startAgentActivity({ title: 'T', status: 'S', progress: 0 })).toBeNull();
      expect(mockNative.start).not.toHaveBeenCalled();
    });
  });

  describe('flag ON + native present + OS allows', () => {
    it('reports available and starts an activity', async () => {
      mockNative = makeNative(true);
      mockFlag = true;
      const svc = loadService();

      expect(svc.areLiveActivitiesAvailable()).toBe(true);
      const id = await svc.startAgentActivity({ title: 'Deploy', status: 'Running', progress: 0.25 });
      expect(id).toBe('act-1');
      expect(mockNative.start).toHaveBeenCalledTimes(1);
      expect(mockNative.start).toHaveBeenCalledWith('Deploy', 'Running', 0.25, expect.any(Number));
    });

    it('clamps out-of-range progress to [0,1]', async () => {
      mockNative = makeNative(true);
      mockFlag = true;
      const svc = loadService();

      await svc.startAgentActivity({ title: 'T', status: 'S', progress: 5 });
      expect(mockNative.start).toHaveBeenCalledWith('T', 'S', 1, expect.any(Number));

      await svc.updateAgentActivity('act-1', 'S2', -3);
      expect(mockNative.update).toHaveBeenCalledWith('act-1', 'S2', 0);
    });

    it('does not run when the OS disabled Live Activities', async () => {
      mockNative = makeNative(false); // areActivitiesEnabled() -> false
      mockFlag = true;
      const svc = loadService();

      expect(svc.areLiveActivitiesAvailable()).toBe(false);
      expect(await svc.startAgentActivity({ title: 'T', status: 'S', progress: 0 })).toBeNull();
    });

    it('swallows native errors and returns null', async () => {
      mockNative = makeNative(true);
      mockNative.start.mockRejectedValueOnce(new Error('boom'));
      mockFlag = true;
      const svc = loadService();

      await expect(svc.startAgentActivity({ title: 'T', status: 'S', progress: 0 })).resolves.toBeNull();
    });

    it('endAgentActivity works even when the flag is off (cleanup path)', async () => {
      mockNative = makeNative(true);
      mockFlag = false; // end should still attempt, since cleanup must always work
      const svc = loadService();

      await svc.endAgentActivity('act-1');
      expect(mockNative.end).toHaveBeenCalledWith('act-1');
    });
  });
});
