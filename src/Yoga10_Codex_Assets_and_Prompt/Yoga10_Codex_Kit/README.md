# Yoga10 Codex asset kit

This package supplies the character artwork, revised curriculum and build instructions for a new yoga learning app.

## Start here

1. Extract this ZIP into a folder you can open with Codex.
2. Open preview.html in a browser to inspect the visual direction and all 30 character poses.
3. Open CODEX_BUILD_PROMPT.md, copy its full text and paste it into Codex with this folder available.
4. Ask Codex to build and run the application, following the acceptance checks in the prompt.

## Contents

| File or folder | Purpose |
| --- | --- |
| CODEX_BUILD_PROMPT.md | Full ready-to-paste implementation prompt |
| preview.html | Local interactive design and artwork preview |
| public/assets/characters/ | Five PNG atlases containing 30 character poses |
| data/ | Ten grades, 100 hours, 1,200 checkpoints, poses and asset mappings |
| design/ | Color, spacing and typography tokens plus CSS |
| examples/ | Reusable React pose renderer and TypeScript content types |
| docs/ | Curriculum, illustration review notes and image-generation prompts |

The character is an original adult South Asian male named Aadi, rendered with a polished 3D animated film aesthetic. Aadi and Yoga10 are working names that can be changed.

The schedule defaults to 08:00-18:00. Its ten hours contain learning, normal life, recovery and short optional practice windows. Each grade may span multiple days. Grades 9-10 use supervised preparation and observation.

The artwork consists of static opaque PNG sprite sheets. These files do not include a rigged 3D model, movement animation, video or recorded narration. The illustrations and draft lesson cues require qualified instructor review before public instructional use. Read docs/ART_REVIEW.md for specific observations.

All data references and artwork mappings have been checked. preview.html is a design reference; Codex should implement the complete application described in the prompt.
