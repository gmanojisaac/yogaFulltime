export interface TrialTimer {
  checkpointId: string;
  remainingMs: number;
  activeMs: number;
  lastTick: number | null;
  state: "paused" | "running" | "ended";
}
export function newTimer(checkpointId: string, seconds: number): TrialTimer {
  return {
    checkpointId,
    remainingMs: seconds * 1000,
    activeMs: 0,
    lastTick: null,
    state: "paused",
  };
}
export function tickTimer(
  timer: TrialTimer,
  now: number,
  visible = true,
): TrialTimer {
  if (timer.state !== "running" || timer.lastTick === null) return timer;
  if (!visible) return { ...timer, state: "paused", lastTick: null };
  const elapsed = Math.min(
    timer.remainingMs,
    Math.max(0, now - timer.lastTick),
  );
  const remainingMs = timer.remainingMs - elapsed;
  return {
    ...timer,
    remainingMs,
    activeMs: timer.activeMs + elapsed,
    lastTick: remainingMs ? now : null,
    state: remainingMs ? "running" : "ended",
  };
}
export function pauseTimer(timer: TrialTimer, now: number): TrialTimer {
  const advanced = tickTimer(timer, now);
  return {
    ...advanced,
    state: advanced.remainingMs > 0 ? "paused" : "ended",
    lastTick: null,
  };
}
export function startTimer(timer: TrialTimer, now: number): TrialTimer {
  return timer.remainingMs <= 0
    ? timer
    : { ...timer, state: "running", lastTick: now };
}
export function restoreTimer(timer: TrialTimer): TrialTimer {
  return {
    ...timer,
    state: timer.remainingMs > 0 ? "paused" : "ended",
    lastTick: null,
  };
}
export function timerLabel(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
