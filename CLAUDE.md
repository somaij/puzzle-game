# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A **daily shared jigsaw puzzle for the web**, in the spirit of Wordle: one image
and one cut per day, the same for every player, with a shareable result. Built
with Expo so an Android (and iOS) app can later be built from the same code.
Working title only; a plain, descriptive final name is still open (the POC used
"Blind Cut" / "PulsePuzzle", and neither is final).

The core idea: pieces are fed from a small **hand of 3** (a hold slot is built but switched off)
rather than dumped in a tray. You drag any hand piece
onto a bare board and it locks into place, interlocking with its neighbours to
build the picture. Scoring rewards a **risk/flow** loop layered on top of an
otherwise relaxing jigsaw. Inspired in spirit (not mechanics) by Balatro: a
simple base action made deep by a scoring system.

Product filter: **solo-buildable, minimal surface area, privacy-first.** No
accounts, no backend, no ads, no analytics.

Earlier direction (now "later", see Product direction): a native Android app
that makes jigsaws from *your own photos*, sold as a one-time purchase.

## Status

Checkpoints 1–3 done: the daily puzzle is playable and scored on web.
A 10 s photo preview at the start, a hand of 3 (hold slot switched off), drag- or tap-to-place
(mouse and touch),
island/snap scoring, score multiplier with fast bonus, stall decay and a
countdown to the next drop, pulse ghosts, and a 12-miss limit (win on all 24
placed, fail on the 12th miss). A quick onboarding popup shows once per browser
(a header "?" button reopens it any time).
"Restart" replays freely until the one-play-per-day loop lands (checkpoint 4).

Test build is live at https://somaij.github.io/puzzle-game/ (GitHub Pages,
public repo `somaij/puzzle-game`). Redeploy with `npm run deploy`.

## The POC (read this first)

`docs/poc/pulse-puzzle.html` is the downloaded single-file HTML prototype. Treat
it as a reference for how the game should *feel*, not as code to port
wholesale. The exception is the piece geometry (`knob`/`pathFor`), which is
ported line for line into `src/engine/geometry.ts`, and a test checks the two
still match.

When in doubt about a behaviour, the POC is the tiebreaker for *feel*; this
document is the tiebreaker for *rules*. Where they disagree, this document wins
(see "Fixes" below).

## Core mechanic spec (from the POC)

**Board & pieces**
- Image is cut into an R×C grid of interlocking pieces (daily: 6×4 = 24).
- **Cells must be square.** The piece geometry lives in a 100×100 box, so
  non-square cells would misalign tabs. Daily images are 3:2 → 6×4 gives square
  cells.
- Each piece carries its own slice of the image, clipped to its jigsaw cut. A
  piece's tabs overflow into neighbouring cells so placed pieces form one
  continuous, seamless picture. Tabs stick out **14%** of a cell (`TAB_DEPTH`);
  each piece is drawn in a box padded **18%** (`PAD`) on every side so tabs and
  outlines aren't clipped.
- **The photo is shown once, before play** (`FLASH_MS` = 10000, with a
  countdown; `PhotoPreview`), then hidden for the rest of the game. No
  persistent reference, and nothing on drop reveals correctness: the player
  reads the fragment + cut (and what they remember) to place. The game's clocks
  start when the preview hides, and the hand is kept hidden until then.
  (A later Zen mode is meant to show a persistent dim reference instead; there
  is no mode switch yet.)
- The empty grid is **hidden**: the board is a bare assembly area. The only
  time a cell is indicated is a neutral gray outline under the piece being
  dragged (see below).

**Feed & controls**
- A **hand** of `HAND_SIZE` = 3 playable pieces, dealt from a shuffled deck.
  Any of them can be dragged. When one is placed (or held), the deck refills
  **that same slot**, so the other pieces don't move under the player; once
  the deck is empty, slots stay empty. The panel shows how many pieces are
  left in the deck. There is no separate preview queue: the hand is the
  visible upcoming set.
- Why a hand: with one forced piece at a time the player often had to
  blind-guess an island. With 3, once a few pieces are down a snap is nearly
  always on offer (simulated over 500 daily deals, greedy play: a snap was in
  hand on ~92% of turns after the third placement, ~95% digging with hold),
  so taking the 100-point island gamble becomes a choice. **Keep the hand
  small**: growing it toward a full tray brings back the cramped-pieces
  problem this design avoids.
