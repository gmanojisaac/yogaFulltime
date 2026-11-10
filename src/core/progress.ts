import { z } from "zod";
import { checkpointById, gradeById, gradeCheckpoints } from "../content";
import { createSchedule, localDate, validTimeZone } from "./schedule";
import { restoreTimer } from "./timer";
import type { TrialTimer } from "./timer";

export const STORAGE_KEY = "yoga10.progress.v1";
const text = z
  .string()
  .max(2000)
  .refine(
    (s) => !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s),
    "Use plain text without HTML.",
  );
const uuid = z.string().uuid();
const iso = z.string().datetime({ offset: true });
const gradeId = z
  .string()
  .regex(/^g(0[1-9]|10)$/)
  .refine((id) => Object.hasOwn(gradeById, id), "Unknown grade.");
const checkpointId = z
  .string()
  .regex(/^g(0[1-9]|10)-h(0[1-9]|10)-c(0[1-9]|1[0-2])$/)
  .refine((id) => Object.hasOwn(checkpointById, id), "Unknown checkpoint.");
const timeZone = z.string().max(100).refine(validTimeZone, "Invalid timezone.");
export const settingsSchema = z
  .object({
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timeZone,
    reducedMotion: z.boolean(),
    sound: z.boolean(),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export const outcomeSchema = z.enum([
  "completed",
  "observed",
  "modified",
  "skipped",
  "discomfort",
]);
export type Outcome = z.infer<typeof outcomeSchema>;
const recordSchema = z
  .object({
    checkpointId,
    attemptId: uuid,
    dayId: uuid,
    outcome: outcomeSchema,
    recordedAt: iso,
    activeTrialMs: z.number().min(0).max(120000),
    note: text,
    side: z.enum(["both", "left", "right", "observe"]),
    attendance: z.boolean(),
  })
  .strict();
const scheduleSchema = z
  .object({
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: settingsSchema.shape.startTime,
    timeZone,
    startsAt: iso,
  })
  .strict();
const daySchema = scheduleSchema
  .extend({
    id: uuid,
    gradeId,
    createdAt: iso,
    records: z.record(z.string(), recordSchema),
    learningMs: z.number().min(0).max(1000000000).default(0),
    activeTrialMs: z.number().min(0).max(100000000),
    reschedules: z
      .array(
        z
          .object({
            at: iso,
            schedule: scheduleSchema,
            checkpointIds: z.array(checkpointId).max(120),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
const timerSchema = z
  .object({
    checkpointId,
    remainingMs: z.number().min(0).max(120000),
    activeMs: z.number().min(0).max(120000),
    lastTick: z.number().nullable(),
    state: z.enum(["paused", "running", "ended"]),
  })
  .strict();
const attemptSchema = z
  .object({
    id: uuid,
    gradeId,
    createdAt: iso,
    days: z.array(daySchema).min(1).max(1000),
    cursor: checkpointId,
    timer: timerSchema.nullable(),
    trials: z.record(z.string(), timerSchema).default({}),
    readiness: z.enum(["exploring", "repeat", "teacher"]),
    journal: text,
    updatedAt: iso,
  })
  .strict();
export const progressSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    commitId: uuid,
    updatedAt: iso,
    setupDone: z.boolean(),
    settings: settingsSchema,
    activeAttemptId: uuid.nullable(),
    attempts: z.array(attemptSchema).max(500),
  })
  .strict()
  .superRefine((state, ctx) => {
    const ids = new Set<string>();
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (!state.setupDone && state.attempts.length)
      issue("Existing learning history requires completed setup.");
    for (const attempt of state.attempts) {
      if (ids.has(attempt.id)) issue("Duplicate attempt ID.");
      ids.add(attempt.id);
      if (checkpointById[attempt.cursor]?.gradeId !== attempt.gradeId)
        issue("Cursor belongs to another grade.");
      const dayIds = new Set<string>();
      const recorded = new Set<string>();
      for (const day of attempt.days) {
        if (dayIds.has(day.id) || day.gradeId !== attempt.gradeId)
          issue("Invalid learning day.");
        dayIds.add(day.id);
        try {
          const expected = createSchedule(
            day.localDate,
            day.startTime,
            day.timeZone,
          );
          if (Date.parse(expected.startsAt) !== Date.parse(day.startsAt))
            issue("Invalid day start instant.");
        } catch {
          issue("Invalid day schedule.");
        }
        for (const [key, record] of Object.entries(day.records)) {
          if (
            key !== record.checkpointId ||
            record.attemptId !== attempt.id ||
            record.dayId !== day.id ||
            checkpointById[key]?.gradeId !== attempt.gradeId ||
            recorded.has(key)
          )
            issue("Invalid or duplicate checkpoint record.");
          recorded.add(key);
          if (
            record.activeTrialMs >
            (checkpointById[key]?.trialWindowSeconds ?? 0) * 1000
          )
            issue("Trial duration exceeds supplied cap.");
          if (
            Number(attempt.gradeId.slice(1)) >= 9 &&
            ["completed", "modified"].includes(record.outcome)
          )
            issue("Teacher-guided lessons use observation records.");
        }
        for (const change of day.reschedules) {
          if (
            change.checkpointIds.some(
              (id) => checkpointById[id]?.gradeId !== attempt.gradeId,
            )
          )
            issue("Invalid reschedule checkpoint.");
          try {
            const s = change.schedule;
            if (
              Date.parse(
                createSchedule(s.localDate, s.startTime, s.timeZone).startsAt,
              ) !== Date.parse(s.startsAt)
            )
              issue("Invalid reschedule instant.");
          } catch {
            issue("Invalid reschedule.");
          }
        }
      }
      if (attempt.timer) {
        const cap =
          (checkpointById[attempt.timer.checkpointId]?.trialWindowSeconds ??
            0) * 1000;
        if (
          attempt.timer.checkpointId !== attempt.cursor ||
          !cap ||
          attempt.timer.remainingMs + attempt.timer.activeMs > cap ||
          (attempt.timer.state === "running") !==
            (attempt.timer.lastTick !== null)
        )
          issue("Invalid active trial.");
      }
      if (Object.keys(attempt.trials).length > 120)
        issue("Too many saved trials.");
      for (const [id, trial] of Object.entries(attempt.trials)) {
        const checkpoint = checkpointById[id];
        if (
          !Object.hasOwn(checkpointById, id) ||
          checkpoint.gradeId !== attempt.gradeId ||
          trial.checkpointId !== id ||
          !checkpoint.trialWindowSeconds ||
          trial.remainingMs + trial.activeMs >
            checkpoint.trialWindowSeconds * 1000 ||
          trial.state === "running" ||
          trial.lastTick !== null
        )
          issue("Invalid saved trial.");
      }
    }
    if (state.activeAttemptId && !ids.has(state.activeAttemptId))
      issue("Missing active attempt.");
  });
export type Progress = z.infer<typeof progressSchema>;
export type Attempt = Progress["attempts"][number];
export type LearningDay = Attempt["days"][number];
export type CompletionRecord = LearningDay["records"][string];

export function emptyProgress(): Progress {
  return {
    schemaVersion: 1,
    revision: 0,
    commitId: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    setupDone: false,
    settings: {
      startTime: "08:00",
      timeZone: "Asia/Kolkata",
      reducedMotion:
        typeof matchMedia !== "undefined" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches,
      sound: false,
    },
    activeAttemptId: null,
    attempts: [],
  };
}
export function makeDay(
  gradeId: string,
  settings: Settings,
  now = Date.now(),
): LearningDay {
  return {
    ...createSchedule(
      localDate(settings.timeZone, now),
      settings.startTime,
      settings.timeZone,
    ),
    id: crypto.randomUUID(),
    gradeId,
    createdAt: new Date(now).toISOString(),
    records: {},
    learningMs: 0,
    activeTrialMs: 0,
    reschedules: [],
  };
}
export function makeAttempt(
  gradeId: string,
  settings: Settings,
  now = Date.now(),
): Attempt {
  return {
    id: crypto.randomUUID(),
    gradeId,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    days: [makeDay(gradeId, settings, now)],
    cursor: gradeCheckpoints(gradeId)[0].id,
    timer: null,
    trials: {},
    readiness: "exploring",
    journal: "",
  };
}
export function recordsFor(
  attempt?: Attempt | null,
): Record<string, CompletionRecord> {
  return Object.assign({}, ...(attempt?.days.map((d) => d.records) ?? []));
}
export function counts(attempt?: Attempt | null) {
  const records = Object.values(recordsFor(attempt));
  return {
    completed: records.filter(
      (r) => r.outcome === "completed" || r.outcome === "modified",
    ).length,
    observed: records.filter((r) => r.outcome === "observed").length,
    skipped: records.filter((r) => r.outcome === "skipped").length,
    discomfort: records.filter((r) => r.outcome === "discomfort").length,
    total: records.length,
    learningMs: attempt?.days.reduce((sum, d) => sum + d.learningMs, 0) ?? 0,
    trialMs: attempt?.days.reduce((sum, d) => sum + d.activeTrialMs, 0) ?? 0,
    completedTrialMs: records
      .filter((r) => r.outcome === "completed" || r.outcome === "modified")
      .reduce((sum, r) => sum + r.activeTrialMs, 0),
  };
}
export function saveOutcome(
  attempt: Attempt,
  outcome: Outcome,
  note: string,
  side: CompletionRecord["side"],
  attendance: boolean,
  now = Date.now(),
): Attempt {
  const existing = recordsFor(attempt)[attempt.cursor];
  if (existing) return attempt; // Revisits never duplicate or replace previous outcomes.
  const day = attempt.days.at(-1)!;
  const record: CompletionRecord = {
    checkpointId: attempt.cursor,
    attemptId: attempt.id,
    dayId: day.id,
    outcome,
    note,
    side,
    attendance,
    recordedAt: new Date(now).toISOString(),
    activeTrialMs: attempt.timer?.activeMs ?? 0,
  };
  return {
    ...attempt,
    timer: null,
    updatedAt: new Date(now).toISOString(),
    days: attempt.days.map((d) =>
      d.id === day.id
        ? { ...d, records: { ...d.records, [attempt.cursor]: record } }
        : d,
    ),
  };
}
export function parseProgress(raw: string): Progress {
  if (new TextEncoder().encode(raw).length > 5 * 1024 * 1024)
    throw new Error("Progress files must be smaller than 5 MB.");
  const parsed = progressSchema.safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw new Error(
      `Invalid progress file: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
    );
  return parsed.data;
}
export function restoreProgress(state: Progress): Progress {
  return {
    ...state,
    attempts: state.attempts.map((a) => ({
      ...a,
      timer: a.timer ? restoreTimer(a.timer as TrialTimer) : null,
    })),
  };
}
export function mergeProgress(local: Progress, incoming: Progress): Progress {
  const merged = new Map(local.attempts.map((a) => [a.id, a]));
  for (const other of incoming.attempts) {
    const current = merged.get(other.id);
    if (!current) {
      merged.set(other.id, other);
      continue;
    }
    const latest = current.updatedAt >= other.updatedAt ? current : other;
    const records = { ...recordsFor(other), ...recordsFor(current) };
    const days = new Map(other.days.map((d) => [d.id, d]));
    for (const d of current.days) {
      const previous = days.get(d.id);
      days.set(d.id, {
        ...d,
        learningMs: Math.max(d.learningMs, previous?.learningMs ?? 0),
        activeTrialMs: Math.max(d.activeTrialMs, previous?.activeTrialMs ?? 0),
        reschedules: [
          ...new Map(
            [...(previous?.reschedules ?? []), ...d.reschedules].map((s) => [
              s.at,
              s,
            ]),
          ).values(),
        ],
        records: {},
      });
    }
    const combinedDays = [...days.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((d) => ({
        ...d,
        records: Object.fromEntries(
          Object.entries(records).filter(([, r]) => r.dayId === d.id),
        ),
      }));
    const trials = { ...other.trials, ...current.trials };
    for (const [id, timer] of Object.entries(other.trials)) {
      if (!trials[id] || timer.activeMs > trials[id].activeMs)
        trials[id] = timer;
    }
    merged.set(other.id, {
      ...latest,
      journal:
        current.journal === other.journal ||
        current.journal.includes(other.journal)
          ? current.journal
          : other.journal.includes(current.journal)
            ? other.journal
            : [current.journal, other.journal].filter(Boolean).join("\n\n"),
      days: combinedDays,
      trials,
      timer: null,
    });
  }
  return parseProgress(
    JSON.stringify({ ...local, attempts: [...merged.values()] }),
  );
}
