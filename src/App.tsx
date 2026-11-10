import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Clock3,
  Home,
  Leaf,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  X,
} from "lucide-react";
import {
  checkpointById,
  gradeById,
  gradeCheckpoints,
  grades,
  hourById,
  poseById,
  poses,
} from "./content";
import {
  Badge,
  CheckpointList,
  EmptyState,
  GradeCard,
  HourTimeline,
  LearningNotice,
  PoseSprite,
  ProgressSummary,
  ResumeButton,
  SectionHeading,
  outcomeLabel,
  scheduleForCheckpoint,
} from "./components";
import { SessionPlayer } from "./SessionPlayer";
import { CurriculumLadder, GradeChallengeInfo, MissionProgress, TechnicalOverview } from './ChallengeUI';
import {
  counts,
  emptyProgress,
  makeAttempt,
  makeDay,
  mergeProgress,
  parseProgress,
  recordsFor,
  saveOutcome,
  saveMissionEvidence,
  settingsSchema,
} from "./core/progress";
import type {
  Attempt,
  CompletionRecord,
  Outcome,
  Progress,
  Settings,
  MissionEvidence,
} from "./core/progress";
import {
  clock,
  createSchedule,
  localDate,
  scheduledInstant,
} from "./core/schedule";
import {
  newTimer,
  pauseTimer,
  restoreTimer,
  startTimer,
  tickTimer,
} from "./core/timer";
import { useProgress } from "./useProgress";

type Screen =
  | "today"
  | "grades"
  | "detail"
  | "player"
  | "timeline"
  | "progress"
  | "settings"
  | "gallery";
