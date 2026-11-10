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
placed, fail on the 12th miss). A quick onboarding popup shows once per browser;
the full rules are a sheet behind the "How to play" button (bottom of the hand
column). There is no header and no mid-game Restart (the quieter design, see
docs/ux-research-complexity.md).

Today's puzzle is **one play**: it saves after every change (`SavedGame` in
`GameScreen`), so a reload resumes it (the speed clocks keep running while the
page is away, as if it had stayed open) and a finished one reopens on its result
(`ResultSheet`: score breakdown, stats, share, countdown to local midnight). The
preview also can't be restarted by reloading. Stats live in localStorage
(`src/engine/result.ts`); the streak counts days played, not days solved, because
a day's difficulty depends on its photo. Any other `?puzzle=N` is free practice:
replayable, unsaved and uncounted.

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
  countdown; `PhotoPreview`), then hidden for the rest of the game. It starts
  only when the player taps **Start puzzle** (a card on the board), so opening
  the page or switching puzzles while looking away doesn't burn it. On a first
  visit the onboarding popup's "Start playing" is that tap; Restart and "Try
  again" skip the card and go straight to the photo. No
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
  - Range **1.0×–2.0×** (was 1.5×; raised so fast play keeps paying past
    the fifth placement). Starts at 1.0.
  - **One score card holds everything about the score** (`ScoreCard`).
    Colour rule: **lemon is what a piece is worth, magenta is what speed
    adds.** Top row: the puzzle number, then "misses left" over 12 white
    segments and "speed ×1.6" over 10 magenta segments (one per ×0.1).
    Bottom row: the total, "=", then the move strip, one bar per move (lemon
    base, magenta cap for the speed bonus, red × for a miss), the newest
    outlined and followed by its sum ("[25] [×1.6] +40"). Every part of that
    row has a small caption under it, so it reads like a receipt: score ·
    your moves · lone/joined · speed · added. On desktop each meter is one
    line (label, segments, number); on phones the label and number sit above. The move list
    is kept by the screen as moves happen (`MoveRecord`).
  - Each placement plays out Balatro-style (~1 s, never blocking the next
    drop; a new move cuts the last one short): the board shakes (more for
    bigger points), "+25" flies from the piece into the card, the worth chip
    steps forward with a wobble, the × chip slams in beside it, the result
    rolls from 25 up to 40, and the total counts up and bumps. A newly lit
    speed segment flashes; at ×2.0 the speed meter glows. Timings are the
    constants at the top of `ScoreCard.tsx`. With the system's reduce-motion
    setting, all of it is off and the numbers just update. The history row has a fixed height and shows only the bars
    that fit (oldest fade off the left), so the board never moves mid-game.
  - **Lemon only ever means what a piece is worth.** Selection borders,
    primary buttons, hints and the rising "+40" are white.
  - **The time until the multiplier drops** is the newest speed segment
    draining, from the last placement to the first decay step
    (`decayStartsAt`); it resets on each placement and doesn't run at 1.0×
    (nothing left to lose). Holds and misses don't refill it. The 3 s fast
    window is deliberately *not* shown: a countdown running at 1.0× read to
    playtesters as the multiplier running out.
  - A "fast" placement (within **3000 ms** of the **previous placement**, or of
    the start of play for the first) adds **+0.1**. It means keeping up the
    pace; with a hand there is no single moment a piece is "presented".
  - After a **5000 ms** stall (no placement), the multiplier ticks **−0.1 per
    1000 ms** back toward 1.0.
  - A misplace costs **−0.1** (and one miss, below).
- **Points per placement = round(base × multiplier).**
- **Unused misses pay 50 each on the win** (`UNUSED_MISS_POINTS`; stored as
  `missBonus` and included in `score`; the end card shows "Includes +550 for
  11 unused misses"). None on a fail, which has none left anyway.
- Design intent was "island vs. snap is the star; flow is seasoning". A score
  simulation (500 deals, hand of 3, scripted players) found that in practice
  the hand limits island play (island-seeking places ~7.0 islands a game,
  snap-seeking ~3.9), so the multiplier was already the bigger lever, and a
  fast guesser with 10 misses scored within 3% of a careful player. Hence
  the ×2.0 cap and the unused-miss bonus. Uncapping was rejected: it turned
  the score into a speed test (a fast all-snap player beat a slow island
  player by 46%). Still open: raising islands to 150 would restore them as
  the main lever.

**Misses (Wordle-style limit)**
- Each puzzle allows **12 wrong drops** (`MISS_LIMIT`). The 12th locks the score
  ("Out of misses", status `failed`), keeping the score and pieces placed so
  far. Off-board / filled-cell drops don't count.
- **The player can still finish the picture** (`finishPicture`, status
  `finishing`): the end card offers it, pieces keep placing, wrong drops just
  bounce, and score, misses and moves stay locked. Stopping dead with the photo
  half done was the harshest moment in testing.
- **Spots already tried with a piece show an ×** while that piece is held
  (kept by the screen). This repeats only what the player has already paid to
  learn, so it isn't a correctness hint. Simulation (2,000 games, a perfect
  shape-reader who remembers every try): with no help from the photo, 10.2
  misses on average and 35% of games hit 12; if the photo rules out half the
  spots, 4.1 and 0%. So 12 suits photos with clear regions; repetitive photos
  are the problem, not the limit.
