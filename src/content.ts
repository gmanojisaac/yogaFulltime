import configData from "./Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/data/app-config.json";
import gradesData from "./Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/data/grades.json";
import hoursData from "./Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/data/hours.json";
import checkpointsData from "./Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/data/checkpoints.json";
import posesData from "./Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/data/poses.json";
import manifestData from "./Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/data/asset-manifest.json";
import { challengeDiagnostics, challengeInstruction, missionByHour, profileByGrade } from './curriculum/challenges';

export const config = configData;
export const grades = gradesData.map(grade => ({ ...grade, objective: profileByGrade[grade.id]?.summary ?? grade.objective }));
export const hours = hoursData.map(hour => ({ ...hour, title: missionByHour[hour.id]?.title ?? hour.title, learningGoal: missionByHour[hour.id]?.brief ?? hour.learningGoal }));
export const checkpoints = checkpointsData.map(checkpoint => ({ ...checkpoint, instruction: challengeInstruction(checkpoint) }));
export const poses = posesData;
export const manifest = manifestData;
export type Grade = (typeof grades)[number];
export type Hour = (typeof hours)[number];
export type Checkpoint = (typeof checkpoints)[number];
export type Pose = (typeof poses)[number];
export const gradeById = Object.fromEntries(grades.map((g) => [g.id, g]));
export const hourById = Object.fromEntries(hours.map((h) => [h.id, h]));
export const checkpointById = Object.fromEntries(
  checkpoints.map((c) => [c.id, c]),
);
export const poseById = Object.fromEntries(poses.map((p) => [p.id, p]));
export const gradeCheckpoints = (id: string) =>
  checkpoints.filter((c) => c.gradeId === id);

export function contentDiagnostics(): string[] {
  const errors: string[] = challengeDiagnostics();
  for (const [label, entries, count] of [
    ["grades", grades, 10],
    ["hours", hours, 100],
    ["checkpoints", checkpoints, 1200],
    ["poses", poses, 30],
  ] as const) {
    if (
      entries.length !== count ||
      new Set(entries.map((e) => e.id)).size !== count
    )
      errors.push(`Expected ${count} unique ${label}.`);
  }
  for (const g of grades) {
    if (
      g.hourIds.length !== 10 ||
      gradeCheckpoints(g.id).length !== 120 ||
      g.poseIds.length !== 3
    )
      errors.push(`${g.id}: invalid grade structure.`);
    if (
      g.hourIds.some((id) => hourById[id]?.gradeId !== g.id) ||
      g.poseIds.some((id) => poseById[id]?.gradeId !== g.id)
    )
      errors.push(`${g.id}: missing hour or pose reference.`);
  }
  for (const h of hours) {
    if (
      !gradeById[h.gradeId] ||
      !poseById[h.poseId] ||
      h.checkpointIds.length !== 12 ||
      h.checkpointIds.some((id) => checkpointById[id]?.hourId !== h.id)
    )
      errors.push(`${h.id}: invalid hour references.`);
  }
  for (const c of checkpoints) {
    if (
      !hourById[c.hourId] ||
      hourById[c.hourId].gradeId !== c.gradeId ||
      !poseById[c.poseId]
    )
      errors.push(`${c.id}: missing lesson reference.`);
    if (
      ![0, 60, 120].includes(c.trialWindowSeconds) ||
      c.autoComplete ||
      (gradeById[c.gradeId]?.number >= 9 && c.trialWindowSeconds !== 0)
    )
      errors.push(`${c.id}: unsafe trial configuration.`);
  }
  for (const p of poses) {
    const asset = manifest.poseAssets.find((a) => a.id === p.assetId);
    if (
      !asset ||
      JSON.stringify(p.asset) !==
        JSON.stringify(
          Object.fromEntries(Object.entries(asset).filter(([k]) => k !== "id")),
        )
    )
      errors.push(`${p.id}: artwork mapping mismatch.`);
  }
  return errors;
}
