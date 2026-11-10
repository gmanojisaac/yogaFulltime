# Build Yoga10 from this asset kit

You are working in my Codex project. Build a complete mobile-first yoga learning web application named Yoga10 using the attached Yoga10_Codex_Kit folder. Inspect the folder first. Use the supplied lesson data and character artwork as the source of truth. Implement, run, test and fix the application through its normal entry points. Make sensible reversible decisions and complete the local build.

## Product

There are exactly 10 grades. Each grade contains 10 hourly learning blocks. Each hour contains 12 checkpoints at five-minute intervals, so there are 120 checkpoints per grade and 1,200 across the programme.

The default daily window is 08:00 to 18:00 in the user's selected local timezone, initially Asia/Kolkata. Let the user change the start time and resume across days. A grade can take multiple days. Show learning time and optional physical practice time separately. Use the ten-hour window for learning, brief attempts, rest and normal daily life. Never frame it as ten hours of continuous exercise.

Use the original friendly adult South Asian 3D animated character Aadi throughout. The supplied PNGs are five opaque sprite atlases, each with three columns and two rows. They contain 30 static pose illustrations. Read data/asset-manifest.json and data/poses.json for exact mappings. Use examples/PoseSprite.tsx as a reference. Avoid stretching, clipping bodies, arbitrary mirroring, or treating the character sheets as animation frames.

## Starting files

- data/app-config.json sets product counts, timing and safety behavior.
- data/grades.json contains the 10 grades and their lesson references.
- data/hours.json contains 100 actual hour records.
- data/checkpoints.json contains all 1,200 explicit learning checkpoints.
- data/poses.json contains setup, alignment, release, modification, bilateral and visual-review fields for each pose.
- data/asset-manifest.json contains asset dimensions, SHA-256 hashes, grid mappings and alt text.
- public/assets/characters/ contains the five PNG atlases. Copy this subtree into the application's public directory.
- design/tokens.json and design/theme.css specify the visual system.
- preview.html is an interactive visual reference that can be opened directly from this kit. It demonstrates the dashboard, lesson composition and artwork gallery. Implement the full behavior below in the finished app.
- docs/CURRICULUM.md explains the new grade mapping and session logic.
- docs/ART_REVIEW.md records the illustration limitations and review process.
- docs/image-generation-prompts.json preserves the original artwork prompts for future image generation.
- examples/models.ts documents the main content types.

## Stack and architecture

Use the existing repository stack if suitable. For a fresh project, use React, TypeScript and Vite, semantic HTML and CSS, with a small icon library if helpful. Use current compatible package versions and commit a lockfile. Keep the first version local-first, with no account requirement or paid API. Use a versioned local persistence layer and pure functions for scheduling and progress. Choose localStorage for modest settings/progress and IndexedDB only if needed. Keep instructional JSON immutable. User notes and status belong in separate state.

Do not load the prototype as an iframe. Build reusable, accessible components for GradeCard, HourTimeline, CheckpointList, PoseSprite, SessionPlayer, ComfortCheck and ProgressSummary. Include clear loading, missing-art and invalid-content states. Keep the body text readable and touch targets at least 44 pixels. Prevent horizontal overflow at 360px width.

## Screens

1. Welcome and setup. Introduce Aadi, explain the ten-grade learning format, select start time and timezone, and allow reduced motion and optional sounds. Explain that these are draft AI illustrations awaiting instructor review.
2. Today dashboard. Show selected grade, current hour, next checkpoint, resume action, ten-hour timeline, completed/observed/skipped counts, optional active practice minutes and an illustrated character card.
3. Grade roadmap. Show all 10 grades with their three illustrated poses, purpose and progress. Allow all content to be browsed. Starting another grade asks for an explicit choice and preserves previous history.
4. Grade detail. Show ten hour cards and their learning goals. Clearly label Grades 9 and 10 as teacher-guided preparation.
5. Exercise player. Show one large character pose, title, setup/alignment/release cues, support instructions, current checkpoint, side guidance when bilateral, trial timer when appropriate, pause, end, mark observed, skip and next. Show the pose's visualReviewNote beside the illustration.
6. Checkpoint timeline. Show all 120 checkpoints for the selected grade with scheduled offsets and completion states. Allow revisit without creating duplicate completion counts.
7. Progress and journal. Separate learning completion from skill readiness. Include comfort notes, modified/observed/skipped records, completed trial minutes, grade attempt history and repeat-grade action.
8. Settings. Change daily window, timezone, sound and reduced motion. Include export/import of versioned progress JSON and a confirmed reset action.

On mobile, use bottom navigation for Today, Grades, Progress and Settings. On desktop, use a narrow sidebar and a generous main content area. Show a cream background, deep teal text, white rounded cards, sage accents and restrained gold highlights. Use the artwork's existing warm background naturally. Do not place text inside the artwork.

