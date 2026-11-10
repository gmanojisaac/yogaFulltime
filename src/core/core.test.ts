import { describe, expect, it } from "vitest";
import {
  checkpoints,
  contentDiagnostics,
  gradeCheckpoints,
  grades,
  poses,
} from "../content";
import { clock, createSchedule, scheduledInstant } from "./schedule";
import {
  newTimer,
  pauseTimer,
  restoreTimer,
  startTimer,
  tickTimer,
} from "./timer";
import {
  counts,
  emptyProgress,
  makeAttempt,
  makeDay,
  mergeProgress,
  parseProgress,
  recordsFor,
  restoreProgress,
  saveOutcome,
  STORAGE_KEY,
} from "./progress";
import { loadProgress, writeProgress } from "./storage";

function fixture() {
  const state = emptyProgress();
  const attempt = makeAttempt(
    "g01",
    state.settings,
    Date.parse("2026-11-10T04:00:00Z"),
  );
  return {
    ...state,
    setupDone: true,
    activeAttemptId: attempt.id,
    attempts: [attempt],
  };
}
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}
describe("supplied curriculum", () => {
  it("validates every reference and exact programme counts", () => {
    expect(contentDiagnostics()).toEqual([]);
    expect(grades).toHaveLength(10);
    expect(poses).toHaveLength(30);
    expect(checkpoints).toHaveLength(1200);
    for (const g of grades) expect(gradeCheckpoints(g.id)).toHaveLength(120);
  });
  it("keeps teacher-guided grades and hour ten free of physical timers", () => {
    expect(
      checkpoints
        .filter(
          (c) => Number(c.gradeId.slice(1)) >= 9 || c.hourId.endsWith("h10"),
        )
        .every((c) => c.trialWindowSeconds === 0),
    ).toBe(true);
    expect(new Set(checkpoints.map((c) => c.trialWindowSeconds))).toEqual(
      new Set([0, 60, 120]),
    );
  });
});
describe("elapsed scheduling", () => {
  it("uses the chosen timezone and continues across midnight", () => {
    const s = createSchedule("2026-11-10", "20:00", "Asia/Kolkata");
    expect(s.startsAt).toBe("2026-11-10T14:30:00Z");
    expect(clock(scheduledInstant(s, 600), s.timeZone, true)).toContain("11");
    expect(clock(scheduledInstant(s, 600), s.timeZone)).toBe("06:00");
  });
  it("adds ten elapsed hours across a DST change", () => {
    const s = createSchedule("2026-03-08", "00:00", "America/New_York");
    const end = scheduledInstant(s, 600);
    expect(Date.parse(end) - Date.parse(s.startsAt)).toBe(36000000);
    expect(clock(end, s.timeZone)).toBe("11:00");
  });
  it("rejects nonexistent and ambiguous local clock times", () => {
    expect(() =>
      createSchedule("2026-03-08", "02:30", "America/New_York"),
    ).toThrow();
    expect(() =>
      createSchedule("2026-11-01", "01:30", "America/New_York"),
    ).toThrow();
  });
  it("preserves historical starts and record timestamps across new settings", () => {
    const state = fixture();
    const first = state.attempts[0];
    const recorded = saveOutcome(
      first,
      "observed",
      "Comfortable",
      "observe",
      false,
    );
    const secondDay = makeDay(
      first.gradeId,
      { ...state.settings, timeZone: "Europe/London", startTime: "09:30" },
      Date.parse("2026-11-11T06:00:00Z"),
    );
    const continued = { ...recorded, days: [...recorded.days, secondDay] };
    expect(continued.days[0].startsAt).toBe(first.days[0].startsAt);
    expect(recordsFor(continued)[first.cursor].recordedAt).toBe(
      recordsFor(recorded)[first.cursor].recordedAt,
    );
  });
});
describe("explicit physical trials", () => {
  it("waits for explicit start, pauses, and resumes remaining time", () => {
    const t = newTimer("g01-h01-c04", 120);
    expect(tickTimer(t, 10000)).toEqual(t);
    const paused = pauseTimer(startTimer(t, 1000), 11000);
    expect(paused.remainingMs).toBe(110000);
    expect(paused.activeMs).toBe(10000);
    const resumed = tickTimer(startTimer(paused, 100000), 105000);
    expect(resumed.remainingMs).toBe(105000);
    expect(resumed.activeMs).toBe(15000);
  });
  it("never adds hidden or reload time", () => {
    const active = tickTimer(
      startTimer(newTimer("g01-h01-c04", 120), 1000),
      5000,
    );
    const hidden = tickTimer(active, 1000000, false);
    expect(hidden.activeMs).toBe(4000);
    expect(hidden.state).toBe("paused");
    const restored = restoreTimer(active);
    expect(restored.lastTick).toBeNull();
    expect(tickTimer(restored, 2000000).activeMs).toBe(4000);
  });
  it("caps delayed ticks and ends without completing a checkpoint", () => {
    const timer = tickTimer(
      startTimer(newTimer("g01-h01-c04", 60), 0),
      1000000,
    );
    expect(timer.activeMs).toBe(60000);
    expect(timer.remainingMs).toBe(0);
    expect(timer.state).toBe("ended");
    expect(counts(fixture().attempts[0]).total).toBe(0);
    expect(pauseTimer(timer, 2000000).state).toBe("ended");
  });
});
describe("progress and persistence", () => {
  it("records outcomes once and keeps skips separate from completion", () => {
    const a = fixture().attempts[0];
    const skipped = saveOutcome(a, "skipped", "Rest day", "observe", false);
    const revisited = saveOutcome(
      skipped,
      "completed",
      "Attempted overwrite",
      "both",
      false,
    );
    expect(revisited).toEqual(skipped);
    expect(counts(revisited).total).toBe(1);
    expect(counts(revisited).completed).toBe(0);
    expect(counts(revisited).skipped).toBe(1);
  });
  it("round-trips notes, modifications and paused timers", () => {
    const state = fixture();
    let a = saveOutcome(
      state.attempts[0],
      "modified",
      "Used a folded blanket & support.",
      "both",
      false,
    );
    a = {
      ...a,
      cursor: "g01-h01-c04",
      timer: tickTimer(startTimer(newTimer("g01-h01-c04", 120), 1000), 6000),
      journal: "Take this question to my teacher.",
    };
    const restored = restoreProgress(
      parseProgress(JSON.stringify({ ...state, attempts: [a] })),
    );
    expect(recordsFor(restored.attempts[0])["g01-h01-c01"].note).toContain(
      "blanket",
    );
    expect(restored.attempts[0].journal).toBe(a.journal);
    expect(restored.attempts[0].timer?.state).toBe("paused");
    expect(restored.attempts[0].timer?.activeMs).toBe(5000);
  });
  it("preserves prior attempts when repeating a grade", () => {
    const state = fixture();
    const a = saveOutcome(
      state.attempts[0],
      "completed",
      "First attempt",
      "both",
      false,
    );
    const repeated = makeAttempt("g01", state.settings);
    const next = parseProgress(
      JSON.stringify({
        ...state,
        attempts: [a, repeated],
        activeAttemptId: repeated.id,
      }),
    );
    expect(counts(next.attempts[0]).completed).toBe(1);
    expect(counts(next.attempts[1]).total).toBe(0);
    expect(next.attempts[0].id).not.toBe(next.attempts[1].id);
  });
  it("merges matching attempts and checkpoints without duplicate counts", () => {
    const state = fixture();
    const local = {
      ...state,
      attempts: [
        saveOutcome(
          state.attempts[0],
          "observed",
          "Local note",
          "observe",
          false,
        ),
      ],
    };
    const incoming = {
      ...state,
      attempts: [
        saveOutcome(
          { ...state.attempts[0], cursor: "g01-h01-c02" },
          "completed",
          "Imported note",
          "both",
          false,
        ),
      ],
    };
    const merged = mergeProgress(local, incoming);
    expect(counts(merged.attempts[0]).total).toBe(2);
    expect(counts(mergeProgress(merged, incoming).attempts[0]).total).toBe(2);
    expect(
      Object.values(recordsFor(merged.attempts[0])).map((r) => r.note),
    ).toEqual(expect.arrayContaining(["Local note", "Imported note"]));
  });
  it("rejects malformed IDs, foreign records, HTML, oversized and wrong-version files", () => {
    const state = fixture();
    const a = saveOutcome(
      state.attempts[0],
      "completed",
      "Safe",
      "both",
      false,
    );
    const valid = { ...state, attempts: [a] };
    expect(() =>
      parseProgress(JSON.stringify({ ...state, schemaVersion: 8 })),
    ).toThrow();
    expect(() =>
      parseProgress(
        JSON.stringify({
          ...state,
          attempts: [{ ...a, cursor: "g99-h01-c01" }],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseProgress(
        JSON.stringify({
          ...state,
          attempts: [{ ...a, journal: "<script>alert(1)</script>" }],
        }),
      ),
    ).toThrow();
    const bad = structuredClone(valid);
    bad.attempts[0].days[0].records[a.cursor].dayId = crypto.randomUUID();
    expect(() => parseProgress(JSON.stringify(bad))).toThrow();
    expect(() => parseProgress(" ".repeat(5 * 1024 * 1024 + 1))).toThrow(
      /smaller/,
    );
  });
  it("detects concurrent writes without replacing the other tab", () => {
    const storage = memoryStorage();
    const state = fixture();
    const saved = writeProgress(storage, state, null);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const first = writeProgress(storage, saved.data, saved.data.commitId);
    expect(first.ok).toBe(true);
    const stale = writeProgress(storage, saved.data, saved.data.commitId);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.conflict).toBeDefined();
  });
  it("handles full or corrupt storage without replacing it", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
    };
    expect(writeProgress(storage, fixture(), null).ok).toBe(false);
    const corrupt = memoryStorage();
    corrupt.setItem(STORAGE_KEY, "{invalid");
    const loaded = loadProgress(corrupt);
    expect(loaded.error).toBeTruthy();
    expect(corrupt.getItem(STORAGE_KEY)).toBe("{invalid");
  });
});
