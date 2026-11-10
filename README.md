# Yoga10

A mobile-first, local-first yoga learning prototype built with React, TypeScript and Vite. The supplied kit is the curriculum and artwork source of truth: **10 grades, 100 hourly blocks, 1,200 checkpoints and 30 illustrated poses**.

## Run locally

Use Node.js 20.19+ (20.x), or 22.12+; a supported LTS release is recommended.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite, normally **http://127.0.0.1:5173**. No account, environment variables, database or paid API is needed.

```sh
npm test                 # Pure logic and DOM interaction tests
npm run validate:content # Counts, references, mappings and PNG SHA-256
npm run typecheck        # TypeScript
npm run build            # Validation, typecheck and production build
npm run preview          # Serve the built dist directory locally
```

## Included

- Welcome/setup, Today dashboard, ten-grade roadmap, grade details and browsable checkpoints.
- Player with setup/alignment/release cues, supports, bilateral guidance and visual review notes.
- Explicit 120/60-second optional trials, manual outcomes, pause/resume, stop/rest and comfort notes.
- All 120 checkpoints per grade, 30-pose gallery, repeat history, readiness reflections and journal.
- Saved learning days, IANA timezones, elapsed scheduling, schedule-change choices, reduced motion and optional sounds.
- Versioned localStorage, validated JSON import/export, merge/replace, confirmed reset, unsaved notices and tab-conflict choices.

## Timing and progress

The default learning window is 08:00–18:00 in Asia/Kolkata. It includes learning, rest and ordinary daily life. It is **not ten hours of exercise**. A grade can span multiple days.

The checkpoint cadence never grants completion. Trials require explicit start and include setup, short attempts, release and rest. Hiding the tab pauses trials. Reload restores them paused; revisiting an unfinished checkpoint preserves its remaining trial time. Expiry ends the window, then the user records an outcome. Grades 9–10 use teacher-guided observation/discussion and no physical timer.

Visible lesson time and active trial-window time are separate. Neither measures exertion or mastery. Saved day starts and outcome timestamps remain unchanged when settings change. Ambiguous or nonexistent local start times during daylight-saving changes are rejected with a readable message.

Progress is stored under `yoga10.progress.v1`. Export regularly: clearing browser data removes local history. Imports are limited to 5 MB and checked for known IDs, schedules, duration caps, plain-text notes and schema version. Merge deduplicates by attempt/checkpoint identity; current matching outcomes are kept. Readiness is a user reflection. Teacher attendance is self-reported and unverified.

## Source layout

```text
src/App.tsx             Screens, navigation and session orchestration
src/components.tsx      Artwork, grade, timeline and comfort components
src/SessionPlayer.tsx   Lesson player
src/content.ts          Immutable kit imports and runtime diagnostics
src/core/               Pure schedule, timer, progress and storage functions
src/useProgress.ts      Persistence, recovery and tab conflicts
src/styles.css          Supplied tokens and responsive styles
public/assets/characters/  Five unchanged PNG atlases
scripts/validate-content.mjs  Full curriculum/art validation
```

The original kit and prompts remain under `src/Yoga10_Codex_Assets_and_Prompt/`. The app imports the JSON directly and uses exact character copies in `public/`. Atlases are static square cells, never animation frames or mirrored poses.

## Editorial status and verification

Private prototype with draft instructional content. **Illustrative AI artwork - instructor review pending.** Retain the supplied stop rules, modifications and teacher guidance. Advanced readiness requires qualified assessment; completion does not award a mastery certificate.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for commands, results and remaining browser-verification limits. This build is local-only. Reminders are in-app only; there is no cloud sync or promise of background notifications or offline availability after clearing the cache.