## Timing and completion

Create a learning-day record with a unique ID, grade ID, date, start time, timezone, checkpoint statuses and cumulative active trial duration. Save checkpoint keys using stable grade/hour/checkpoint IDs plus the learning-day/attempt ID.

Represent the ten-hour schedule as elapsed offsets from that day's saved start instant. Explain that the schedule ends ten elapsed hours later, including across midnight or a daylight-saving change. Display clock times in the saved timezone. Keep previous sessions' timestamps unchanged when settings change. Ask whether to apply new schedule settings to a new day or reschedule the uncompleted part of the current day.

The five-minute interval is a checkpoint cadence. Physical activity uses only trialWindowSeconds and requires an explicit user start. Never run a five-minute pose-hold timer. Trial windows include setup, short attempts and rests. Stop a trial immediately on pause, end or discomfort. A paused timer resumes from the saved remaining duration.

Use timestamp-based timer calculations while the app is active. On page hide, save and pause active physical trials. On reload or return from background, restore paused state and ask the user to resume. Never grant completion or accumulate physical exercise time while the tab is hidden. A visible timer reaching zero only ends the window; the user still records the outcome.

Never automatically complete missed checkpoints, progress to another physical pose, or advance a grade because time passed. Default to manual next. Skip is a distinct state and must not count as mastered. Reopening a completed checkpoint must be idempotent. Preserve earlier attempts when the grade is repeated.

Grades 9 and 10 use observation and teacher discussion checkpoints with zero active trial seconds in the supplied data. Keep those teacher-guided records intact. A user may record teacher-guided attendance but self-reporting is not instructor verification. Do not unlock unsupervised inversions, airborne arm balances or deep backbends.

Notifications, if implemented, must be optional and accurately described. In-app reminders are sufficient for this version. Do not promise reliable background reminders when the browser is closed.

## Motion and audio

The PNGs are static illustrations, with no rig, joint data, animation clips or audio. Use subtle card entrance, crossfade between separate illustrations and a separate optional breathing circle. Keep the body artwork still during alignment instructions. Respect prefers-reduced-motion and provide a persistent motion setting. Use normal unforced breathing guidance without breath-hold instructions. Sound is optional and starts only after user interaction. Show all spoken or sound information visually as well.

## Safety and editorial status

Retain the supplied stop rules, individual modifications and qualified-teacher guidance. Show "Illustrative AI artwork - instructor review pending" in the player until an actual qualified review has been recorded by an authorized editor in a later content workflow. Do not infer that generated images are clinically validated. The initial app is a private prototype with draft instructional content.

Provide a visible Stop and rest control. Logging pain or dizziness ends the active timer, offers a comfortable rest screen and preserves the note. Do not diagnose, make treatment claims, score anatomy from a camera, promise weight loss or award a mastery certificate. Keep all readiness language honest and user-controlled.

## Data integrity and export

Validate data at startup or build time. Confirm 10 grades, 100 hours, 1,200 checkpoints, 30 poses and all asset references. Show a readable diagnostic if a reference is missing.

Validate imported progress against a versioned schema, enforce sensible size limits, reject malformed IDs and unsafe text, and ask whether to merge or replace. Merging must avoid duplicate checkpoint counts. Escape journal text through normal React rendering. Never execute imported HTML or JavaScript. On storage failure, keep the current session usable, show a clear unsaved-state notice and offer export.

Handle two browser tabs without silent overwrites. Use revision/version checks or storage events and give a clear reload/merge choice when concurrent changes conflict.

## Acceptance checks

- All 30 pose cells render correctly from the actual supplied atlases.
- The grade map contains exactly 10 grades, with 10 hours and 120 checkpoints each.
- Trial windows have explicit start and use the supplied 120-second/60-second caps.
- Grades 9-10 have observation checkpoints and no automatic physical timer.
- Pause, resume, backgrounding, reload, skipped checkpoints and repeats preserve correct state.
- Completion is idempotent and independent of the clock.
- Changing timezone/start time preserves recorded history.
- Export/import round-trip preserves notes and progress and rejects malformed data.
- Empty state, missing artwork, storage failure and concurrent tabs are handled.
- Keyboard focus, button names, color contrast, screen-reader text and reduced motion work.
- Check 360px mobile, 768px tablet and 1440px desktop widths.
- Build and typecheck pass. Add focused tests for scheduling, timer state and progress persistence. Run a browser smoke test through setup, trial, pause, completion and reload.

Deliver the working project, concise setup instructions, the commands actually run and their results, and any remaining limitations. Finish the locally testable product before reporting completion.
