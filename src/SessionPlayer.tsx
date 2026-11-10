import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Pause,
  Play,
  ShieldCheck,
  Square,
  Wind,
} from "lucide-react";
import {
  checkpointById,
  gradeById,
  gradeCheckpoints,
  hourById,
  poseById,
} from "./content";
import { Badge, ComfortCheck, PoseSprite, outcomeLabel } from "./components";
import { recordsFor } from "./core/progress";
import type { Attempt, CompletionRecord, Outcome } from "./core/progress";
import { timerLabel } from "./core/timer";

interface Props {
  attempt: Attempt;
  unsaved?: boolean;
  onBack(): void;
  onTimer(action: "start" | "pause" | "end"): void;
  onRecord(
    outcome: Outcome,
    note: string,
    side: CompletionRecord["side"],
    attendance: boolean,
  ): void;
  onNext(): void;
  onRest(reason: string, note: string): void;
}
export function SessionPlayer({
  attempt,
  unsaved,
  onBack,
  onTimer,
  onRecord,
  onNext,
  onRest,
}: Props) {
  const c = checkpointById[attempt.cursor];
  const pose = poseById[c.poseId];
  const grade = gradeById[c.gradeId];
  const record = recordsFor(attempt)[c.id];
  const timer = attempt.timer;
  const [note, setNote] = useState(record?.note ?? "");
  const [side, setSide] = useState<CompletionRecord["side"]>(
    record?.side ?? "both",
  );
  const [attendance, setAttendance] = useState(record?.attendance ?? false);
  const [breathing, setBreathing] = useState(false);
  useEffect(() => {
    setNote(record?.note ?? "");
    setSide(record?.side ?? "both");
    setAttendance(record?.attendance ?? false);
    setBreathing(false);
  }, [c.id, record?.note, record?.side, record?.attendance]);
  const remaining = timer?.remainingMs ?? c.trialWindowSeconds * 1000;
  return (
    <>
      <div className="player-toolbar">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={17} />
          Back to Today
        </button>
        <button
          className="stop-button"
          onClick={() => onRest("Chose to stop and rest", note)}
        >
          <Square size={15} fill="currentColor" />
          Stop and rest
        </button>
      </div>
      <div className="page-heading">
        <p className="eyebrow">
          GRADE {String(grade.number).padStart(2, "0")} · HOUR{" "}
          {hourById[c.hourId].number}
        </p>
        <h1>{pose.name}</h1>
        <p>
          {grade.title} <span className="dot">·</span> Checkpoint{" "}
          {c.numberWithinGrade} of 120
        </p>
      </div>
      <div className="player-grid">
        <div className="player-visual">
          <div className="art-panel">
            <PoseSprite pose={pose} />
          </div>
          <div className="art-review">
            <ShieldCheck size={19} />
            <div>
              <strong>
                Illustrative AI artwork - instructor review pending
              </strong>
              <p>{pose.visualReviewNote}</p>
            </div>
          </div>
          <div className="card breathing-card">
            <div>
              <Wind size={20} />
              <strong>A moment to settle</strong>
              <p>Breathe normally and without forcing. No breath holds.</p>
            </div>
            <button
              className="secondary"
              onClick={() => setBreathing(!breathing)}
            >
              {breathing ? "Hide breathing circle" : "Show breathing circle"}
            </button>
            {breathing && (
              <div
                className="breathing-circle"
                aria-label="Optional gentle breathing visual"
              >
                Easy
                <br />
                breathing
              </div>
            )}
          </div>
        </div>
        <div className="card lesson-panel">
          <div className="row-between">
            <Badge>{c.kind.replaceAll("_", " ")}</Badge>
            <span className="muted small">{c.numberWithinGrade} / 120</span>
          </div>
          <h2>{c.title}</h2>
          <p className="instruction">{c.instruction}</p>
          {grade.supervisionRequired && (
            <div className="notice gold-notice">
              <ShieldCheck size={20} />
              <div>
                <strong>Teacher-guided preparation only</strong>
                <p>
                  Observe and discuss with a qualified teacher. This lesson has
                  no unsupervised trial. Attendance is self-reported, never
                  instructor verification.
                </p>
              </div>
            </div>
          )}
          <ol className="cue-list">
            <li>
              <span>01</span>
              <div>
                <strong>Settle into position</strong>
                <p>{pose.setup}</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Find a comfortable alignment</strong>
                <p>{pose.alignment}</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Release gently</strong>
                <p>{pose.release}</p>
              </div>
            </li>
          </ol>
          <div className="support-note">
            <strong>Make it yours</strong>
            <p>{pose.modification}</p>
            {pose.bilateral && (
              <p>
                <strong>Both sides:</strong> explore each side comfortably
                within the same brief window, with rest between. The
                illustration stays as supplied.
              </p>
            )}
            <p>{pose.breathing}</p>
          </div>
          {c.trialWindowSeconds > 0 && !record ? (
            <section className="trial-panel">
              <div className="row-between">
                <div>
                  <span className="eyebrow">OPTIONAL TRIAL WINDOW</span>
                  <strong
                    className="timer"
                    role="timer"
                    aria-label="Trial time remaining"
                  >
                    {timerLabel(remaining)}
                  </strong>
                </div>
                <Badge>
                  {timer?.state === "running"
                    ? "In progress"
                    : timer?.state === "ended"
                      ? "Window ended"
                      : timer
                        ? "Paused · resume when ready"
                        : "Starts only when you choose"}
                </Badge>
              </div>
              <p>
                Includes setup, short attempts, release and rests. This is not a
                pose-hold timer. Stop whenever you need.
              </p>
              <div className="button-row">
                {timer?.state === "running" ? (
                  <button className="primary" onClick={() => onTimer("pause")}>
                    <Pause size={17} />
                    Pause trial
                  </button>
                ) : remaining > 0 ? (
                  <button className="primary" onClick={() => onTimer("start")}>
                    <Play size={17} />
                    {timer ? "Resume trial" : "Start optional trial"}
                  </button>
                ) : null}
                {timer && timer.state !== "ended" && (
                  <button onClick={() => onTimer("end")} className="secondary">
                    <Square size={15} />
                    End trial
                  </button>
                )}
              </div>
              {timer?.state === "ended" && (
                <p className="small">
                  <strong>Window ended.</strong> Rest now, then choose an
                  outcome below. Nothing is automatically completed.
                </p>
              )}
            </section>
          ) : (
            !record && (
              <div className="cadence-note">
                <strong>Five-minute learning cadence</strong>
                <p>
                  Take the time you need to read, observe and rest. No physical
                  timer at this checkpoint.
                </p>
              </div>
            )
          )}
          {record ? (
            <div className="saved-record">
              <Check size={21} />
              <div>
                <strong>
                  {outcomeLabel(record.outcome)} ·{" "}
                  {unsaved ? "unsaved" : "saved"}
                </strong>
                <p>
                  {record.note ||
                    "You can revisit these cues anytime. Your original record is preserved."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <ComfortCheck
                note={note}
                setNote={setNote}
                side={side}
                setSide={setSide}
                bilateral={pose.bilateral}
                onDiscomfort={(reason) => onRest(reason, note)}
                attendance={attendance}
                setAttendance={setAttendance}
                teacher={grade.supervisionRequired}
              />
              <div className="outcome-actions">
                {!grade.supervisionRequired && (
                  <button
                    className="primary"
                    onClick={() =>
                      onRecord("completed", note, side, attendance)
                    }
                  >
                    <Check size={17} />
                    Mark completed
                  </button>
                )}
                <button
                  className={
                    grade.supervisionRequired ? "primary" : "secondary"
                  }
                  onClick={() =>
                    onRecord("observed", note, "observe", attendance)
                  }
                >
                  <Eye size={17} />
                  Mark observed
                </button>
                {!grade.supervisionRequired && (
                  <button
                    className="secondary"
                    onClick={() => onRecord("modified", note, side, attendance)}
                  >
                    Used a modification
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() => onRecord("skipped", note, side, attendance)}
                >
                  Skip checkpoint
                </button>
              </div>
            </>
          )}
          <div className="lesson-next">
            <span className="small muted">
              Manual next · move at your own pace
            </span>
            <button className="secondary" onClick={onNext}>
              {c.id === gradeCheckpoints(grade.id).at(-1)?.id
                ? "Return to Today"
                : "Next checkpoint"}
              <ArrowRight size={17} />
            </button>
          </div>
          <p className="stop-rule">{pose.stopRule}</p>
        </div>
      </div>
    </>
  );
}
