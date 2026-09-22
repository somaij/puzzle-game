# Photo inbox

Drop your own landscape photos here to turn them into daily puzzles. Git ignores
everything in this folder except this README, so your originals (and the GPS
location most photos carry) are never committed.

1. **Copy photos in.** JPEG, PNG, WebP or TIFF (convert iPhone HEIC to JPEG
   first). Landscape orientation: 3:2 fits exactly; 4:3 phone photos lose a
   strip from the top and bottom. Portrait photos are skipped.
2. **Review:** `npm run photos:review`, then open `photos-inbox/review.html` in
   a browser. Each photo is shown as the game will use it, with the 6×4 board
   drawn over it. Areas marked red have almost no detail (plain sky, snow,
   water, fog), so those pieces would be close to guesswork.
3. **Choose.** Delete (or move out) any photo you don't want. To shift a crop,
   add it to `photos-inbox/crops.json`, e.g. `{ "IMG_1234.jpg": 0.3 }`: 0 keeps
   the top (or left) edge, 1 the bottom (or right), 0.5 is centred. Re-run the
   review to check.
4. **Add:** `npm run photos:add`. Each photo left here is cropped to 3:2,
   resized to 1280×853, stripped of all metadata, saved as the next
   `assets/puzzles/NNNN.jpg`, credited in `assets/puzzles/CREDITS.md` and added
   to the day list. The original moves to `photos-inbox/added/`.
5. **Publish:** commit, push, and `npm run deploy`.

Photos join the end of the list in file-name order, one per day. Rename files
before adding if you want a particular order.
