import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyProgress,
  mergeProgress,
  parseProgress,
  restoreProgress,
  STORAGE_KEY,
} from "./core/progress";
import type { Progress } from "./core/progress";
import { loadProgress, writeProgress } from "./core/storage";
import { restoreTimer } from "./core/timer";

// Read localStorage inside the storage helpers' try/catch, including revoked access.
const browserStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};

export function useProgress() {
  const [initial] = useState(() => {
    try {
      return loadProgress(localStorage);
    } catch {
      return {
        data: emptyProgress(),
        commitId: null,
        error:
          "Browser storage is unavailable. Export your progress before leaving.",
      };
    }
  });
  const [data, setData] = useState(initial.data);
  const current = useRef(data);
  const savedCommit = useRef(initial.commitId);
  const [unsaved, setUnsaved] = useState(initial.error);
  const [conflict, setConflict] = useState<Progress | null>(null);
  const blocked = useRef(!!initial.error);

  const update = useCallback((change: (value: Progress) => Progress) => {
    let next = change(current.current);
    if (next === current.current) return;
    if (!blocked.current) {
      const result = writeProgress(browserStorage, next, savedCommit.current);
      if (result.ok) {
        next = result.data;
        savedCommit.current = next.commitId;
        setUnsaved(null);
      } else {
        blocked.current = true;
        if (result.conflict) {
          next = restoreProgress(next);
          setConflict(result.conflict);
        } else
          setUnsaved(
            result.error ?? "This session is unsaved. Export your progress.",
          );
      }
    }
    current.current = next;
    setData(next);
  }, []);

  useEffect(() => {
    function storageChanged(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return;
      try {
        const remote = event.newValue
          ? parseProgress(event.newValue)
          : emptyProgress();
        if (remote.commitId === savedCommit.current) return;
        blocked.current = true;
        const paused = {
          ...current.current,
          attempts: current.current.attempts.map((a) => ({
            ...a,
            timer: a.timer ? restoreTimer(a.timer) : null,
          })),
        };
        current.current = paused;
        setData(paused);
        setConflict(remote);
      } catch {
        blocked.current = true;
        setUnsaved(
          "Another tab wrote unreadable progress. Export this session before reloading.",
        );
      }
    }
    addEventListener("storage", storageChanged);
    return () => removeEventListener("storage", storageChanged);
  }, []);

  function resolveConflict(mode: "reload" | "merge") {
    // Re-read at the point of resolution so an open dialog cannot overwrite newer changes.
    try {
      const loaded = loadProgress(localStorage);
      if (loaded.error) {
        setUnsaved(loaded.error);
        return;
      }
      const next =
        mode === "reload"
          ? loaded.data
          : mergeProgress(restoreProgress(current.current), loaded.data);
      savedCommit.current = loaded.commitId;
      blocked.current = false;
      setConflict(null);
      setUnsaved(null);
      current.current = next;
      setData(next);
      update((s) => ({ ...s }));
    } catch {
      setUnsaved("Could not resolve storage changes. Export your progress.");
    }
  }

  function replace(data: Progress) {
    // Import replacement and reset are explicit user actions, including recovery from invalid storage.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let expected: string | null = null;
      try {
        expected = raw ? parseProgress(raw).commitId : null;
      } catch {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...restoreProgress(data),
            commitId: crypto.randomUUID(),
          }),
        );
        const restored = loadProgress(localStorage);
        current.current = restored.data;
        setData(restored.data);
        savedCommit.current = restored.commitId;
        blocked.current = false;
        setUnsaved(null);
        setConflict(null);
        return;
      }
      savedCommit.current = expected;
      blocked.current = false;
      setConflict(null);
      update(() => restoreProgress(data));
    } catch {
      current.current = data;
      setData(data);
      blocked.current = true;
      setUnsaved("This session is unsaved. Export your progress.");
    }
  }
  return { data, update, replace, unsaved, conflict, resolveConflict };
}