- **Hold is switched off** (`HOLD_SLOT = false` in `constants.ts`) while
  playtesting a plain hand of 3: fewer rules, and on phones the 3 slots fill
  the row (~106 px, up from ~78 px). Only the UI checks the flag; the engine's
  hold rules below stay in place and tested, so flipping it brings hold back.
  Simulated over 500 daily deals with greedy play, "forced islands" per game
  (turns with no snap in hand, after the first piece): hand 3 + hold 2.25,
  hand 3 alone 2.91, hand 2 + hold 2.88, hand 2 alone 3.72, the POC's
  1 + hold 3.75. So hand 3 alone plays like 2 + hold with fewer rules, and a
  hand of 2 alone would bring back the POC's forced guessing.
- A **hold** slot (when on): drag a hand piece onto it to stash it (once per
  placement). Holding into an empty slot refills the hand from the deck;
  holding with a piece already held swaps them. The held piece can be
  **played straight from the slot**, so holding the last piece can't lock the
  game up. There is no keyboard shortcut (Space used to hold the single
  current piece; with a hand it would be ambiguous).

**Placement (drag-and-drop)**
- Drag a hand (or held) piece onto the board (pointer/touch).
- Drop on the **correct** cell → it locks in (scores; see below).
- Drop on a **wrong** cell → misplace penalty + brief red flash; piece returns.
- Drop **off-board / on a filled cell** → returns quietly, no penalty.
- While dragging, the cell under the piece shows a **neutral gray** outline only.
  It must NOT reveal whether the cell is correct. (An earlier version colored
  it teal/red for correct/wrong; that made it trivial and was removed. Do not
  reintroduce correctness hints during drag.)
- The dragged piece is drawn smaller than a placed one (box 1.12× a cell, so
  its body is ~82% of a cell, as in the POC), which keeps the neutral outline
  visible around it. The drop target is the cell under the piece's **centre**.
- On touch screens, the dragged piece is drawn **above the finger** (0.75× its
  size), not under it. The POC centres it on the pointer, which a thumb hides.
- The drop uses the **release event's** position, not the last move seen, so a
  fast flick lands where the finger lifted.
