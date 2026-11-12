# Photo inbox

Drop your own photos here to turn them into daily puzzles. Git ignores
everything in this folder except this README, so your originals (and the GPS
location most photos carry) are never committed.

1. **Copy photos in.** JPEG, PNG, WebP or TIFF (convert iPhone HEIC to JPEG
   first). Any shape works: each one is cropped to 3:2 automatically. The tool
   tries positions across the photo and a little zoom, and picks the frame
   that leaves the fewest blank pieces while staying natural (it prefers
   centred framing, zooms only when that clearly helps, and avoids slicing
   through strong detail at the edge). Landscape photos fit best; a portrait
   photo keeps a landscape slice of about half of it.
2. **Review:** `npm run photos:review`, then open `photos-inbox/review.html` in
   a browser. Each photo is shown whole with the chosen frame outlined, beside
   the puzzle as the game will use it with the 6×4 board drawn over it. Areas marked red have almost no detail (plain sky, snow,
   water, fog), so those pieces would be close to guesswork.
3. **Choose.** Delete (or move out) any photo you don't want. To place a
   frame yourself instead, add the photo to `photos-inbox/crops.json`, e.g.
   `{ "IMG_1234.jpg": 0.3 }`: that uses the widest 3:2 frame with no zoom, and
   0 keeps the top (or left) edge, 1 the bottom (or right), 0.5 is centred.
   Re-run the review to check.
4. **Add:** `npm run photos:add`. Each photo left here is cropped to 3:2,
   resized to 1280×853, stripped of all metadata, saved as the next
   `assets/puzzles/NNNN.jpg`, credited in `assets/puzzles/CREDITS.md` and added
   to the day list. The original moves to `photos-inbox/added/`.
5. **Publish:** commit and push to `main`; Cloudflare builds and deploys it.

Photos join the end of the list, one per day, **shuffled for variety**: the
tool spreads out photos from the same trip (dates in the file name within a few
days of each other) and photos that look alike (similar colours and layout),
comparing each day with the ten before it, including the last photos already in
the game. The review shows the day each photo will get. The order is the same
every time for the same inbox, and photos already in the game never move.
