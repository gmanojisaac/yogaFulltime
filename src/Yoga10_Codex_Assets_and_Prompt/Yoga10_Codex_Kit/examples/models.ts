export type CheckpointKind = "learning" | "recovery" | "optional_practice" | "teacher_observation";
export type Outcome = "completed" | "observed" | "modified" | "skipped" | "discomfort";
export interface Checkpoint {
  id: string;
  gradeId: string;
  hourId: string;
  poseId: string;
  numberWithinGrade: number;
  offsetMinutes: number;
  title: string;
  instruction: string;
  kind: CheckpointKind;
  windowSeconds: number;
  trialWindowSeconds: number;
  requiresExplicitStart: boolean;
  autoComplete: boolean;
}
export interface CompletionRecord {
  checkpointId: string;
  attemptId: string;
  outcome: Outcome;
  recordedAt: string;
  activeTrialSeconds: number;
  note: string;
}
export interface LearningAttempt {
  schemaVersion: 1;
  id: string;
  gradeId: string;
  localDate: string;
  timeZone: string;
  startsAt: string;
  revision: number;
  updatedAt: string;
  records: Record<string, CompletionRecord>;
}