interface DialogAction {
  label: string;
  action(): void;
  danger?: boolean;
}
interface DialogState {
  title: string;
  body: ReactNode;
  actions: DialogAction[];
}
const links = [
  { id: "today", label: "Today", Icon: Home },
  { id: "grades", label: "Grades", Icon: BookOpen },
  { id: "progress", label: "Progress", Icon: ChartNoAxesCombined },
  { id: "settings", label: "Settings", Icon: Settings2 },
] as const;

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-top">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function SettingsFields({
  value,
  onChange,
}: {
  value: Settings;
  onChange(value: Settings): void;
}) {
  const zones = Array.from(
    new Set([
      "Asia/Kolkata",
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      "UTC",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Berlin",
      "Asia/Dubai",
      "Asia/Singapore",
      "Australia/Sydney",
      value.timeZone,
    ]),
  );
  return (
    <>
      <div className="form-grid">
        <label>
          Daily start time
          <input
            type="time"
            value={value.startTime}
            required
            onChange={(e) => onChange({ ...value, startTime: e.target.value })}
          />
        </label>
        <label>
          Local timezone
          <input
            list="timezones"
            value={value.timeZone}
            required
            onChange={(e) => onChange({ ...value, timeZone: e.target.value })}
          />
          <datalist id="timezones">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
      </div>
      <p className="field-help">
        Use an IANA timezone such as Asia/Kolkata. The window ends ten elapsed
        hours after your saved start, even across midnight or a daylight-saving
        change.
      </p>
      <label className="toggle-row">
        <span>
          <strong>Reduced motion</strong>
          <small>Keep transitions and the breathing circle still.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={value.reducedMotion}
          onChange={(e) =>
            onChange({ ...value, reducedMotion: e.target.checked })
          }
        />
      </label>
      <label className="toggle-row">
        <span>
          <strong>Gentle completion sound</strong>
          <small>Optional; the trial ending is also shown on screen.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={value.sound}
          onChange={(e) => onChange({ ...value, sound: e.target.checked })}
        />
      </label>
    </>
  );
}
function exportProgress(data: Progress) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yoga10-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const store = useProgress();
  const { data, update } = store;
  const [screen, setScreen] = useState<Screen>("today");
  const [viewGrade, setViewGrade] = useState("g01");
  const [draft, setDraft] = useState<Settings>(data.settings);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [message, setMessage] = useState("");
  const [rest, setRest] = useState<string | null>(null);
  const heading = useRef<HTMLElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const attempt =
    data.attempts.find((a) => a.id === data.activeAttemptId) ?? null;
  const currentRef = useRef(attempt);
  currentRef.current = attempt;

  const editAttempt = useCallback(
    (change: (attempt: Attempt) => Attempt) => {
      update((s) => ({
        ...s,
        attempts: s.attempts.map((a) => {
          if (a.id !== s.activeAttemptId) return a;
          const next = change(a);
          return {
            ...next,
            trials: next.timer
              ? { ...next.trials, [next.cursor]: restoreTimer(next.timer) }
              : next.trials,
          };
        }),
      }));
    },
    [update],
  );
  function navigate(next: Screen) {
    if (attempt?.timer?.state === "running") timerAction("pause");
    setScreen(next);
    setMessage("");
    if (next === "settings") setDraft(data.settings);
  }
  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [screen, data.setupDone]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(
      data.settings.reducedMotion,
    );
  }, [data.settings.reducedMotion]);
  useEffect(() => {
    if (screen !== "player" || !attempt || rest || store.conflict) return;
    let anchor: number | null =
      document.visibilityState === "visible" ? Date.now() : null;
    const interval = setInterval(() => {
      const now = Date.now();
      if (document.visibilityState !== "visible") {
        anchor = null;
        return;
      }
      const elapsed = anchor === null ? 0 : Math.max(0, now - anchor);
      anchor = now;
      if (elapsed)
        editAttempt((a) => ({
          ...a,
          days: a.days.map((d, i) =>
            i === a.days.length - 1
              ? { ...d, learningMs: d.learningMs + elapsed }
              : d,
          ),
        }));
    }, 1000);
    const visibility = () => {
      anchor = document.visibilityState === "visible" ? Date.now() : null;
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [screen, attempt?.id, rest, !!store.conflict, editAttempt]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentRef.current?.timer?.state !== "running") return;
      const visible = document.visibilityState === "visible";
      editAttempt((a) => {
        if (!a.timer) return a;
        const timer = tickTimer(a.timer, Date.now(), visible);
        const delta = timer.activeMs - a.timer.activeMs;
        return {
          ...a,
          timer,
          updatedAt: new Date().toISOString(),
          days: a.days.map((d, i) =>
            i === a.days.length - 1
              ? { ...d, activeTrialMs: d.activeTrialMs + delta }
              : d,
          ),
        };
      });
    }, 250);
    function hide() {
      if (currentRef.current?.timer?.state !== "running") return;
      editAttempt((a) => {
        if (!a.timer) return a;
        const timer = pauseTimer(a.timer, Date.now());
        return {
          ...a,
          timer,
          days: a.days.map((d, i) =>
            i === a.days.length - 1
              ? {
                  ...d,
                  activeTrialMs:
                    d.activeTrialMs + timer.activeMs - a.timer!.activeMs,
                }
              : d,
          ),
        };
      });
    }
    function visibilityChanged() {
      if (document.visibilityState !== "visible") hide();
    }
    document.addEventListener("visibilitychange", visibilityChanged);
    addEventListener("pagehide", hide);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visibilityChanged);
      removeEventListener("pagehide", hide);
    };
  }, [editAttempt]);

  const timerEnded = attempt?.timer?.state === "ended";
  useEffect(() => {
    if (
      !timerEnded ||
      !data.settings.sound ||
      !audio.current ||
      document.visibilityState !== "visible"
    )
      return;
    const ctx = audio.current;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 528;
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.5);
  }, [timerEnded, data.settings.sound]);

  function timerAction(action: "start" | "pause" | "end") {
    if (!attempt) return;
    const c = checkpointById[attempt.cursor];
    if (!c.trialWindowSeconds || recordsFor(attempt)[c.id] || store.conflict)
      return;
    if (action !== "start" && !attempt.timer) return;
    if (action === "start" && document.visibilityState !== "visible") return;
    if (action === "start" && data.settings.sound) {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {
        /* Visual timer remains available. */
      }
    }
    editAttempt((a) => {
      const base =
        a.timer ?? a.trials[c.id] ?? newTimer(c.id, c.trialWindowSeconds);
      let timer =
        action === "start"
          ? startTimer(base, Date.now())
          : pauseTimer(base, Date.now());
      if (action === "end")
        timer = { ...timer, remainingMs: 0, state: "ended", lastTick: null };
      return {
        ...a,
        timer,
        days: a.days.map((d, i) =>
          i === a.days.length - 1
            ? {
                ...d,
                activeTrialMs: d.activeTrialMs + timer.activeMs - base.activeMs,
              }
            : d,
        ),
      };
    });
  }
  function startGrade(id: string, repeat = false) {
    const existing = [...data.attempts].reverse().find((a) => a.gradeId === id);
    function create() {
      try {
        const next = makeAttempt(id, data.settings);
        update((s) => ({
          ...s,
          activeAttemptId: next.id,
          attempts: [...s.attempts, next],
        }));
        setScreen("today");
        setDialog(null);
      } catch {
        setMessage(
          "That start time is ambiguous or does not exist on this date. Choose another time in Settings.",
        );
        setDialog(null);
      }
    }
    if (!attempt && !existing) {
      create();
      return;
    }
    setDialog({
      title: repeat
        ? "Begin a fresh attempt?"
        : `Learn Grade ${gradeById[id].number}?`,
      body: (
        <p>
          Your previous learning days, notes and outcomes will stay in your
          history. A fresh attempt starts with 120 unrecorded checkpoints.
        </p>
      ),
      actions: [
        ...(!repeat && existing
          ? [
              {
                label: "Resume saved attempt",
                action: () => {
                  update((s) => ({ ...s, activeAttemptId: existing.id }));
                  setScreen("today");
                  setDialog(null);
                },
              },
            ]
          : []),
        {
          label: repeat ? "Start fresh attempt" : "Start new attempt",
          action: create,
        },
      ],
    });
  }
  function openCheckpoint(id: string) {
    if (!attempt || checkpointById[id].gradeId !== attempt.gradeId) return;
    timerAction("pause");
    editAttempt((a) => ({
      ...a,
      cursor: id,
      timer:
        a.cursor === id
          ? (a.timer ?? a.trials[id] ?? null)
          : (a.trials[id] ?? null),
    }));
    setScreen("player");
  }
  function nextCheckpoint() {
    if (!attempt) return;
    const cps = gradeCheckpoints(attempt.gradeId);
    const index = cps.findIndex((c) => c.id === attempt.cursor);
    if (index === cps.length - 1) {
      navigate("today");
      return;
    }
    openCheckpoint(cps[index + 1].id);
  }
  function record(
    outcome: Outcome,
    note: string,
    side: CompletionRecord["side"],
    attendance: boolean,
  ) {
    timerAction("pause");
    editAttempt((a) => saveOutcome(a, outcome, note, side, attendance));
  }
  function stopAndRest(reason: string, note: string) {
    record(
      "discomfort",
      [reason, note].filter(Boolean).join(". ").slice(0, 2000),
      "observe",
      false,
    );
    setRest(reason);
  }
  function newDay() {
    if (!attempt) return;
    try {
      const day = makeDay(attempt.gradeId, data.settings);
      timerAction("pause");
      editAttempt((a) => ({ ...a, days: [...a.days, day], timer: null }));
      setMessage(
        "A new learning day is ready. Earlier days and outcomes are preserved.",
      );
    } catch {
      setMessage(
        "This date has a repeated or nonexistent local start time. Please choose another time.",
      );
    }
  }
  function recordMission(id: string, evidence: MissionEvidence, submit = false) {
    timerAction('pause');
    try {
      editAttempt(a => saveMissionEvidence(a, id, evidence, submit));
      if (submit) setMessage('Technical mission recorded. Your reasoning and task self-report are separate from physical readiness.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The mission could not be recorded.'); }
  }
  function openMission(hourId: string) { openCheckpoint(hourById[hourId].checkpointIds[10]); }
  function saveSettings(event: FormEvent) {
    event.preventDefault();
    const parsed = settingsSchema.safeParse(draft);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0].message);
      return;
    }
    try {
      createSchedule(
        localDate(draft.timeZone),
        draft.startTime,
        draft.timeZone,
      );
    } catch {
      setMessage(
        "This local start time is repeated or nonexistent today. Please choose another time.",
      );
      return;
    }
    const apply = () => {
      update((s) => ({ ...s, settings: draft }));
      setDialog(null);
      setMessage(
        "Settings saved. Existing learning-day schedules are preserved.",
      );
    };
    if (
      attempt &&
      (draft.startTime !== data.settings.startTime ||
        draft.timeZone !== data.settings.timeZone)
    ) {
      setDialog({
        title: "When should the schedule change?",
        body: (
          <p>
            Past records keep their timestamps and timezone. Apply these
            settings to future learning days, or add a new schedule for only the
            unfinished checkpoints in the current day.
          </p>
        ),
        actions: [
          { label: "Use for new learning days", action: apply },
          {
            label: "Reschedule unfinished checkpoints",
            action: () => {
              const schedule = createSchedule(
                localDate(draft.timeZone),
                draft.startTime,
                draft.timeZone,
              );
              const remaining = gradeCheckpoints(attempt.gradeId)
                .filter((c) => !recordsFor(attempt)[c.id])
                .map((c) => c.id);
              update((s) => ({
                ...s,
                settings: draft,
                attempts: s.attempts.map((a) =>
                  a.id === attempt.id
                    ? {
                        ...a,
                        days: a.days.map((d, i) =>
                          i === a.days.length - 1
                            ? {
                                ...d,
                                reschedules: [
                                  ...d.reschedules,
                                  {
                                    at: new Date().toISOString(),
                                    schedule,
                                    checkpointIds: remaining,
                                  },
                                ],
                              }
                            : d,
                        ),
                      }
                    : a,
                ),
              }));
              setDialog(null);
              setMessage(
                "Unfinished checkpoints rescheduled. All earlier records are preserved.",
              );
            },
          },
        ],
      });
    } else apply();
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Progress files must be smaller than 5 MB.");
      const incoming = parseProgress(await file.text());
      setDialog({
        title: "Import saved progress",
        body: (
          <p>
            This file has {incoming.attempts.length} attempt(s). Merge keeps
            current settings and existing checkpoint outcomes; matching
            attempt/checkpoint IDs are counted once. Replace uses the imported
            settings and history.
          </p>
        ),
        actions: [
          {
            label: "Merge progress",
            action: () => {
              try {
                store.replace(mergeProgress(data, incoming));
                setDialog(null);
                setMessage("Progress merged.");
              } catch (e) {
                setDialog(null);
                setMessage(String(e));
              }
            },
          },
          {
            label: "Replace with imported progress",
            danger: true,
            action: () => {
              store.replace(incoming);
              setDialog(null);
              setMessage("Imported progress restored.");
            },
          },
        ],
      });
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to import this file.",
      );
    }
  }
  const grade = attempt ? gradeById[attempt.gradeId] : grades[0];
  const current = attempt ? checkpointById[attempt.cursor] : null;
  const currentPose = poseById[current?.poseId ?? "easy-seat"];
  const day = attempt?.days.at(-1);
  const next = attempt
    ? gradeCheckpoints(attempt.gradeId).find((c) => !recordsFor(attempt)[c.id])
    : null;
  const schedule = day
    ? scheduleForCheckpoint(day, next?.id ?? attempt!.cursor)
    : null;
  const mainNav =
    screen === "detail" || screen === "gallery"
      ? "grades"
      : screen === "player" || screen === "timeline"
        ? "today"
        : screen;

  if (!data.setupDone)
    return (
      <main className="welcome" data-testid="welcome">
        <div className="welcome-story">
          <div className="brand">
            <Leaf />
            <span>
              yoga<b>10</b>
              <i>✦</i>
            </span>
          </div>
          <div>
            <p className="eyebrow">TEN STAGES · TECHNIQUE LAB</p>
            <h1>
              Study every cue.
              <br />
              Defend every
              <br />
              <em>decision.</em>
            </h1>
            <p>
              Progress from precise foundations to complex technical analysis
              and teacher-guided synthesis through 100 scenario-driven missions.
            </p>
          </div>
          <div className="welcome-art">
            <PoseSprite pose={poseById["easy-seat"]} />
            <span className="aadi-tag">
              <span className="online-dot" />
              <strong>Hello, I’m Aadi.</strong> Let’s work with intention.
            </span>
          </div>
          <p className="small">Private prototype · Draft learning content</p>
        </div>
        <section className="welcome-form">
          <Badge>
            <Sparkles size={13} /> TEN-GRADE TECHNIQUE LAB
          </Badge>
          <h2>
            Set your
            <br />
            study rhythm.
          </h2>
          <p>
            Work through ten progressively demanding stages. Each grade has
            ten technical missions, scenario decisions and written reflections.
            Study at your pace; physical practice remains optional.
          </p>
          <LearningNotice />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = settingsSchema.safeParse(draft);
              if (!parsed.success) {
                setMessage("Choose a valid start time and IANA timezone.");
                return;
              }
              try {
                const a = makeAttempt("g01", draft);
                update((s) => ({
                  ...s,
                  settings: draft,
                  setupDone: true,
                  attempts: [a],
                  activeAttemptId: a.id,
                }));
              } catch {
                setMessage(
                  "This date has a repeated or nonexistent start time. Please choose another.",
                );
              }
            }}
          >
            <SettingsFields value={draft} onChange={setDraft} />
            <div className="editorial-note">
              <ShieldCheck size={20} />
              <p>
                Illustrative AI artwork - instructor review pending. These draft
                images and cues are not instructor-validated. Grades 9–10 are
                teacher-guided preparation.
              </p>
            </div>
            {message && (
              <p role="alert" className="error-message">
                {message}
              </p>
            )}
            {store.unsaved && <p role="alert">{store.unsaved}</p>}
            <button className="primary welcome-submit" type="submit">
              Begin my learning journey
              <ArrowRight size={18} />
            </button>
            <p className="small muted">
              No account. No pressure. Progress stays in this browser.
            </p>
          </form>
        </section>
      </main>
    );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          href="#today"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("today");
          }}
          aria-label="Yoga10 home"
        >
          <Leaf />
          <span>
            yoga<b>10</b>
            <i>✦</i>
          </span>
        </a>
        <span className="sidebar-caption">TECHNIQUE LAB</span>
        <nav aria-label="Main navigation">
          {links.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={mainNav === id ? "active" : ""}
              aria-current={mainNav === id ? "page" : undefined}
            >
              <Icon size={20} />
              <span>{label}</span>
              {mainNav === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-companion">
            <PoseSprite pose={poseById["easy-seat"]} />
            <p>
              Build precision.
              <br />
              <strong>Defend your decisions.</strong>
            </p>
          </div>
          <div className="private-label">
            <ShieldCheck size={15} />
            <span>Private learning prototype</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="topbar-context">
            <Sun size={18} />Experienced practice · technical reasoning
          </span>
          <div>
            <span
              className={`saved-status ${store.unsaved || store.conflict ? "warning" : ""}`}
            >
              <span />
              {store.unsaved
                ? "Unsaved session"
                : store.conflict
                  ? "Changes in another tab"
                  : "Saved on this device"}
            </span>
            <button
              className="avatar"
              aria-label="Open settings"
              onClick={() => navigate("settings")}
            >
              A
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          ref={heading}
          className="main-content"
        >
          {store.unsaved && (
            <div role="alert" className="notice error-notice">
              <p>{store.unsaved}</p>
              <button
                className="secondary"
                onClick={() => exportProgress(data)}
              >
                Export progress
              </button>
            </div>
          )}
          {message && (
            <div role="status" className="notice status-notice">
              <p>{message}</p>
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => setMessage("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {screen === "today" && (
            <>
              <div className="page-heading heading-with-meta">
                <div>
                  <p className="eyebrow">
                    <Sun size={14} /> YOUR TECHNIQUE LAB
                  </p>
                  <h1>Your technique lab.</h1>
                  <p>
                    Build precision. Compare strategies. Make the reasoning visible.
                  </p>
                </div>
                <span className="date-label">
                  <CalendarDays size={17} />
                  {localDate(data.settings.timeZone)}
                </span>
              </div>
              <TechnicalOverview attempt={attempt} onOpen={openMission} />
              <section className="today-hero">
                <div className="hero-copy">
                  <Badge gold>
                    GRADE {String(grade.number).padStart(2, "0")} OF 10{" "}
                    <span>·</span>{" "}
                    {grade.supervisionRequired
                      ? "TEACHER-GUIDED"
                      : "EXPERIENCED TRACK"}
                  </Badge>
                  <h2>
                    {grade.title === "Calm foundations" ? (
                      <>
                        Start with stillness.
                        <br />
                        <em>Grow from here.</em>
                      </>
                    ) : (
                      grade.title
                    )}
                  </h2>
                  <p>
                    {grade.objective} Use observation, adaptation and clear
                    reasoning; physical effort is always optional.
                  </p>
                  {attempt ? (
                    <ResumeButton
                      onClick={() => openCheckpoint(attempt.cursor)}
                    >
                      {Object.keys(recordsFor(attempt)).length
                        ? "Resume learning"
                        : "Begin first checkpoint"}
                    </ResumeButton>
                  ) : (
                    <ResumeButton onClick={() => startGrade("g01")}>
                      Begin Grade 1
                    </ResumeButton>
                  )}
                  <div className="hero-meta">
                    <span>
                      <BookOpen size={15} />
                      {current
                        ? `Hour ${hourById[current.hourId].number} of 10`
                        : "10 learning hours"}
                    </span>
                    <span>
                      <Clock3 size={15} />
                      5-minute check-in cadence
                    </span>
                  </div>
                </div>
                <div className="hero-art">
                  <PoseSprite pose={currentPose} />
                  <div className="aadi-caption">
                    <span className="online-dot" />
                    <span>
                      <strong>Aadi</strong>
                      <small>Your illustrated companion</small>
                    </span>
                    <Leaf size={20} />
                  </div>
                </div>
              </section>
              <ProgressSummary attempt={attempt} />
              {attempt && day && schedule && (
                <>
                  <SectionHeading
                    eyebrow="LEARN, REST, LIVE"
                    title="Your learning window"
                  >
                    <Badge>
                      <Clock3 size={14} />
                      {clock(schedule.startsAt, schedule.timeZone)} –{" "}
                      {clock(
                        scheduledInstant(schedule, 600),
                        schedule.timeZone,
                      )}
                      <span className="hide-mobile">
                        {" "}
                        · {schedule.timeZone}
                      </span>
                    </Badge>
                  </SectionHeading>
                  <HourTimeline attempt={attempt} onOpen={openCheckpoint} />
                  <div className="timeline-caption">
                    <span>
                      Saved day: {day.localDate} · {schedule.timeZone} · ends{" "}
                      {clock(
                        scheduledInstant(schedule, 600),
                        schedule.timeZone,
                        true,
                      )}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => navigate("timeline")}
                    >
                      All 120 checkpoints
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <LearningNotice />
                  <SectionHeading
                    eyebrow="ONE SMALL STEP"
                    title={
                      next ? "Your next checkpoint" : "A moment to reflect"
                    }
                  />
                  <div className="card next-checkpoint">
                    <div className="checkpoint-art">
                      <PoseSprite
                        pose={poseById[next?.poseId ?? currentPose.id]}
                      />
                    </div>
                    <div>
                      <Badge>
                        {next
                          ? `HOUR ${hourById[next.hourId].number} · CHECKPOINT ${next.numberWithinGrade}`
                          : "LEARNING PARTICIPATION RECORDED"}
                      </Badge>
                      <h3>
                        {next
                          ? `${next.title}: ${poseById[next.poseId].name}`
                          : "You made space for learning."}
                      </h3>
                      <p>
                        {next?.instruction ??
                          "Recorded checkpoints are participation, not mastery. Choose whether to repeat or discuss readiness with a teacher."}
                      </p>
                    </div>
                    <button
                      className="round-button"
                      aria-label={
                        next ? "Open next checkpoint" : "Open progress"
                      }
                      onClick={() =>
                        next ? openCheckpoint(next.id) : navigate("progress")
                      }
                    >
                      <ArrowRight size={21} />
                    </button>
                  </div>
                  <div className="new-day-row">
                    <p>
                      Coming back another day? Keep your place and start a new
                      learning window.
                    </p>
                    <button className="secondary" onClick={newDay}>
                      Continue on a new day
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              <SectionHeading
                eyebrow="A PATH, NOT A RACE"
                title="A little further along"
              >
                <button
                  className="text-button"
                  onClick={() => navigate("grades")}
                >
                  All 10 grades
                  <ArrowRight size={15} />
                </button>
              </SectionHeading>
              <div className="grade-grid today-grades">
                {grades.slice(0, 3).map((g) => (
                  <GradeCard
                    key={g.id}
                    grade={g}
                    attempt={[...data.attempts]
                      .reverse()
                      .find((a) => a.gradeId === g.id)}
                    selected={g.id === attempt?.gradeId}
                    onOpen={() => {
                      setViewGrade(g.id);
                      navigate("detail");
                    }}
                  />
                ))}
              </div>
            </>
          )}
          {screen === "grades" && (
            <>
              <div className="page-heading">
                <p className="eyebrow">YOUR PATH</p>
                <h1>Ten grades. A technical progression.</h1>
                <p>
                  100 distinct missions. 100 scenario checks. Build, compare and defend your technique decisions.
                </p>
              </div>
              <CurriculumLadder activeGrade={attempt?.gradeId ?? 'g01'} onSelect={id => { setViewGrade(id); navigate('detail'); }} />
              <LearningNotice />
              <div className="section-heading">
                <Badge>10 GRADES · 100 HOURS · 1,200 CHECKPOINTS</Badge>
                <button
                  className="text-button"
                  onClick={() => navigate("gallery")}
                >
                  Meet all 30 poses
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="grade-grid">
                {grades.map((g) => (
                  <GradeCard
                    key={g.id}
                    grade={g}
                    attempt={[...data.attempts]
                      .reverse()
                      .find((a) => a.gradeId === g.id)}
                    selected={g.id === attempt?.gradeId}
                    onOpen={() => {
                      setViewGrade(g.id);
                      navigate("detail");
                    }}
                  />
                ))}
              </div>
            </>
          )}
          {screen === "detail" &&
            (() => {
              const g = gradeById[viewGrade];
              return (
                <>
                  <button
                    className="text-button"
                    onClick={() => navigate("grades")}
                  >
                    <ArrowLeft size={17} />
                    All grades
                  </button>
                  <div className="page-heading">
                    <p className="eyebrow">
                      GRADE {String(g.number).padStart(2, "0")} OF 10
                    </p>
                    <h1>{g.title}</h1>
                    <p>{g.objective}</p>
                  </div>
                  {g.supervisionRequired && (
                    <div className="notice gold-notice">
                      <ShieldCheck />
                      <p>
                        <strong>Teacher-guided preparation.</strong> These
                        lessons are observation and discussion only, with zero
                        unsupervised trial time.
                      </p>
                    </div>
                  )}
                  <GradeChallengeInfo gradeId={g.id} />
                  <div className="pose-showcase">
                    {g.poseIds.map((id) => (
                      <article className="card" key={id}>
                        <PoseSprite pose={poseById[id]} />
                        <div className="pose-guide">
                          <h3>{poseById[id].name}</h3>
                          <details>
                            <summary>Read pose cues</summary>
                            <p>
                              <strong>Setup:</strong> {poseById[id].setup}
                            </p>
                            <p>
                              <strong>Alignment:</strong>{" "}
                              {poseById[id].alignment}
                            </p>
                            <p>
                              <strong>Release:</strong> {poseById[id].release}
                            </p>
                            <p>{poseById[id].modification}</p>
                            <p>{poseById[id].breathing}</p>
                            {poseById[id].bilateral && (
                              <p>
                                Explore both sides comfortably within the same
                                brief window, resting between.
                              </p>
                            )}
                            <p>{poseById[id].stopRule}</p>
                            <p>
                              <strong>Instructor review pending:</strong>{" "}
                              {poseById[id].visualReviewNote}
                            </p>
                          </details>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="row-between grade-start">
                    <p>{g.advancement}</p>
                    <button
                      className="primary"
                      onClick={() =>
                        g.id === attempt?.gradeId
                          ? navigate("today")
                          : startGrade(g.id)
                      }
                    >
                      {g.id === attempt?.gradeId
                        ? "Return to current grade"
                        : `Start Grade ${g.number}`}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                  <SectionHeading
                    title="Ten blocks of gentle learning"
                    eyebrow="THE LESSON PLAN"
                  />
                  <div className="hour-cards">
                    {g.hourIds.map((id) => {
                      const h = hourById[id];
                      return (
                        <article className="card hour-card" key={id}>
                          <span className="hour-index">
                            {String(h.number).padStart(2, "0")}
                          </span>
                          <div>
                            <h3>{h.title}</h3>
                            <p>{h.learningGoal}</p>
                            <small>
                              12 checkpoints · {poseById[h.poseId].name}
                            </small>
                            <details className="hour-preview">
                              <summary>Browse the 12 checkpoints</summary>
                              <ol>
                                {h.checkpointIds.map((cid) => {
                                  const checkpoint = checkpointById[cid];
                                  return (
                                    <li key={cid}>
                                      <strong>{checkpoint.title}</strong>
                                      <p>{checkpoint.instruction}</p>
                                      <small>
                                        {checkpoint.trialWindowSeconds
                                          ? `${checkpoint.trialWindowSeconds}-second optional window, explicit start required`
                                          : "Learning or observation · no physical timer"}
                                      </small>
                                    </li>
                                  );
                                })}
                              </ol>
                            </details>
                          </div>
                          {g.id === attempt?.gradeId && (
                            <button
                              className="icon-button"
                              aria-label={`Open hour ${h.number}`}
                              onClick={() => openCheckpoint(h.checkpointIds[0])}
                            >
                              <ChevronRight size={20} />
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          {screen === "gallery" && (
            <>
              <button
                className="text-button"
                onClick={() => navigate("grades")}
              >
                <ArrowLeft size={17} />
                Back to grades
              </button>
              <div className="page-heading">
                <p className="eyebrow">THE CHARACTER LIBRARY</p>
                <h1>30 poses. One familiar guide.</h1>
                <p>
                  Original static illustrations of Aadi. All artwork is awaiting
                  instructor review.
                </p>
              </div>
              <div className="gallery-grid">
                {poses.map((p) => (
                  <article key={p.id} className="card gallery-card">
                    <PoseSprite pose={p} />
                    <div>
                      <Badge>GRADE {gradeById[p.gradeId].number}</Badge>
                      <h3>{p.name}</h3>
                      <p className="small">{p.visualReviewNote}</p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {screen === "player" && attempt && (
            <SessionPlayer
              attempt={attempt}
              unsaved={!!store.unsaved}
              onBack={() => navigate("today")}
              onTimer={timerAction}
              onRecord={record}
              onNext={nextCheckpoint}
              onRest={stopAndRest}
              onMission={recordMission}
            />
          )}
          {screen === "timeline" && attempt && (
            <>
              <button className="text-button" onClick={() => navigate("today")}>
                <ArrowLeft size={17} />
                Back to Today
              </button>
              <div className="page-heading">
                <p className="eyebrow">
                  GRADE {grade.number} · CHECKPOINT TIMELINE
                </p>
                <h1>Every small step, in one place.</h1>
                <p>
                  Offsets are measured from each saved day’s start. Clock time
                  never completes a checkpoint.
                </p>
              </div>
              <ProgressSummary attempt={attempt} />
              <CheckpointList attempt={attempt} onOpen={openCheckpoint} />
            </>
          )}
          {screen === "progress" && (
            <>
              <div className="page-heading">
                <p className="eyebrow">YOUR LEARNING JOURNAL</p>
                <h1>Notice how far you’ve come.</h1>
                <p>
                  Learning participation and skill readiness are different. Your
                  comfort leads the way.
                </p>
              </div>
              <ProgressSummary attempt={attempt} />
              {attempt ? (
                <>
                  <MissionProgress attempt={attempt} onOpen={openMission} />
                  <div className="progress-columns">
                    <section className="card journal-card">
                      <SectionHeading
                        title="A note to yourself"
                        eyebrow={`GRADE ${grade.number} · CURRENT ATTEMPT`}
                      />
                      <label htmlFor="journal">
                        What would you like to remember?
                      </label>
                      <textarea
                        id="journal"
                        key={attempt.id}
                        defaultValue={attempt.journal}
                        maxLength={2000}
                        rows={5}
                        placeholder="Something that felt easier, a support that helped, a question to bring to a teacher…"
                        onBlur={(e) =>
                          editAttempt((a) => ({
                            ...a,
                            journal: e.target.value.replace(
                              /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
                              "",
                            ),
                            updatedAt: new Date().toISOString(),
                          }))
                        }
                      />
                      <p className="field-help">
                        Saved when you leave the field. Plain text only.
                      </p>
                      <h3>How ready do you feel?</h3>
                      <p className="small">
                        This is your reflection, not an assessment or
                        certification.
                      </p>
                      <div className="readiness-options">
                        {[
                          { id: "exploring", label: "Still exploring" },
                          { id: "repeat", label: "I’d like to repeat" },
                          {
                            id: "teacher",
                            label: "Ready to discuss with a teacher",
                          },
                        ].map((r) => (
                          <label key={r.id}>
                            <input
                              type="radio"
                              name="readiness"
                              value={r.id}
                              checked={attempt.readiness === r.id}
                              onChange={() =>
                                editAttempt((a) => ({
                                  ...a,
                                  readiness: r.id as Attempt["readiness"],
                                  updatedAt: new Date().toISOString(),
                                }))
                              }
                            />
                            {r.label}
                          </label>
                        ))}
                      </div>
                    </section>
                    <section className="card participation-card">
                      <Leaf size={27} />
                      <h2>Comfort over completion.</h2>
                      <p>
                        {counts(attempt).total} of 120 learning checkpoints
                        recorded in this attempt.
                      </p>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${(counts(attempt).total / 120) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="small">
                        {(counts(attempt).completedTrialMs / 60000).toFixed(1)}{" "}
                        min of completed or modified trial windows.{" "}
                        {(counts(attempt).trialMs / 60000).toFixed(1)} min
                        across all active windows, including stopped attempts.
                        Neither measures exertion or mastery.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => startGrade(attempt.gradeId, true)}
                      >
                        <RotateCcw size={16} />
                        Repeat this grade
                      </button>
                    </section>
                  </div>
                  <SectionHeading
                    title="Your saved check-ins"
                    eyebrow="COMFORT, SUPPORTS & OBSERVATIONS"
                  />
                  {Object.values(recordsFor(attempt)).length ? (
                    <div className="record-list">
                      {Object.values(recordsFor(attempt))
                        .reverse()
                        .map((r) => {
                          const savedDay = attempt.days.find(
                            (d) => d.id === r.dayId,
                          )!;
                          return (
                            <article
                              className="card record-card"
                              key={r.checkpointId}
                            >
                              <div className="row-between">
                                <h3>
                                  {checkpointById[r.checkpointId].title} ·{" "}
                                  {
                                    poseById[
                                      checkpointById[r.checkpointId].poseId
                                    ].name
                                  }
                                </h3>
                                <Badge>{outcomeLabel(r.outcome)}</Badge>
                              </div>
                              <p>{r.note || "No comfort note added."}</p>
                              <small>
                                {clock(r.recordedAt, savedDay.timeZone, true)} ·{" "}
                                {savedDay.timeZone} · {r.side} ·{" "}
                                {(r.activeTrialMs / 1000).toFixed(0)}s trial
                                {r.attendance
                                  ? " · teacher attendance self-reported, unverified"
                                  : ""}
                              </small>
                            </article>
                          );
                        })}
                    </div>
                  ) : (
                    <EmptyState title="Your journal starts here">
                      Record your first checkpoint and your notes will appear
                      here.
                    </EmptyState>
                  )}
                </>
              ) : (
                <EmptyState title="A fresh beginning">
                  Start a grade to begin your personal learning record.
                </EmptyState>
              )}
              <SectionHeading
                title="Every attempt has a place"
                eyebrow="YOUR HISTORY"
              />
              <div className="history-list">
                {[...data.attempts].reverse().map((a) => (
                  <article className="card history-card" key={a.id}>
                    <span className="history-icon">
                      <BookOpen size={20} />
                    </span>
                    <div>
                      <h3>
                        Grade {gradeById[a.gradeId].number} ·{" "}
                        {gradeById[a.gradeId].title}
                      </h3>
                      <p>
                        {a.days[0].localDate} · {a.days.length} learning day(s)
                        · {counts(a).total}/120 recorded
                      </p>
                      {a.journal && <p className="small">{a.journal}</p>}
                    </div>
                    <button
                      className="secondary"
                      onClick={() => {
                        update((s) => ({ ...s, activeAttemptId: a.id }));
                        navigate("today");
                      }}
                    >
                      {a.id === attempt?.id ? "Current" : "Resume"}
                      <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          {screen === "settings" && (
            <>
              <div className="page-heading">
                <p className="eyebrow">MAKE IT YOURS</p>
                <h1>A rhythm that fits your life.</h1>
                <p>Your space, your schedule, your pace.</p>
              </div>
              <div className="settings-columns">
                <section className="card settings-card">
                  <h2>Your daily learning window</h2>
                  <form onSubmit={saveSettings}>
                    <SettingsFields value={draft} onChange={setDraft} />
                    <button className="primary" type="submit">
                      Save preferences
                      <Check size={17} />
                    </button>
                  </form>
                </section>
                <div>
                  <section className="card settings-card">
                    <h2>Your progress belongs to you</h2>
                    <p>
                      Export a backup or restore a versioned Yoga10 progress
                      file. Imports are validated and limited to 5 MB.
                    </p>
                    <div className="button-stack">
                      <button
                        className="secondary"
                        onClick={() => exportProgress(data)}
                      >
                        <ArrowDownToLine size={18} />
                        Export progress JSON
                      </button>
                      <label className="secondary upload-button">
                        <Upload size={18} />
                        Import progress JSON
                        <input
                          type="file"
                          accept="application/json,.json"
                          onChange={(e) => {
                            void importFile(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </section>
                  <section className="card settings-card">
                    <ShieldCheck size={23} />
                    <h3>A private, local-first prototype</h3>
                    <p>
                      No account or cloud sync. Progress is kept in this
                      browser. Keep a backup if you clear browser data.
                    </p>
                    <p className="small">
                      Reminders are in-app only. This app does not promise
                      notifications while closed.
                    </p>
                    <button
                      className="text-button danger-text"
                      onClick={() =>
                        setDialog({
                          title: "Reset saved progress?",
                          body: (
                            <p>
                              This clears your learning history, settings and
                              notes in this browser. Export a backup first if
                              you want to keep them.
                            </p>
                          ),
                          actions: [
                            {
                              label: "Export a backup",
                              action: () => exportProgress(data),
                            },
                            {
                              label: "Reset all saved progress",
                              danger: true,
                              action: () => {
                                store.replace(emptyProgress());
                                setDraft(emptyProgress().settings);
                                setDialog(null);
                                setScreen("today");
                              },
                            },
                          ],
                        })
                      }
                    >
                      Reset local progress
                    </button>
                  </section>
                </div>
              </div>
            </>
          )}
          <footer className="footer">
            <span>
              <Leaf size={15} /> A little more comfortable, every day.
            </span>
            <span>Yoga10 · Private prototype · Instructor review pending</span>
          </footer>
        </main>
      </div>
      {dialog && (
        <Modal title={dialog.title} onClose={() => setDialog(null)}>
          {dialog.body}
          <div className="dialog-actions">
            {dialog.actions.map((a) => (
              <button
                key={a.label}
                className={a.danger ? "danger-button" : "primary"}
                onClick={a.action}
              >
                {a.label}
              </button>
            ))}
            <button className="secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
      {store.conflict && (
        <Modal title="Progress changed in another tab" onClose={() => {}}>
          <p>
            Physical trials are paused. Keep both tabs’ recorded checkpoints by
            merging, or reload the other tab’s saved version. Existing matching
            outcomes in this tab are kept on merge.
          </p>
          <div className="dialog-actions">
            <button
              className="primary"
              onClick={() => store.resolveConflict("merge")}
            >
              Merge saved changes
            </button>
            <button
              className="secondary"
              onClick={() => store.resolveConflict("reload")}
            >
              Reload saved version
            </button>
            <button className="secondary" onClick={() => exportProgress(data)}>
              Export this tab first
            </button>
          </div>
        </Modal>
      )}
      {rest && (
        <Modal title="Take a comfortable rest" onClose={() => setRest(null)}>
          <div className="rest-view">
            <PoseSprite pose={poseById["supine-rest"]} />
            <p>
              <strong>{rest}.</strong> Your trial has stopped. Choose a
              comfortable resting position that suits you. Breathe normally;
              there is nothing to complete right now.
            </p>
            <p className="small">
              Your note is saved with this check-in. Ask a qualified teacher
              about returning to practice.
            </p>
            <button
              className="primary"
              onClick={() => {
                setRest(null);
                navigate("today");
              }}
            >
              Return to Today
            </button>
            <button className="secondary" onClick={() => setRest(null)}>
              Stay with this lesson
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
