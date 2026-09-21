# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A **daily shared jigsaw puzzle for the web**, in the spirit of Wordle: one image
and one cut per day, the same for every player, with a shareable result. Built
with Expo so an Android (and iOS) app can later be built from the same code.
Working title only; a plain, descriptive final name is still open (the POC used
"Blind Cut" / "PulsePuzzle", and neither is final).

The core idea: pieces are fed **one at a time** (Tetris-style, with a hold slot
and a short preview queue) rather than dumped in a tray. You drag each piece
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
One-at-a-time feed, hold, next-3 preview, drag-to-place (mouse and touch),
island/snap scoring, score multiplier with fast bonus, stall decay and a
countdown to the next drop, pulse ghosts, and a 12-miss limit (win on all 24
placed, fail on the 12th miss).
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
- **No reference photo is shown.** The player reads the fragment + cut to place.
- The empty grid is **hidden**: the board is a bare assembly area. The only
  time a cell is indicated is a neutral gray outline under the piece being
  dragged (see below).

**Feed & controls**
- One "current" piece at a time, drawn from a shuffled deck.
- A **hold** slot: stash the current piece for later (once per piece). This is
  the player's main tool for turning a risky island into a safe snap: hold it
  until its neighbours are down. Holding into an empty slot deals the next
  piece; holding with a piece already held swaps them. Holding the **last**
  deck piece into an empty slot is refused (nothing would be left to play).
  Space holds on web; hold is ignored mid-drag.
- A short **preview queue** (POC shows next 3).

**Placement (drag-and-drop)**
- Drag the current piece onto the board (pointer/touch).
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

**Scoring: two axes, multiplied**
- *Difficulty axis (the headline):*
  - **Island** = placed with no already-placed orthogonal neighbour. Hard, a
    real read/gamble. Base **100**.
  - **Snap** = touches at least one placed piece. Easier, deducible. Base **25**.
- *Tempo axis (the flow multiplier, shown to players as "Score multiplier"):*
  - Range **1.0×–1.5×**. Starts at 1.0.
  - The multiplier box shows the level (gold meter) and **the time until the
    multiplier drops**, both as seconds beside the meter ("3.2s", tenths,
    rounded up; "0.0s" in red while it is dropping) and as a line along the
    box's bottom edge. Both run from the last placement to the first decay
    step (`decayStartsAt`), reset on each placement, and are hidden at 1.0×
    (nothing left to lose). Holds and
    misses don't refill it. The 3.5 s fast window is deliberately *not* shown:
    a countdown running at 1.0× read to playtesters as the multiplier running
    out.
  - A "fast" placement (within **3500 ms** of the piece appearing) adds **+0.1**.
  - After a **4000 ms** stall (no placement), the multiplier ticks **−0.1 per
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
- Every placement and miss is recorded in order (`moves`: island / snap / miss)
  for the shareable result.
- **A miss must read as costing the multiplier** (playtesters missed it when
  the number just changed quietly). On a miss: "MISS" rises in red from the
  cell, plus "−0.1×" when the multiplier actually dropped (`dropPiece` returns
  `miss.multLostTenths`, 0 at 1.0×). The misses box border flashes red; if the
  multiplier dropped, its box also flashes red, shakes, turns the value red and
  shows "−0.1" beside it. Red holds 0.3 s, then fades over 0.7 s.

**Pulse (the assist reward)**
- Fires on **any correct island placement** (not gated on speed; islands are
  hard to place fast, so gating on speed made it never fire).
- Reveals a ghost (faint image + cut) of the empty cells within Chebyshev
  radius **1** of the placed island, for **~4200 ms**. Helps set up the next
  placements.

**Rules the POC implements that weren't written down**
- **Two separate clocks.** The *fast window* restarts when a new piece becomes
  current: after a correct placement, a hold, **or a misplace**. The *stall
  clock* restarts only after a correct placement. Decay steps due =
  `floor((idle − STALL_MS) / DECAY_TICK)`, so the first −0.1 lands at 5 s idle
  (as in the POC). The engine computes this from timestamps (`tick(state, now)`),
  so it doesn't depend on how often the UI ticks.
- **The fast bonus is applied before scoring,** so the placement that earns
  +0.1 is paid at the raised multiplier.
- **The POC labels the current piece before you place it** ("island" or
  "snaps", plus corner/edge/interior). **This app doesn't**: the label was
  removed after playtesting. "Snaps" told you the piece belongs next to the
  placed cluster, a pre-placement correctness hint. Don't reintroduce it.

**Fixes: where the POC is wrong and this spec wins**
- **End of deck.** When the deck runs out, the held piece becomes current.
  The puzzle is won when **all N pieces are placed**, not when the deck is
  empty. (The POC ends "solved" at 23/24 whenever hold was used, and locks up
  if you hold the very last piece into an empty slot.)
