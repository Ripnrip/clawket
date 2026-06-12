/**
 * 🧪 Trial of the Living Portrait — does the activity rise and fall with the run?
 *
 * Verifies useLiveActivityForRun starts an activity when a run begins, ends it
 * when the run stops, and cleans up on unmount — all without caring whether the
 * feature is actually live (the underlying service is mocked).
 */
import { act, renderHook } from '@testing-library/react-native';
import { useLiveActivityForRun } from './useLiveActivityForRun';
import * as liveActivities from '../../../services/live-activities';

jest.mock('../../../services/live-activities', () => ({
  startAgentActivity: jest.fn(() => Promise.resolve('act-1')),
  updateAgentActivity: jest.fn(() => Promise.resolve()),
  endAgentActivity: jest.fn(() => Promise.resolve()),
}));

const mocked = liveActivities as jest.Mocked<typeof liveActivities>;

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useLiveActivityForRun', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not start an activity while idle', async () => {
    renderHook(() => useLiveActivityForRun({ isRunning: false, title: 'T' }));
    await flush();
    expect(mocked.startAgentActivity).not.toHaveBeenCalled();
  });

  it('starts an activity when a run begins', async () => {
    const { rerender } = renderHook(
      ({ running }: { running: boolean }) =>
        useLiveActivityForRun({ isRunning: running, title: 'Deploy', status: 'gpt-5' }),
      { initialProps: { running: false } },
    );

    rerender({ running: true });
    await flush();

    expect(mocked.startAgentActivity).toHaveBeenCalledTimes(1);
    expect(mocked.startAgentActivity).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Deploy', status: 'gpt-5' }),
    );
  });

  it('ends the activity when the run stops', async () => {
    const { rerender } = renderHook(
      ({ running }: { running: boolean }) =>
        useLiveActivityForRun({ isRunning: running, title: 'T' }),
      { initialProps: { running: true } },
    );
    await flush(); // let start() resolve and store the id

    rerender({ running: false });
    await flush();

    expect(mocked.endAgentActivity).toHaveBeenCalledWith('act-1');
  });

  it('ends a running activity on unmount', async () => {
    const { unmount } = renderHook(() =>
      useLiveActivityForRun({ isRunning: true, title: 'T' }),
    );
    await flush();

    unmount();
    expect(mocked.endAgentActivity).toHaveBeenCalledWith('act-1');
  });

  it('does not double-start when title/status change mid-run', async () => {
    const { rerender } = renderHook(
      ({ status }: { status: string }) =>
        useLiveActivityForRun({ isRunning: true, title: 'T', status }),
      { initialProps: { status: 'a' } },
    );
    await flush();

    rerender({ status: 'b' });
    await flush();

    expect(mocked.startAgentActivity).toHaveBeenCalledTimes(1);
    expect(mocked.updateAgentActivity).toHaveBeenCalled();
  });
});