- Why: the multiplier can't go below 1.0×, so on its own a misplace cost
  nothing at the floor and islands could be brute-forced cell by cell. A shared
  daily score needs wrong guesses to cost something.
- Misses left is a meter in the score card: **"misses left 11"** over 12
  segments that go dark as they're used (count and segments red at 3 or
  fewer). Visible from the start, so the risk is felt before the first guess.
  (Playtesters didn't read an earlier pips-only version, so keep the number.)
- Every placement and miss is recorded in order. The shared result
  (`shareText` in `src/engine/result.ts`) is **plain words** anyone can read
  without having played, one fact per line with its own emoji: "✅ Solved /
  ❌ 3 misses / ⭐ 2,349 points / ⚡ Top speed ×2.0".
  Coloured-square grids and charts were tried and rejected: they needed a legend,
  and Wordle's only reads because everyone already knows it.
- **A miss must read as costing the multiplier** (playtesters missed it when
  the number just changed quietly). On a miss: "MISS" rises in red from the
  cell, plus "−0.1×" when the multiplier actually dropped (`dropPiece` returns
  `miss.multLostTenths`, 0 at 1.0×). The score card's border flashes red, and
  shakes if the multiplier dropped; the move strip gets a red × and the last
  summary reads "Miss −0.1×". Red holds 0.3 s, then fades over 0.7 s.

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
- **Multiplier in whole tenths.** Store it as an integer 10–20 and score as
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
- **Switching puzzles:** `?puzzle=N` in the URL opens any past day as free
  practice, up to today. Future days are dev-only (`max(today, image count)`, to
  check every bundled photo): on the live build they would let players rehearse
  a puzzle before it counts. The on-screen ‹ › switcher was removed in the
  quieter design.
- **Replays can't be fully blocked.** Clearing site data, a private window,
  another device or a changed date all give a fresh play, as with Wordle.
  Accepted: stopping it needs accounts and a server, and a score worked out in
  the browser could still be faked.

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
- **Visual design:** the source is the Figma file "Daily Jigsaw – Game UI"
  (indigo surfaces, one lemon accent for selection, points, the multiplier and
  primary buttons; red only for misses). Colours live in `src/ui/colors.ts` and
  text roles in `src/ui/type.ts`, both named to match the Figma variables and
  text styles. Fonts: Varela Round (body, labels, buttons) and Shantell Sans
  (titles, numbers, rising points), bundled in `assets/fonts/` under the OFL
  (see its README for the Shantell subset). Each weight is its own
  `fontFamily`; never set `fontWeight` on them. On web the page behind the app
  is one soft blob pulsing over the indigo, in the main colour of the day's photo: a small WebGL
  shader at low resolution (`src/ui/backdrop.ts`, 30 fps, still with reduce-motion,
  plain indigo without WebGL; colours in `PUZZLE_GLOWS`, generated with the photo
  list). Colours only, never the photo's layout, so it can't hint at placement.
  Fine still scanlines over it (`public/index.html`) quieten the colour; their width
  is snapped to whole screen pixels, or fractional-density phones band.
  The board and panels stay solid. Tried and rejected: three drifting pools of the photo's colours, also over a tint of the photo (the colours didn't appeal), small grid and checkerboard overlays, a jigsaw-line pattern (read
  as a second board), faint drifting CSS glows (movement too hard to notice), a swirling paint shader at
  full strength (too bold to play over) and turned down (still too swirly).
  The pre-redesign look is kept
  on the Figma page "Original (live game, fbc1043)".
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
- **Installable (PWA):** `public/` holds the page template, manifest and icons
  (`scripts/make-icons.mjs` draws them); paths in those files are relative so the
  base path can change. `npm run export:web` also writes `dist/sw.js`
  (`scripts/build-service-worker.mjs`, logic in `scripts/service-worker.js`). The
  page comes from the network when it can (3 s, then the saved copy), so a deploy
  reaches players on their next open; hashed files come from the cache. Up front
  it saves only the app itself; `src/pwa.ts` asks for today's photo and the next
  3, so opening a link doesn't download the whole photo library. Dev builds don't
  register it. An installed app is resumed rather than reopened, so the daily
  reloads when it comes back on a new day.
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
  4. ✅ Daily loop: one play per day, result screen, share text, stats/streak.
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
  snap is usually obvious, so a steady player may sit at the cap (now 2.0×) most of the
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
