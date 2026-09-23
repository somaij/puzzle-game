---
name: add-photos
description: Add new daily puzzle photos to this repo (crop, resize, strip metadata, credit, and append to the daily image list). Use when the user wants to add their own photos as future daily puzzles.
---

Drop the originals in `photos-inbox/` (git-ignored except its README), run
`npm run photos:review` and check `photos-inbox/review.html`, then
`npm run photos:add`.

The script (`scripts/prepare-photos.mjs`, uses `sharp`, dev-only) crops to
3:2, resizes to 1280×853, strips all metadata, flags photos with more than 4
low-detail cells, numbers them, credits them, and regenerates
`src/puzzleImages.ts`. Its 6×4 / 3:2 numbers must match
`src/engine/constants.ts`.

Only append — never reorder, remove, or renumber `assets/puzzles/NNNN.jpg`,
since day N always shows image `(N − 1) mod count` and existing days must
keep showing the same photo they always have.
