# Yoga10 local verification

## User story

Welcome/setup → saved grade attempt and learning day → lesson checkpoint → explicit optional trial → pause or stop → manual outcome → local progress → reload/resume. This version has no application API or remote database.

## Commands and evidence

| Command                                   | Result                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Dependency installation                   | Compatible React 19 / TypeScript 7 / Vite 8 stack installed; package-lock.json generated                |
| `npm run validate:content`                | 10 grades, 100 hours, 1,200 checkpoints, 30 unique pose cells, references and five PNG hashes validated |
| `npm run typecheck`                       | Passed                                                                                                  |
| `npm test`                                | 25 pure and DOM interaction checks passed in Vitest                                                     |
| `npm run build`                           | Passed; outputs `dist/`                                                                                 |
| `npm run dev -- --port 5173 --strictPort` | Vite served the app locally                                                                             |
| HTTP GET `http://127.0.0.1:5173`          | HTTP 200                                                                                                |

Tests cover midnight/DST scheduling, invalid local times, explicit trial starts, pause/resume, hidden/reload time exclusion, caps, idempotent completion, skips, repeated attempts, history, imports, merging and storage failures. DOM tests exercise setup, trial controls, backgrounding, reload, notes, rest, teacher-only controls, grade/pose browsing, schedule changes and concurrent-tab choices through actual React components.

## Verification limits

- The browser host returned **“The browser access host is unavailable.”** Native Chrome access returned **“Computer Use app approval timed out.”**
- A real-browser smoke test, screenshots, console inspection, visual review of all 30 rendered cells, and measured overflow/focus/contrast checks at **360px, 768px and 1440px** remain unverified. DOM tests do not substitute for those checks.
- Responsive layouts, semantic controls, focus styles, 44px targets, alt text and reduced motion are implemented. Browser/device accessibility verification remains necessary.
- Artwork/curriculum require qualified instructor review. No instructor verification workflow is included.
- Progress is per browser/origin. Clearing storage removes it; export for backups. There are no accounts, cloud sync, guaranteed offline reloads or background notifications.

## Browser checklist when access is available

1. Check every screen at 360px, 768px and 1440px for overflow, readable text and visible keyboard focus.
2. Complete setup. Enter the first trial, explicitly start, pause and resume. Hide the tab and reload; confirm paused state and excluded hidden time.
3. Save a comfort note and outcome, reload and revisit; confirm counts remain unchanged.
4. Inspect all 30 gallery poses for full bodies and square cells; test a missing atlas and alternative text.
5. Browse Grades 9–10: observation/teacher discussion only, with no physical timer.
6. Test both schedule-change choices and confirm old records keep original timestamps/zones.
7. Export/import, merge duplicates, reject malformed files, repeat a grade, and test blocked/full storage.
8. Change progress in two tabs and confirm a visible reload/merge choice protects saved outcomes.
9. Verify reduced motion, optional audio after interaction, contrast and screen-reader announcements.

## Production HTTP check

The production build was also served with `npm run preview -- --port 4173 --strictPort`. HTTP verification passed for the entry page, all 10 linked JavaScript/CSS files and all five PNG atlases. The PNG response hashes matched the supplied manifest. Owned preview servers were stopped after verification.
