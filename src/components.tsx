import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  Leaf,
  Play,
  ShieldCheck,
  SkipForward,
  Clock3,
  Circle,
} from "lucide-react";
import { checkpointById, gradeById, hourById, poseById } from "./content";
import type { Grade, Pose } from "./content";
import { clock, elapsedLabel, scheduledInstant } from "./core/schedule";
import { counts, recordsFor } from "./core/progress";
import type { Attempt, CompletionRecord, LearningDay } from "./core/progress";
import { profileByGrade } from './curriculum/challenges';

export function Badge({
  children,
  gold = false,
}: {
  children: ReactNode;
  gold?: boolean;
}) {
  return <span className={`badge ${gold ? "gold" : ""}`}>{children}</span>;
}
export function PoseSprite({
  pose,
  className = "",
}: {
  pose: Pose;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setMissing(false);
    const img = new Image();
    img.onerror = () => setMissing(true);
    img.src = pose.asset.atlas;
    return () => {
      img.onerror = null;
    };
  }, [pose.asset.atlas]);
  const a = pose.asset;
  const style: CSSProperties = {
    aspectRatio: a.cellAspectRatio,
    backgroundImage: missing ? "none" : `url("${a.atlas}")`,
    backgroundSize: `${a.columns * 100}% ${a.rows * 100}%`,
    backgroundPosition: `${(a.column / (a.columns - 1)) * 100}% ${(a.row / (a.rows - 1)) * 100}%`,
  };
  return (
    <div
      className={`pose-sprite ${className} ${missing ? "missing-art" : ""}`}
      style={style}
      role="img"
      aria-label={missing ? `Illustration unavailable: ${pose.name}` : a.alt}
      data-pose={pose.id}
    >
      {missing && (
        <span>
          <Leaf size={28} />
          Illustration unavailable.
          <br />
          Use the written cues below.
        </span>
      )}
    </div>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function ProgressSummary({ attempt }: { attempt: Attempt | null }) {
  const c = counts(attempt);
  return (
    <div className="stats-grid">
      <div className="stat">
        <span className="stat-icon">
          <CheckCircle2 size={19} />
        </span>
        <strong>
          {c.completed}
          <small> / 120</small>
        </strong>
        <span>Completed or modified</span>
      </div>
      <div className="stat">
        <span className="stat-icon">
          <Eye size={19} />
        </span>
        <strong>
          {c.observed}
          <small> observed</small>
        </strong>
        <span>
          {c.skipped} skipped · {c.discomfort} rest records
        </span>
      </div>
      <div className="stat">
        <span className="stat-icon">
          <BookOpenIcon />
        </span>
        <strong>
          {(c.learningMs / 60000).toFixed(1)}
          <small> min</small>
        </strong>
        <span>Visible lesson time</span>
      </div>
      <div className="stat">
        <span className="stat-icon">
          <Clock3 size={19} />
        </span>
        <strong>
          {(c.trialMs / 60000).toFixed(1)}
          <small> min</small>
        </strong>
        <span>Optional active trial time</span>
      </div>
    </div>
  );
}
function BookOpenIcon() {
  return <Leaf size={19} />;
}
export function GradeCard({
  grade,
  attempt,
  selected,
  onOpen,
}: {
  grade: Grade;
  attempt?: Attempt;
  selected: boolean;
  onOpen(): void;
}) {
  const c = counts(attempt);
  return (
    <button
      className={`grade-card ${selected ? "selected" : ""}`}
      onClick={onOpen}
      aria-label={`View Grade ${grade.number}: ${grade.title}`}
    >
      <div className="grade-card-top">
        <span className="eyebrow">
          GRADE {String(grade.number).padStart(2, "0")}
        </span>
        {selected ? (
          <Badge>YOUR GRADE</Badge>
        ) : grade.supervisionRequired ? (
          <ShieldCheck size={18} />
        ) : (
          <ArrowRight size={18} />
        )}
      </div>
      <div className="pose-trio">
        {grade.poseIds.map((id) => (
          <PoseSprite key={id} pose={poseById[id]} />
        ))}
      </div>
      <h3>{grade.title}</h3>
      <span className="grade-stage">{profileByGrade[grade.id].stage}</span>
      <p>{grade.objective}</p>
      {grade.supervisionRequired && (
        <span className="teacher-label">Teacher-guided preparation</span>
      )}
      <div className="grade-card-bottom">
        <span>{c.total}/120 recorded</span>
        <span>{c.missionsCompleted}/10 technical missions</span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${(c.total / 120) * 100}%` }} />
      </div>
    </button>
  );
}
export function scheduleForCheckpoint(day: LearningDay, id: string) {
  return (
    [...day.reschedules].reverse().find((s) => s.checkpointIds.includes(id))
      ?.schedule ?? day
  );
}
export function HourTimeline({
  attempt,
  onOpen,
}: {
  attempt: Attempt;
  onOpen(id: string): void;
}) {
  const grade = gradeById[attempt.gradeId];
  const day = attempt.days.at(-1)!;
  const records = recordsFor(attempt);
  return (
    <div className="hour-timeline">
      {grade.hourIds.map((id, index) => {
        const h = hourById[id];
        const recorded = h.checkpointIds.filter((c) => records[c]).length;
        const active = checkpointById[attempt.cursor].hourId === id;
        const next =
          h.checkpointIds.find((c) => !records[c]) ?? h.checkpointIds[0];
        const schedule = scheduleForCheckpoint(day, next);
        return (
          <button
            key={id}
            onClick={() => onOpen(next)}
            className={`hour-tile ${active ? "current" : ""} ${recorded === 12 ? "done" : ""}`}
            aria-label={`Hour ${index + 1}, ${h.title}, ${recorded} of 12 recorded`}
          >
            <span className="hour-clock">
              {clock(
                scheduledInstant(schedule, h.offsetMinutes),
                schedule.timeZone,
              )}
            </span>
            <span className="hour-number">
              {recorded === 12 ? (
                <Check size={20} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <span>{index === 9 ? "Reflect" : "Learn"}</span>
            <span className="hour-dots">
              {Array.from({ length: 3 }, (_, i) => (
                <i key={i} className={recorded > i * 4 ? "filled" : ""} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
const outcomeLabels: Record<string, string> = {
  completed: "Completed",
  observed: "Observed",
  modified: "Modified",
  skipped: "Skipped",
  discomfort: "Stopped to rest",
};
export function OutcomeIcon({ outcome }: { outcome?: string }) {
  return outcome === "observed" ? (
    <Eye size={17} />
  ) : outcome === "skipped" ? (
    <SkipForward size={17} />
  ) : outcome ? (
    <CheckCircle2 size={17} />
  ) : (
    <Circle size={17} />
  );
}
export function CheckpointList({
  attempt,
  onOpen,
}: {
  attempt: Attempt;
  onOpen(id: string): void;
}) {
  const records = recordsFor(attempt);
  const day = attempt.days.at(-1)!;
  return (
    <div className="checkpoint-groups">
      {gradeById[attempt.gradeId].hourIds.map((id) => {
        const h = hourById[id];
        return (
          <details
            className="card checkpoint-group"
            key={id}
            open={checkpointById[attempt.cursor].hourId === id}
          >
            <summary>
              <span>
                Hour {h.number} · {h.title}
              </span>
              <span>{h.checkpointIds.filter((c) => records[c]).length}/12</span>
            </summary>
            <p>{h.learningGoal}</p>
            <div className="checkpoint-list">
              {h.checkpointIds.map((cid) => {
                const c = checkpointById[cid];
                const record = records[cid];
                const recordDay = record
                  ? attempt.days.find((d) => d.id === record.dayId)!
                  : day;
                const schedule = scheduleForCheckpoint(recordDay, cid);
                return (
                  <button
                    key={cid}
                    className={`checkpoint-row ${cid === attempt.cursor ? "active" : ""}`}
                    onClick={() => onOpen(cid)}
                  >
                    <span
                      className={`outcome-icon ${record ? "recorded" : ""}`}
                    >
                      <OutcomeIcon outcome={record?.outcome} />
                    </span>
                    <span>
                      <strong>{c.title}</strong>
                      <small>
                        {elapsedLabel(c.offsetMinutes)} ·{" "}
                        {clock(
                          scheduledInstant(schedule, c.offsetMinutes),
                          schedule.timeZone,
                          true,
                        )}{" "}
                        ·{" "}
                        {c.trialWindowSeconds
                          ? `${c.trialWindowSeconds}s optional trial`
                          : c.kind.replaceAll("_", " ")}
                      </small>
                    </span>
                    <span className="checkpoint-state">
                      {record ? outcomeLabels[record.outcome] : "Open"}
                      <ArrowRight size={15} />
                    </span>
                  </button>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
export function ComfortCheck({
  note,
  setNote,
  side,
  setSide,
  bilateral,
  onDiscomfort,
  attendance,
  setAttendance,
  teacher,
}: {
  note: string;
  setNote(value: string): void;
  side: CompletionRecord["side"];
  setSide(value: CompletionRecord["side"]): void;
  bilateral: boolean;
  onDiscomfort(reason: string): void;
  attendance: boolean;
  setAttendance(value: boolean): void;
  teacher: boolean;
}) {
  return (
    <section className="comfort-check">
      <h3>How does this feel?</h3>
      <p className="small">
        Choose comfort over range. Observing or resting is always a valid
        choice.
      </p>
      <div className="comfort-actions">
        <button onClick={() => onDiscomfort("Pain")} className="danger-outline">
          Pain · stop
        </button>
        <button
          onClick={() => onDiscomfort("Dizziness")}
          className="danger-outline"
        >
          Dizziness · stop
        </button>
        <button
          onClick={() => onDiscomfort("Unusual discomfort")}
          className="danger-outline"
        >
          Discomfort · stop
        </button>
      </div>
      {bilateral && (
        <label>
          Side explored
          <select
            value={side}
            onChange={(e) =>
              setSide(e.target.value as CompletionRecord["side"])
            }
          >
            <option value="both">Both sides, comfortably</option>
            <option value="left">Left side only</option>
            <option value="right">Right side only</option>
            <option value="observe">Observed only</option>
          </select>
        </label>
      )}
      {teacher && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={attendance}
            onChange={(e) => setAttendance(e.target.checked)}
          />
          I attended with a qualified teacher (self-reported)
        </label>
      )}
      <label htmlFor="comfort-note">
        Comfort note <span className="muted">(optional)</span>
      </label>
      <textarea
        id="comfort-note"
        maxLength={2000}
        value={note}
        onChange={(e) =>
          setNote(
            e.target.value.replace(
              /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
              "",
            ),
          )
        }
        placeholder="Supports you used, what felt comfortable, or a question for your teacher…"
        rows={3}
      />
    </section>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card empty-state">
      <span className="empty-icon">
        <Leaf size={30} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function LearningNotice() {
  return (
    <div className="learning-notice">
      <Leaf size={19} />
      <p>
        <strong>A learning day, with room for life.</strong> The ten-hour window
        includes reading, rest and everyday activities. Physical practice is
        optional and brief.
      </p>
    </div>
  );
}
export function ResumeButton({
  onClick,
  children = "Continue learning",
}: {
  onClick(): void;
  children?: ReactNode;
}) {
  return (
    <button className="primary" onClick={onClick}>
      <Play size={17} fill="currentColor" />
      {children}
      <ArrowRight size={18} />
    </button>
  );
}
export const outcomeLabel = (outcome: string) =>
  outcomeLabels[outcome] ?? outcome;
