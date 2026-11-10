import {
  emptyProgress,
  parseProgress,
  restoreProgress,
  STORAGE_KEY,
} from "./progress";
import type { Progress } from "./progress";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function loadProgress(storage: StorageLike): {
  data: Progress;
  commitId: string | null;
  error: string | null;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const data = raw ? parseProgress(raw) : emptyProgress();
    return {
      data: restoreProgress(data),
      commitId: raw ? data.commitId : null,
      error: null,
    };
  } catch {
    return {
      data: emptyProgress(),
      commitId: null,
      error:
        "Saved progress could not be read. This session is unsaved; export it before leaving. Existing storage has been preserved.",
    };
  }
}
export function writeProgress(
  storage: StorageLike,
  data: Progress,
  expectedCommitId: string | null,
):
  | { ok: true; data: Progress }
  | { ok: false; conflict?: Progress; error?: string } {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const stored = raw ? parseProgress(raw) : null;
    if ((stored?.commitId ?? null) !== expectedCommitId)
      return { ok: false, conflict: stored ?? emptyProgress() };
    const saved = {
      ...data,
      revision: Math.max(data.revision, stored?.revision ?? 0) + 1,
      commitId: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return { ok: true, data: saved };
  } catch {
    return {
      ok: false,
      error:
        "Progress is unsaved because browser storage is unavailable or full. You can keep learning and export your progress.",
    };
  }
}
