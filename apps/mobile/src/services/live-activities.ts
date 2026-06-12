/**
 * 🎬 The Living Tapestry — Live Activities (ActivityKit) Bridge
 *
 * "On the lock screen and in the Dynamic Island, a small living portrait of the
 *  agent's labor — its title, its progress, its ticking clock. It appears only
 *  when summoned, and only when the stage has been built."
 *
 * - The Spellbinding Museum Director of Living Portraits
 *
 * ⚠️ SHIPS DARK. This module is intentionally inert in the current TestFlight
 * binary:
 *   1. The native `ClawketLiveActivity` module is NOT yet compiled in (the
 *      widget-extension target is added in a later dev-client build). We use
 *      `requireOptionalNativeModule`, which returns `null` instead of throwing
 *      when the native side is absent — so importing/calling this NEVER crashes.
 *   2. Even once the native module exists, nothing starts unless the
 *      `EXPO_PUBLIC_LIVE_ACTIVITIES_ENABLED` flag is on (default OFF).
 *
 * Both guards must pass for an Activity to ever begin. This makes the feature
 * safe to merge and archive long before the native target is wired up.
 *
 * Use case: a live portrait of a long-running agent task (title, status,
 * progress, elapsed time). Elapsed time is rendered OS-side from `startedAtMs`
 * (a SwiftUI `Text(_, style: .timer)`), so we never burn ActivityKit's update
 * budget ticking a clock from JS.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';
import { liveActivitiesEnabled } from '../config/public';

// 🪨 The Stage — null until the native widget target is compiled into the app.
// requireOptionalNativeModule returns null (never throws) when absent.
const NativeLiveActivity = requireOptionalNativeModule<NativeLiveActivityModule>('ClawketLiveActivity');

type NativeLiveActivityModule = {
  areActivitiesEnabled(): boolean;
  start(title: string, status: string, progress: number, startedAtMs: number): Promise<string>;
  update(id: string, status: string, progress: number): Promise<void>;
  end(id: string): Promise<void>;
};

export type AgentActivityState = {
  /** Static, set once at start — the task's headline. */
  title: string;
  /** Dynamic status line, e.g. "Running", "Tool: bash", "Finishing". */
  status: string;
  /** 0.0–1.0 progress for the bar. */
  progress: number;
};

/**
 * 🚦 The Master Switch — both the flag AND the native stage must be present.
 * Every public function funnels through this, so a dark build is a guaranteed
 * no-op. Also re-checks the OS-level `areActivitiesEnabled` (user can disable
 * Live Activities in Settings, and iOS < 16.2 has no ActivityKit).
 */
function canRun(): boolean {
  if (!liveActivitiesEnabled) return false;
  if (!NativeLiveActivity) return false;
  try {
    return NativeLiveActivity.areActivitiesEnabled();
  } catch {
    return false;
  }
}

/** Whether Live Activities can currently run (flag on + native present + OS-allowed). */
export function areLiveActivitiesAvailable(): boolean {
  return canRun();
}

const clampProgress = (p: number): number => Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));

/**
 * 🎭 Raise the Curtain — start a live portrait of an agent task.
 * Returns the activity id (to update/end later), or null if the feature is
 * dark / unavailable. Never throws.
 */
export async function startAgentActivity(state: AgentActivityState): Promise<string | null> {
  if (!canRun() || !NativeLiveActivity) return null;
  try {
    // startedAtMs handed to Swift so the OS renders the live elapsed timer.
    // Date.now() is fine in app runtime (only the workflow sandbox forbids it).
    return await NativeLiveActivity.start(
      state.title,
      state.status,
      clampProgress(state.progress),
      Date.now(),
    );
  } catch {
    return null;
  }
}

/**
 * 🖌️ Repaint the Portrait — update status + progress on a running activity.
 * Silently no-ops if dark/unavailable or the id is unknown.
 */
export async function updateAgentActivity(
  id: string,
  status: string,
  progress: number,
): Promise<void> {
  if (!canRun() || !NativeLiveActivity || !id) return;
  try {
    await NativeLiveActivity.update(id, status, clampProgress(progress));
  } catch {
    // Non-fatal: a missed update should never disrupt the chat.
  }
}

/**
 * 🌑 Lower the Curtain — end a running activity immediately.
 * Safe to call unconditionally (e.g. in cleanup), even in a dark build.
 */
export async function endAgentActivity(id: string): Promise<void> {
  if (!NativeLiveActivity || !id) return;
  try {
    await NativeLiveActivity.end(id);
  } catch {
    // Non-fatal.
  }
}
