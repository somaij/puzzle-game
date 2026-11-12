---
name: add-photos
description: Add new daily puzzle photos to this repo (crop, resize, strip metadata, credit, and append to the daily image list). Use when the user wants to add their own photos as future daily puzzles.
---

Drop the originals in `photos-inbox/` (git-ignored except its README), run
`npm run photos:review` and check `photos-inbox/review.html`, then
`npm run photos:add`.

The script (`scripts/prepare-photos.mjs`, uses `sharp`, dev-only) crops to
3:2 automatically (`chooseCrop`: searches positions and up to 22% zoom for the
frame with the fewest blank cells, weighted against zoom, off-centre framing
and cutting through detail at the edge; portraits get a landscape slice; a
number in `photos-inbox/crops.json` overrides it), resizes to 1280×853, strips all metadata, flags photos with more than 4
low-detail cells, orders the batch for variety (`orderForVariety`: same-trip
dates and similar-looking photos are kept apart, compared over a 10-day
window that includes the last photos already in the game), numbers them, credits them, and regenerates
`src/puzzleImages.ts`. Its 6×4 / 3:2 numbers must match
`src/engine/constants.ts`.

Only append — never reorder, remove, or renumber `assets/puzzles/NNNN.jpg`,
since day N always shows image `(N − 1) mod count` and existing days must
keep showing the same photo they always have.
