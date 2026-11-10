import data from './challenges.json';
import baseHours from '../Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/data/hours.json';
import basePoses from '../Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/data/poses.json';
import type { Checkpoint } from '../Yoga10_Codex_Assets_and_Prompt/Yoga10_Codex_Kit/examples/models';

export const CHALLENGE_VERSION = 2 as const;
export interface GradeProfile {
  gradeId: string;
  stage: string;
  summary: string;
  prerequisite: string;
  competencies: string[];
  supervised: boolean;
}
export interface Mission {
  id: string;
  gradeId: string;
  hour: number;
  title: string;
  brief: string;
  tasks: [string, string, string];
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  teacherOnly: boolean;
}
type Seed = [string, string, string, string, string, string, string];
export const gradeProfiles = data.profiles as GradeProfile[];
export const profileByGrade = Object.fromEntries(gradeProfiles.map(p => [p.gradeId, p]));
export const missions: Mission[] = Object.entries(data.missions).flatMap(([gradeId, rawSeeds]) => rawSeeds.map((raw, index) => {
  const [title, brief, question, correct, wrongA, wrongB, explanation] = raw as Seed;
  const profile = profileByGrade[gradeId];
  const hour = baseHours.find(h => h.gradeId === gradeId && h.number === index + 1)!;
  const pose = basePoses.find(p => p.id === hour.poseId)!;
  const answerPosition = (index + Number(gradeId.slice(1))) % 3;
  const options = [wrongA, wrongB]; options.splice(answerPosition, 0, correct);
  return {
    id: hour.id, gradeId, hour: index + 1, title, brief,
    tasks: [
      brief,
      profile.supervised
        ? `Separate what is visible in ${pose.name} from what your teacher must assess. Include the illustration review note in your discussion.`
        : `Explain why this cue matters for ${pose.name}: “${pose.alignment}” Include a support choice and a deliberate release. Observation is a valid way to answer.`,
      index === 9
        ? `Defend a case using ${profile.competencies.join(', ').toLowerCase()}. State what remains uncertain and what needs qualified review.`
        : `Use the scenario below to challenge your reasoning. Describe an observation, an alternative and why you chose it; a checkbox alone is not evidence of physical readiness.`,
    ],
    question, options, correctAnswer: answerPosition, explanation, teacherOnly: profile.supervised,
  };
}));
export const missionByHour = Object.fromEntries(missions.map(m => [m.id, m]));

export function missionComplete(evidence: { checks: boolean[]; answer: number | null; reflection: string }, mission: Mission): boolean {
  return evidence.checks.length === 3 && evidence.checks.every(Boolean) && evidence.answer === mission.correctAnswer && evidence.reflection.trim().length >= 40;
}

export function challengeInstruction(checkpoint: Pick<Checkpoint, 'hourId' | 'numberWithinGrade' | 'instruction' | 'trialWindowSeconds'>): string {
  const mission = missionByHour[checkpoint.hourId];
  if (!mission) return checkpoint.instruction;
  const phase = (checkpoint.numberWithinGrade - 1) % 12;
  const context = `${mission.title}: `;
  if (mission.hour === 10) return `${context}${[
    mission.brief,
    'Read your saved observations and identify what is evidence, assumption or an unresolved question.',
    mission.tasks[2],
    'Mentally rehearse the case and discuss alternatives. This capstone checkpoint has no physical trial.',
    'Audit each decision against comfort, support and normal breathing.',
    'Take a comfortable rest. The capstone does not require continuous physical activity.',
    mission.question,
    'Breathe normally in a comfortable resting position; no breath holds.',
    mission.teacherOnly ? 'Discuss the decision trail with your qualified teacher; no unsupervised attempt.' : 'Compare your written options and explain why one better serves the learning objective.',
    'Explain the release and fallback for every position in your written plan.',
    'Submit the mission’s scenario answer, self-reported evidence and written reflection when ready.',
    'Save your notes and return to normal life. Revisit unanswered questions on another day.',
  ][phase]}`;
  const prompts = [
    `${mission.brief} Read the image review note before forming an alignment assumption.`,
    mission.tasks[1],
    `Plan the entry, support, one technical priority and a release for this mission. ${mission.teacherOnly ? 'Prepare questions for your teacher; no physical trial is offered.' : 'Choose observation if the setup is uncertain.'}`,
    `${checkpoint.instruction} Technical question: ${mission.question} ${mission.teacherOnly ? 'Keep this as teacher-guided observation.' : 'Attend to one clear priority at a time; the window includes setup and rest, not a continuous hold.'}`,
    'Compare an actual observation with your initial assumption. Name any uncertainty; pain or dizziness ends the attempt immediately.',
    'Release and take a comfortable rest. Greater technical depth does not remove recovery.',
    `Analyse the scenario: ${mission.question} Explain why one alternative is more defensible.`,
    'Audit normal, unforced breathing. If the task disrupts comfort or breathing, simplify or rest; do not use breath holds.',
    `${checkpoint.instruction} Compare with your earlier observation without increasing range or adding repetitions to fill the timer. ${mission.teacherOnly ? 'Discussion only; there is no unsupervised physical trial.' : 'Retain dependable support and stop early when needed.'}`,
    `${checkpoint.instruction} Explain what makes this exit deliberate rather than rushed.`,
    'Write an observation, your chosen adaptation and the reason for it in the technical mission. Knowledge results and self-reports do not verify physical readiness.',
    'Save any unfinished question and return to normal activities. Continue later rather than increasing physical volume.',
  ];
  return context + prompts[phase];
}

export function challengeDiagnostics(): string[] {
  const errors: string[] = [];
  if (gradeProfiles.length !== 10 || missions.length !== 100 || new Set(missions.map(m => m.id)).size !== 100) errors.push('Expected ten challenge profiles and 100 distinct hourly missions.');
  for (const profile of gradeProfiles) {
    if (missions.filter(m => m.gradeId === profile.gradeId).length !== 10 || profile.competencies.length !== 3) errors.push(`${profile.gradeId}: incomplete challenge profile.`);
  }
  for (const mission of missions) {
    if (mission.tasks.length !== 3 || mission.options.length !== 3 || !mission.options[mission.correctAnswer] || !mission.question || !mission.brief) errors.push(`${mission.id}: invalid mission assessment.`);
    if (mission.teacherOnly !== (Number(mission.gradeId.slice(1)) >= 9)) errors.push(`${mission.id}: teacher guidance mismatch.`);
  }
  return errors;
}