- **Tap-to-place** (the easier control on phones, and it works with a mouse):
  a press that moves less than `TAP_SLOP` (8 px) is a tap, not a drag. Tapping
  a hand or held piece selects it (accent border, and the panel says "Tap its
  spot on the board"); tapping it again deselects. With a piece selected, a tap
  on a board cell drops it there with the same rules as a drag; a tap on the
  hold slot (or on the held piece) holds it. A wrong cell also deselects, so an
  accidental double tap can't cost two misses; a filled cell is ignored. No
  correctness hint while selected, as with dragging.
- On web the game blocks double-tap zoom and the long-press menu
  (`touch-action: manipulation`, `-webkit-touch-callout: none`).

**Scoring: two axes, multiplied**
- *Difficulty axis (the headline):*
  - **Island** = placed with no already-placed orthogonal neighbour. Hard, a
    real read/gamble. Base **100**.
  - **Snap** = touches at least one placed piece. Easier, deducible. Base **25**.
- *Tempo axis (the flow multiplier, shown to players as "×1.3" beside the score):*
  - Range **1.0×–1.5×**. Starts at 1.0.
  - **Score and multiplier share one box** (simpler than two): "Score" and the
    value on the left, the multiplier ("×1.3") top right, and its gold meter
    running beside the score value. Misses left is its own slim box below
    (on wide screens, beside it).
  - That box shows the level (gold meter) and **the time until the
    multiplier drops**, both as seconds beside the meter ("3.2s", tenths,
    rounded up; "0.0s" in red while it is dropping) and as a line along the
    box's bottom edge. Both run from the last placement to the first decay
    step (`decayStartsAt`), reset on each placement, and are hidden at 1.0×
    (nothing left to lose). Holds and
    misses don't refill it. The 3 s fast window is deliberately *not* shown:
    a countdown running at 1.0× read to playtesters as the multiplier running
    out.
  - A "fast" placement (within **3000 ms** of the **previous placement**, or of
    the start of play for the first) adds **+0.1**. It means keeping up the
    pace; with a hand there is no single moment a piece is "presented".
  - After a **5000 ms** stall (no placement), the multiplier ticks **−0.1 per
    1000 ms** back toward 1.0.
  - A misplace costs **−0.1** (and one miss, below).
- **Points per placement = round(base × multiplier).**
- Design intent: island vs. snap is the star; flow is seasoning. Keep the
  island/snap gap the primary score lever, not the multiplier.

**Misses (Wordle-style limit)**
- Each puzzle allows **12 wrong drops** (`MISS_LIMIT`). The 12th ends the game
  ("Out of misses", status `failed`), keeping the score and pieces placed so
  far. Off-board / filled-cell drops don't count.
- Why: the multiplier can't go below 1.0×, so on its own a misplace cost
  nothing at the floor and islands could be brute-forced cell by cell. A shared
  daily score needs wrong guesses to cost something.
- The misses box is labelled **"Misses left"** and shows the count as a number
  ("11 /12", red at 3 or fewer) beside 12 pips that go dim as they're used.
  (Playtesters didn't read the earlier pips-only version, white dots turning
  into red rings.)
- Every placement and miss is recorded in order (`moves`: island / snap / miss)
  for the shareable result.
- **A miss must read as costing the multiplier** (playtesters missed it when
  the number just changed quietly). On a miss: "MISS" rises in red from the
  cell, plus "−0.1×" when the multiplier actually dropped (`dropPiece` returns
  `miss.multLostTenths`, 0 at 1.0×). The misses box border flashes red; if the
  multiplier dropped, the score box also flashes red, shakes, turns the value red and
  shows "−0.1" beside it. Red holds 0.3 s, then fades over 0.7 s.

**Pulse (the assist reward)**
- Fires on **any correct island placement** (not gated on speed; islands are
  hard to place fast, so gating on speed made it never fire).
- Reveals a ghost (faint image + cut) of the empty cells within Chebyshev
  radius **1** of the placed island, for **6000 ms** (the POC used ~4200). Helps set up the next
  placements.
- Ghosts **fade out over their lifetime** so players can see when they will
  go: slowly at first (still readable for most of it), fastest at the end
  (ease-in), reaching zero as the engine removes them.

**Rules the POC implements that weren't written down**
- **Stall decay timing.** Both the fast window and the stall clock run from
  the last correct placement (`lastPlacedAt`); holds and misses restart
  neither. (The POC, with one current piece, restarted the fast window on a
  hold or a misplace too; the hand made that meaningless.) Decay steps due =
  `floor((idle − STALL_MS) / DECAY_TICK)`, so the first −0.1 lands at 6 s idle
  (the POC used 5 s; raised to 10 s after play felt rushed, then settled on 6 s). The engine computes this from timestamps (`tick(state, now)`),
  so it doesn't depend on how often the UI ticks.
- **The fast bonus is applied before scoring,** so the placement that earns
  +0.1 is paid at the raised multiplier.
- **The POC labels the current piece before you place it** ("island" or
  "snaps", plus corner/edge/interior). **This app doesn't label hand
  pieces**: the label was removed after playtesting. "Snaps" told you the
  piece belongs next to the placed cluster, a pre-placement correctness hint.
  Don't reintroduce it.

**Fixes: where the POC is wrong and this spec wins**
- **End of deck.** The puzzle is won when **all N pieces are placed**, not
  when the deck is empty, and a held piece stays playable from the hold slot.
  (The POC ends "solved" at 23/24 whenever hold was used, and locks up if you
  hold the very last piece into an empty slot.)
- **Multiplier in whole tenths.** Store it as an integer 10–15 and score as
  `round(base × tenths / 10)` in integer maths. (The POC's float drifts: 1.3×
  reached going up pays a snap 33, reached going down pays 32.)

Tuning knobs live in `src/engine/constants.ts` (multiplier values stored as
tenths); treat them as a starting point, not gospel.

## Daily puzzle rules

- **Puzzle number** = days since `LAUNCH_DATE` + 1, counted on the player's
  **local calendar date** (the puzzle changes at local midnight, like Wordle).
  Computed from date parts via `Date.UTC(y, m, d)` so daylight-saving changes
  can't shift it. Never below 1.
- **Everything comes from the puzzle number:** a seeded generator
  (`mulberry32(seedFor(n))`) produces the cuts and then the deal order, so every
  player gets the identical puzzle. Never use `Math.random` for anything that
  must match between players.
- **Images** are bundled in `assets/puzzles/`, all 3:2, used in order
  (`imageIndexFor`) and then repeated. Each one must be the owner's own photo,
  public domain, or licensed for this use, recorded in
  `assets/puzzles/CREDITS.md`.
- **Strip metadata before adding a photo.** Camera and phone photos carry EXIF,
  often including GPS coordinates of where they were taken. The repo and site
  are public, so only cropped, resized, metadata-free copies go in
  `assets/puzzles/`, never originals.
- Future images and cuts are visible in the shipped bundle, so a determined
  player can peek ahead. Accepted for v1.
- **Only append images.** Day N shows image `(N − 1) mod count`, so never
  reorder, remove or renumber `assets/puzzles/NNNN.jpg`, or days already played
  would show a different photo. Appending only changes days that would
  otherwise have wrapped around to image 1, so keep the list ahead of today.
- **Adding your own photos:** see the `add-photos` skill for the workflow.
- **Switching puzzles (testing aid):** ‹ › beside the title step through
  puzzles 1 to `max(today, image count)`, so every past day and every bundled
  photo is reachable; the choice is kept in the URL as `?puzzle=N` (which
  also works as a link, in dev and in the live build). Checkpoint 4's
  one-play-per-day loop has to decide whether players keep this (e.g. as an
  archive of past days) or it goes back to dev-only.

## Product direction

- **Now:** the daily web puzzle. One play per day, a result screen, a shareable
  text result, and stats/streak kept in the browser (localStorage).
- **Later:** Android build from the same code; an own-photo mode (photos cut
  on-device, never uploaded); a Zen mode (no timer, no score) alongside the
  scored mode; monetization (none on web for now, since Wordle was free; a
  one-time purchase in the app is the likely shape).
- **Genre flaws to keep fixing** (the differentiators): no intrusive ads, no
  subscriptions, reliable save & resume, no cramped-pieces-on-phone problem
  (the small hand, instead of a tray of every piece, sidesteps it).

## Tech & architecture

- **Stack:** Expo SDK 57 (React Native 0.86 + react-native-web), TypeScript,
  one codebase for web now and native later.
- **`src/engine/`: plain TypeScript, no React or React Native imports.** Rules,
  scoring, seeding, geometry. It must run unchanged on every platform and in
  Jest. Keep game logic here, not in components.
- **`src/ui/`: React Native components.** Pieces are drawn with
  **react-native-svg** (`<ClipPath>` + `<Image>`), not Skia: Skia's web build
  ships a multi-MB download, which is bad for a link tapped from a group chat.
  SVG ids share one namespace per web page, so clip ids come from `useId()`.
- **Web output:** single-page static site (`expo export --platform web` →
  `dist/`), no Expo Router, no server.
- **Hosting (testing):** GitHub Pages serves the site under `/puzzle-game/`, so
  `app.json` sets `experiments.baseUrl: "/puzzle-game"` (the dev server still
  serves at `/`). `npm run deploy` exports and pushes `dist/` to the `gh-pages`
  branch with `--nojekyll` (Jekyll would drop the `_expo/` folder). Moving to a
  custom domain or a host that serves from the root means removing `baseUrl`.
- **Privacy is a hard constraint.** No backend, accounts, analytics, ad SDKs, or
  any dependency that phones home, so flag it rather than adding it. Fonts must be
  bundled with the site (the POC loads Google Fonts from Google's servers; don't
  copy that).
- **Expo changes every SDK release.** Before using an Expo/RN API, check the
  versioned docs (https://docs.expo.dev/versions/v57.0.0/) rather than memory.
  Add packages with `npx expo install <pkg>` so versions match the SDK.

Game rules live in `src/engine/game.ts` as pure functions (`newGame`,
`holdPiece`, `dropPiece`, `tick`) that take a timestamp and return new state;
components only render state and forward input. The UI's clock is
`performance.now()`. The React Compiler lint rules are on: don't read or write
refs during render.

Run typecheck, lint and tests before calling a task done.

## Conventions & collaboration

- **Checkpoint-based build sequencing.** Work in discrete, completable phases
  with a clear deliverable each:
  1. ✅ Scaffold, engine (cuts/geometry/daily seed), draw today's pieces.
  2. ✅ One-at-a-time feed + hold + drag-to-place with correct/wrong/return,
     including the end-of-deck fix.
  3. ✅ Scoring + flow multiplier + pulse + 12-miss limit.
  4. Daily loop: one play per day, result screen, share text, stats/streak.
  5. Publish the static web build. (Test build already on GitHub Pages; the
     public launch, and its domain, is still to decide.)
  6. Later: Android build, own-photo mode, Zen mode, monetization.
- **Adversarial evaluation.** Pressure-test ideas; push back on hand-wavy
  reasoning rather than validating by default. Update positions with precision.
- **Plain, descriptive naming** for the app and for code: functional over
  evocative/coined.
- **Consolidated specs.** Keep design/strategy decisions in markdown docs in
  `docs/` (or here), not scattered comments.

## Open questions

- **Is 12 misses the right number?** Started at 6, then 10; playtesting found
  both too punishing, so it is now 12 (see Misses). Still to tune, and likely
  down again now that the hand and the photo preview make play easier. The
  first piece is always an island: by cut shape alone a corner has 1 possible
  cell, a top/bottom edge 4, a left/right edge 2, and an interior piece 8
  (the preview, and picking a corner from the hand, now soften this).
- **Pulse diagonals.** The radius-1 pulse includes diagonal cells, and a piece
  placed diagonally from an island is still an island (100 points + another
  pulse), with no guessing. Keep it as a chaining feature, or reveal only the
  4 side cells? Seen in testing: fast island play overlaps pulses and can ghost
  most of the empty board at once.
- **Photo preview length.** Now a 10 s flash (raised from 5 s) before play (see Board &
  pieces). Is 10 s right, and does it make islands too easy?
- **Is the fast window too easy to keep with a hand?** "Fast" is now 3 s
  since the previous placement, and with 3 pieces to choose from the next
  snap is usually obvious, so a steady player may sit at 1.5× most of the
  game. Watch in playtesting; the knob is `FAST_MS`.
- **Daily image supply.** Starting with the owner's own landscape photos
  (plenty to begin with). Later sources: CC0 museum collections (The Met, Art
  Institute of Chicago, Rijksmuseum, Cleveland Museum of Art, Smithsonian) and
  public-domain government photography (NPS, NASA; check each image's rights).
  Avoid CC BY-SA, AI-generated images, identifiable people, logos or text, and
  large blank areas (sky, snow, water cells become pure guesses). Add images in
  batches (60–90 at a time); the date picks the day's image, so there's no need
  to deploy daily.
- **Monetization.** Not needed yet; noted so the reasoning isn't lost.
  - *Sponsored daily image (brands):* only worth selling at tens of thousands of
    daily players. Suits sponsors whose photos we'd pick anyway: tourism
    boards, parks, museums, outdoor/travel brands, photographers. Rules if we do
    it: the same quality bar as curated images (3:2, detail across the board,
    no logos or text in the image), our right to refuse, and the brand named
    only in the credit and result screen, labelled "Sponsored". It bends the
    "no ads" principle, so it has to be a conscious decision. Brands will want
    proof of reach; the privacy-friendly answer is counting requests for each
    day's image at the host (no cookies, no per-person tracking), which needs a
    host with request stats (e.g. Cloudflare Pages), not GitHub Pages.
  - *Paid personal daily slot (people):* rejected. A stranger's personal photo
    makes the shared puzzle worse for everyone else and raises consent issues
    (faces, children). What people really want is a private puzzle to send
    someone, which needs server storage and breaks "photos never leave the
    device", so it would be a separate product decision.
  - *Better fits sooner:* a tip jar, a paid archive of past puzzles, and the
    app's planned one-time unlock.
  - *Cheap prep now:* store each image with a title, credit and optional link
    rather than just a file (a sponsor later is just a different credit), and
    measure daily players privately when moving off GitHub Pages.
- **Final app name.**
