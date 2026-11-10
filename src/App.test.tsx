// @vitest-environment jsdom
import { act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  counts,
  emptyProgress,
  makeAttempt,
  parseProgress,
  recordsFor,
  saveOutcome,
  STORAGE_KEY,
} from "./core/progress";

function saved() {
  return parseProgress(localStorage.getItem(STORAGE_KEY)!);
}
function active() {
  const s = saved();
  return s.attempts.find((a) => a.id === s.activeAttemptId)!;
}
function seed(gradeId = "g01", checkpointId = `${gradeId}-h01-c04`) {
  const s = emptyProgress();
  const a = makeAttempt(gradeId, s.settings);
  a.cursor = checkpointId;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...s,
      setupDone: true,
      activeAttemptId: a.id,
      attempts: [a],
    }),
  );
}
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("normal application entry points", () => {
  it("renders all 30 supplied pose cells using exact atlas positions", () => {
    seed();
    const view = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Grades" }));
    expect(view.container.querySelectorAll(".grade-card").length).toBe(10);
    fireEvent.click(screen.getByRole("button", { name: "Meet all 30 poses" }));
    const cells = view.container.querySelectorAll<HTMLElement>(
      ".gallery-grid [data-pose]",
    );
    expect(cells).toHaveLength(30);
    expect(new Set(Array.from(cells, (c) => c.dataset.pose)).size).toBe(30);
    for (const cell of cells) {
      expect(cell.style.backgroundSize).toBe("300% 200%");
      expect(cell.style.aspectRatio).toBe("1");
      expect(cell.style.transform).toBe("");
    }
  });
  it("preserves history when repeating and requires an explicit new-grade choice", () => {
    seed();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Grades" }));
    fireEvent.click(
      screen.getByRole("button", { name: "View Grade 2: Gentle spine" }),
    );
    expect(screen.getAllByText("Browse the 12 checkpoints")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Start Grade 2" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(saved().attempts).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Start new attempt" }));
    expect(saved().attempts).toHaveLength(2);
    expect(active().gradeId).toBe("g02");
    fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    fireEvent.click(screen.getByRole("button", { name: "Repeat this grade" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Start fresh attempt" }),
    );
    expect(saved().attempts).toHaveLength(3);
    expect(counts(active()).total).toBe(0);
  });
  it("applies settings to future days without rewriting the saved schedule", () => {
    seed();
    render(<App />);
    const original = active().days[0].startsAt;
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Daily start time"), {
      target: { value: "09:30" },
    });
    fireEvent.change(screen.getByLabelText("Local timezone"), {
      target: { value: "Europe/London" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Use for new learning days" }),
    );
    expect(saved().settings.timeZone).toBe("Europe/London");
    expect(active().days[0].startsAt).toBe(original);
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue on a new day" }),
    );
    expect(active().days).toHaveLength(2);
    expect(active().days[1].timeZone).toBe("Europe/London");
    expect(active().days[0].startsAt).toBe(original);
  });
  it("merges concurrent tab records after a visible conflict choice", () => {
    seed();
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Begin first checkpoint" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark observed" }));
    const local = saved();
    const remoteAttempt = saveOutcome(
      { ...local.attempts[0], cursor: "g01-h01-c05" },
      "observed",
      "From the other tab.",
      "observe",
      false,
    );
    const remote = {
      ...local,
      commitId: crypto.randomUUID(),
      attempts: [remoteAttempt],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: JSON.stringify(remote),
        }),
      );
    });
    expect(
      screen.getByRole("heading", { name: "Progress changed in another tab" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Merge saved changes" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(counts(active()).observed).toBe(2);
  });
  it("completes setup, starts a trial, pauses, records once and restores on reload", () => {
    const view = render(<App />);
    expect(screen.getByRole("heading", { name: /Make yourself/ })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Begin my learning journey" }),
    );
    expect(
      screen.getByRole("heading", { name: "Welcome to your own pace." }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Begin first checkpoint" }),
    );
    for (let i = 0; i < 3; i++)
      fireEvent.click(screen.getByRole("button", { name: "Next checkpoint" }));
    expect(screen.getByRole("timer").textContent).toBe("02:00");
    vi.useFakeTimers();
    fireEvent.click(
      screen.getByRole("button", { name: "Start optional trial" }),
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Pause trial" }));
    expect(screen.getByRole("timer").textContent).toBe("01:55");
    fireEvent.change(screen.getByLabelText(/Comfort note/), {
      target: { value: "Used a folded blanket." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark completed" }));
    expect(counts(active()).completed).toBe(1);
    expect(recordsFor(active())["g01-h01-c04"].note).toBe(
      "Used a folded blanket.",
    );
    view.unmount();
    vi.useRealTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Resume learning" }));
    expect(screen.getByText("Completed · saved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark completed" })).toBeNull();
    expect(counts(active()).completed).toBe(1);
  });
  it("pauses on backgrounding, reloads paused, and preserves the trial across navigation", () => {
    seed();
    const view = render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Begin first checkpoint" }),
    );
    vi.useFakeTimers();
    fireEvent.click(
      screen.getByRole("button", { name: "Start optional trial" }),
    );
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const paused = active().timer!;
    act(() => {
      vi.advanceTimersByTime(300000);
    });
    expect(active().timer?.activeMs).toBe(paused.activeMs);
    expect(active().timer?.state).toBe("paused");
    view.unmount();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    vi.useRealTimers();
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Begin first checkpoint" }),
    );
    expect(screen.getByRole("button", { name: "Resume trial" })).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("01:56");
    fireEvent.click(screen.getByRole("button", { name: "Next checkpoint" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Today" }));
    fireEvent.click(
      screen.getByRole("button", { name: "All 120 checkpoints" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Try or observe \+0h 15m/ }),
    );
    expect(screen.getByRole("timer").textContent).toBe("01:56");
    expect(counts(active()).total).toBe(0);
  });
  it("stops for discomfort, preserves the note and offers rest", () => {
    seed();
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Begin first checkpoint" }),
    );
    vi.useFakeTimers();
    fireEvent.click(
      screen.getByRole("button", { name: "Start optional trial" }),
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.change(screen.getByLabelText(/Comfort note/), {
      target: { value: "Need a support." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pain · stop" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Take a comfortable rest" }),
    ).toBeTruthy();
    expect(active().timer).toBeNull();
    expect(counts(active()).discomfort).toBe(1);
    expect(recordsFor(active())["g01-h01-c04"].note).toContain(
      "Need a support.",
    );
  });
  it("renders teacher-guided observation without trial or completion controls", () => {
    seed("g09");
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Begin first checkpoint" }),
    );
    expect(
      screen.queryByRole("button", { name: "Start optional trial" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark completed" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark observed" }));
    expect(counts(active()).observed).toBe(1);
    expect(counts(active()).trialMs).toBe(0);
  });
  it("shows the unsaved notice when storage fails and remains usable", () => {
    seed();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Begin first checkpoint" }),
    );
    expect(screen.getByRole("alert").textContent).toContain("unsaved");
    fireEvent.click(screen.getByRole("button", { name: "Mark observed" }));
    expect(screen.getByText("Observed · unsaved")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Export progress" }),
    ).toBeTruthy();
    vi.restoreAllMocks();
  });
});