- **Multiplier in whole tenths.** Store it as an integer 10–15 and score as
  `round(base × tenths / 10)` in integer maths. (The POC's float drifts: 1.3×
  reached going up pays a snap 33, reached going down pays 32.)

### Tuned constants (current POC values, the starting point for balancing)
In code: `src/engine/constants.ts` (multiplier values stored as tenths).

| Constant | Value | Meaning |
|---|---|---|
| grid | 6×4 | pieces per board |
| ISLAND | 100 | base points, no placed neighbour |
| SNAP | 25 | base points, touches a placed piece |
| FAST_MS | 3500 | window for a "fast" placement (+0.1 mult) |
| MULT_MIN / MULT_MAX | 1.0 / 1.5 | flow multiplier bounds |
| MULT_STEP | 0.1 | mult gained per fast placement |
| STALL_MS | 4000 | idle grace before the multiplier decays |
| DECAY_TICK | 1000 | ms between −0.1 decay steps |
| WRONG_PENALTY | 0.1 | mult lost on a misplace |
| PULSE_RADIUS | 1 | Chebyshev radius the pulse reveals |
| PULSE_MS | 4200 | how long the pulse ghost stays |
| MISS_LIMIT | 12 | wrong drops per puzzle; the 12th ends the game |

Treat these as balancing knobs, not gospel. They're where tuning happens.

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
  (`imageIndexFor`) and then repeated. Each one must be public domain or
  licensed for this use, recorded in `assets/puzzles/CREDITS.md`.
- Future images and cuts are visible in the shipped bundle, so a determined
  player can peek ahead. Accepted for v1.
- Dev only: `?puzzle=N` in the web URL loads a specific puzzle.

## Product direction

- **Now:** the daily web puzzle. One play per day, a result screen, a shareable
  text result, and stats/streak kept in the browser (localStorage).
- **Later:** Android build from the same code; an own-photo mode (photos cut
  on-device, never uploaded); a Zen mode (no timer, no score) alongside the
  scored mode; monetization (none on web for now, since Wordle was free; a
  one-time purchase in the app is the likely shape).
- **Genre flaws to keep fixing** (the differentiators): no intrusive ads, no
  subscriptions, reliable save & resume, no cramped-pieces-on-phone problem
  (the one-at-a-time feed sidesteps it).

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

### Layout
```
App.tsx                  picks today's puzzle, renders GameScreen
src/engine/              constants, rng, cuts, geometry, daily, game (+ __tests__/)
src/ui/GameScreen.tsx    game state + 100 ms clock tick, layout (wide: side panel; narrow: feed below), end card;
                         everything sits in a ScrollView so the rules can follow the game
src/ui/usePieceDrag.ts   drag via RN responder props (no PanResponder, no gesture libs)
src/ui/Board.tsx         placed pieces, pulse ghosts, hover outline, wrong-cell flash, rising "+points" text
src/ui/FeedPanel.tsx     current / hold / next
src/ui/ScoreBar.tsx      score, score multiplier (level meter + countdown to its next drop), misses left;
                         one row when wide, two rows on phones
src/ui/HowToPlay.tsx     rules for testers, below the game; numbers come from engine constants
src/ui/PieceSvg.tsx      one piece: image clipped to its cut
src/puzzleImages.ts      the daily image list
assets/puzzles/          daily images + CREDITS.md
docs/poc/                the HTML prototype
```
Game rules live in `src/engine/game.ts` as pure functions (`newGame`,
`holdPiece`, `dropPiece`, `tick`) that take a timestamp and return new state;
components only render state and forward input. The UI's clock is
`performance.now()`. The React Compiler lint rules are on: don't read or write
refs during render.

### Commands
```
npm run web              # dev server, opens the web build
npm test                 # Jest (engine tests)
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
npm run export:web       # static site → dist/  (paths are under /puzzle-game/)
npm run deploy           # export + publish to GitHub Pages (gh-pages branch)
npx expo-doctor          # dependency/config health check
```
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
  both too punishing, so it is now 12 (see Misses). Still to tune. The first
  piece is always a blind island: by
  cut shape alone a corner has 1 possible cell, a top/bottom edge 4, a
  left/right edge 2, and an interior piece 8, so an unlucky first deal can cost
  a few misses before play really starts (holding for a corner helps).
- **Pulse diagonals.** The radius-1 pulse includes diagonal cells, and a piece
  placed diagonally from an island is still an island (100 points + another
  pulse), with no guessing. Keep it as a chaining feature, or reveal only the
  4 side cells? Seen in testing: fast island play overlaps pulses and can ghost
  most of the empty board at once.
- **Unknown image.** Daily players haven't seen the picture, unlike their own
  photos. Show it briefly at the start, or show nothing?
- **Daily image supply** and licensing at scale.
- **Final app name.**
