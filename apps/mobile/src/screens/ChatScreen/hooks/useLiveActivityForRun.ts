/**
 * 🎬 useLiveActivityForRun — bind a Live Activity to an agent run's lifecycle
 *
 * "While the agent labors, a small living portrait glows on the Lock Screen;
 *  when the work is done — by triumph, by halt, or by storm — the curtain falls."
 *
 * Watches a single `isRunning` boolean (the unified run-active signal — `isSending`
 * for Hermes via useChatController, or AZ's `sending`) and drives
 * start/end of an ActivityKit Live Activity.
 *
 * 🛡️ Ships dark: live-activities.ts is double-guarded (native module present +
 * EXPO_PUBLIC_LIVE_ACTIVITIES_ENABLED flag), so in the current binary every call
 * here is a safe no-op. This hook just decides WHEN to call — it never assumes
 * the feature is live.
 *
 * Backend-agnostic by design: callers pass the boolean + a title, so the same
 * hook serves both the Hermes chat controller and the Agent Zero tab.
 */
import { useEffect, useRef } from 'react';
import {
  startAgentActivity,
  updateAgentActivity,
  endAgentActivity,
} from '../../../services/live-activities';

type Params = {
  /** True while an agent run is active (Hermes `isSending` / AZ `sending`). */
  isRunning: boolean;
  /** Headline for the activity — usually the session/chat label. */
  title: string;
  /** Optional status line (e.g. current model, "Streaming…"). */
  status?: string;
};

export function useLiveActivityForRun({ isRunning, title, status }: Params): void {
  const activityIdRef = useRef<string | null>(null);
  const startingRef = useRef(false);

  // 🎭 Raise/lower the curtain as the run flips on and off.
  useEffect(() => {
    if (isRunning) {
      // Guard against double-starts while an async start() is in flight.
      if (activityIdRef.current || startingRef.current) return;
      startingRef.current = true;
      void startAgentActivity({
        title: title || 'Agent task',
        status: status || 'Running…',
        progress: 0,
      })
        .then((id) => {
          // If the run already ended while we were starting, end immediately.
          if (!isRunning && id) {
            void endAgentActivity(id);
            activityIdRef.current = null;
          } else {
            activityIdRef.current = id;
          }
        })
        .finally(() => {
          startingRef.current = false;
        });
    } else if (activityIdRef.current) {
      void endAgentActivity(activityIdRef.current);
      activityIdRef.current = null;
    }
  }, [isRunning, title, status]);

  // 🖌️ Keep the status/title fresh on a running activity (no extra start).
  useEffect(() => {
    if (!isRunning || !activityIdRef.current) return;
    void updateAgentActivity(activityIdRef.current, status || 'Running…', 0);
  }, [isRunning, status]);

  // 🧹 Safety net: end any live activity if the screen unmounts mid-run.
  useEffect(() => {
    return () => {
      if (activityIdRef.current) {
        void endAgentActivity(activityIdRef.current);
        activityIdRef.current = null;
      }
    };
  }, []);
}
