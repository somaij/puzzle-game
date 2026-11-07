# Reducing perceived complexity: research and recommendations

November 2026. Written after the indigo/lemon redesign shipped (421a5e2), as
input for the next design pass. The goal: the game should *feel* as simple as
a jigsaw, while the scoring stays as deep as it is now.

## What the reference games do

### Balatro: a deep score that reads as one simple action

- **A familiar frame carries the onboarding.** LocalThunk says the poker
  theme was added "mainly as an onboarding tool"; the game has almost nothing
  else in common with poker. Players arrive already knowing what a flush is,
  so the novel parts can be layered on.
  ([Rogueliker interview](https://rogueliker.com/balatro-interview/))
- **Signposting through play, not a tutorial.** Early Jokers are chosen to
  teach one idea each (Four Fingers teaches the game's hook; Amber Acorn
  teaches card order). He calls it an "extended low-calorie tutorial."
  ([Game Developer, GDC 2024](https://gamedeveloper.com/design/balatro-creator-unveils-a-few-slick-signposting-strategies))
- **The scoring explains itself as it happens.** After a hand is played, each
  card and Joker steps forward in turn and the total ticks up with rising
  sound. Players learn the formula by watching it, not by reading it.
  ([GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem),
  [Blake Crosley](https://blakecrosley.com/guides/design/balatro))
- **Colour is the label.** The two scoring axes have two colours (blue chips,
  red mult). No words are needed to tell them apart.
  ([Blake Crosley](https://blakecrosley.com/guides/design/balatro))
- **Things are left out on purpose.** There is no score preview before you
  play: "you set up your Rube Goldberg machine and watch it go." The game
  shows only what you need to act, and lets the result surprise you.
  ([GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem))
- **All the information you need is on the main play screen,** and nothing
  else is. ([TechRadar](https://techrdr.pages.dev/posts/balatro-review-jokers-to-the-right))

### Wordle: restraint as the product

- Wardle resisted filling white space and adding features; what is on screen
  is the grid, the keyboard and nothing else.
  ([UX Collective](https://uxdesign.cc/wordle-is-a-masterclass-in-product-design-simplicity-52de1ba06d85))
- The limit (six guesses) *is* the board: you see your remaining guesses as
  empty rows, so it needs no counter and no explanation.
- One puzzle a day, short and dependable.
  ([GamesRadar](https://gamesradar.com/wordle-creator-wants-the-viral-guessing-game-to-stay-simple-and-ad-free))

### Threes: a mechanic and some art

- Vollmer argued for simplicity when his co-designer worried it was too
  simple; the team iterated for six months mostly by taking things away.
  ([Wikipedia: Threes](https://en.wikipedia.org/wiki/Threes),
  [Game Developer](https://gamedeveloper.com/design/-i-threes-i-co-creator-wohlwend-on-the-value-of-minimalist-game-design))

### NYT Games (Connections, Strands)

- Low-intensity, clutter-free screens; no meta systems on the play surface.
  ([Pulse/critics' piece](https://www.pulse.bot/gaming/news/critics-week-the-simple-low-intensity-pleasures-of-nyt-games-16fbb217-6443-4886-9699-e9013749cda4))

### Progressive disclosure, generally

- Show the minimum rules needed to start; introduce one mechanic at a time;
  give contextual hints when a player seems stuck.
  ([Nielsen](https://jakobnielsenphd.substack.com/p/progressive-disclosure))
- Nielsen's caveat: don't bury something players need every turn behind an
  extra step.

## The common pattern

1. **Borrow a frame players already know** and spend the novelty budget on one
   twist.
2. **On screen at rest: only what you need to act.** Everything else appears
   when it becomes relevant, and goes away when it stops being relevant.
3. **Teach in the moment, through feedback,** not in a rules panel. The
   animation of a score *is* the explanation of the score.
4. **One readout per idea.** A limit you can see (Wordle's rows) beats a
   number plus a counter plus a label.
5. **Colour carries meaning,** consistently, so labels can go.

## Where this game is today

The current play screen shows, at rest, roughly **16 separate things**:
puzzle title, ‹ › switcher, placed count, "?", Restart, "Score" label, score,
multiplier, meter, countdown seconds, countdown line, "Misses left" label,
misses number, 12 pips, "Your hand" label, deck count / tap hint, 3 slots,
three control rows, and below the fold a six-card rules panel.

The jigsaw (the familiar frame) is our "poker". The twists are:
**memory** (photo hidden after 10 s), **islands vs snaps**, **the
multiplier with its decay**, and **12 misses**. Four twists, all explained up
front, all visible all the time. Balatro's lesson is that this is the wrong
order: show the jigsaw, let each twist announce itself the first time it
matters.

Three places say the same thing more than once:

- **The multiplier's timing** is shown three ways: the meter, the "3.2s"
  seconds and the draining line.
- **Misses** are shown as a label, a number and 12 pips.
- **The controls** are explained in the onboarding, under the hand, and in
  the rules.

## Recommendations

Ordered by how much perceived complexity they remove for the effort.

### 1. Let the floating text teach scoring (replaces the Points card)

When a piece lands, rise its score as a short sum, Balatro-style:
`Lone +100` then `×1.6` then `= 160`, staged over ~400 ms, or `Snap +25`.
The first time each kind happens, hold it a beat longer. After a few
placements players know islands are worth 4× without having read it.

### 2. Hide the multiplier until it exists

At ×1.0 there is nothing to show. Hide the multiplier, meter and countdown
entirely; the score box is just the score. The first fast placement makes the
multiplier pop in ("Quick! ×1.1"). It disappears again if it decays back to
×1.0. This removes four readouts for most of a slow player's game, and turns
the reveal into a reward.

### 3. One countdown, not three

Keep the draining line (or the meter's own fill draining); drop the "3.2s"
seconds. Playtesters already read a countdown as "time running out", which is
the feeling we want only while there is something to lose.

### 4. Show the risk from the start, in one readout

**Decided:** the misses limit stays visible from the first second, number and
all, because the risk is part of the game's appeal and players should feel it
before their first guess. What goes is the duplication: drop the "Misses left"
label and let the count and the 12 pips read as one thing ("12" beside the
pips, red at 3 or fewer). The pips empty as you miss, Wordle-style.

### 5. Controls teach themselves, then leave

Show the control hints only until the first piece is placed (or the first
three), then remove them. The first time a hand piece is tapped, the hint
"Tap its spot on the board" already does the job. A gentle idle nudge (the
hand pieces wiggle after 5 s of no input on the first visit) replaces the
"Drag it onto its spot" row.

### 6. Rules behind "?", not on the page

The six-card panel is good reference material, but it doesn't need to sit
under every game. Move it into the "?" sheet (with the onboarding). The play
screen then ends at the hand.

### 7. Cut the testing aids from the player's view

The ‹ › puzzle switcher and the deck count are tools for us, not players.
Hide them (or move them into the "?" sheet / a dev flag). The placed count
("11/24") can go too: the board itself shows progress.

### 8. Shorten the onboarding to the frame plus one twist

"A daily jigsaw from memory" plus *one* step: see the photo, then build it.
Islands, the multiplier and misses introduce themselves in play (1, 2 and 4
above). Wordle's rules are three example rows; ours can be one picture.

### 9. Give the multiplier its own colour: magenta

**Decided to try:** Balatro separates its two axes by colour, and we had just
merged gold into the lemon accent, so points and the multiplier looked the
same. The multiplier (the ×, its meter, and the × step in the staged sum) gets
a **magenta** of its own; lemon stays for points, selection and primary
buttons.

Watch-out: the miss red (`#ff5f6b`) is a pink-red, so the magenta has to sit
clearly on the purple side of it (around `#e65cff`, hue ~290°) or a multiplier
gain and a miss will look alike. Check it against the red side by side, and in
a colour-blindness simulator, before it ships.

## What the play screen would show at rest

Puzzle title, the How to play button, the board, three hand pieces, the
score, and the misses (count and pips). Six things, down from about sixteen. Everything else appears when it
becomes relevant.

## Risks and open questions

- **Agreed risk.** **Hiding the multiplier at ×1.0 may hide the incentive to be fast.** The
  first-placement pop needs to be clear, and the onboarding could say "be
  quick" in one line. Test with someone who hasn't played.
- **Removing the rules panel costs discoverability for curious players.**
  **Decided:** accept it, and pay for it with (a) a better onboarding, which
  now has to carry the first game on its own, and (b) a How to play button
  that is easy to find: a labelled pill ("How to play"), not a bare "?", in
  the header on every screen, and linked from the end card.
- **Agreed risk.** **Staged score animations slow down fast play.** Keep them under ~500 ms
  and never block the next drop.
- **The share result (checkpoint 4) will need its own simplicity pass:** one
  line, like Wordle's grid, not a score breakdown.

## Suggested next step

Mock a "quiet" play screen in Figma with recommendations 2–7 applied, next to
the current one, and play it on paper against the current design. Then
prototype 1 (the staged score) in code, since it is the piece that carries the
most teaching.

## Decided: a graphical score (Figma "Scoring concepts" and "Quiet /" frames)

One colour rule everywhere: **lemon is what a piece is worth** (100 lone, 25
joined), **magenta is what speed adds**.

- **A. Score box shows its sum**, in place of the current score box: the
  total on the left; on the right the last placement as chips
  (`[piece icon] 25` × `×1.6`), over 10 magenta segments (one per ×0.1). The
  newest segment drains as the stall countdown, replacing the "3.2s" seconds
  and the separate line. At the first placement it reads `100 ×1.0`, so the
  formula is visible from the start.
- **B. Each placement is scored in four beats** (~600 ms, never blocking
  the next drop): the points fly into the lemon chip; a fast placement lights
  a segment (+0.1); `= result` appears; the result counts into the total.
- **C. Move strip**: one bar per move (tall lone, short joined, magenta cap
  for the speed bonus, red × for a miss). Its **own element, separate from the
  hand**: above the hand panel in the side column on desktop, between board
  and hand on mobile.
- **D. End card breakdown**: the total split into pieces (lemon), speed
  (magenta) and unused misses (white), with the full move strip and Share.
- **Layout around the strip (decided):** the puzzle number ("Puzzle #47")
  moves inside the move-strip card, as its title. The header row is gone:
  no ‹ › switcher, no placed count, **no Restart** (fits checkpoint 4's one
  play a day; a fail can still offer "Try again" on its end card). The **How
  to play** button sits at the bottom of its column, full width. Desktop
  side column: strip card, hand, How to play. Mobile: board, hand (the
  pieces stay closest to the board), strip card, How to play.

### Revised: one score card, "now" on top, history below

Playtest of the mock: the lemon and magenta chips didn't read as "the last
placement", because the multiplier chip is *current* state while the points
chip was *history*. And the move strip belongs with the score. So the score
box and the strip merge into one **score card**:

- **Top row, now:** "Puzzle #47" (small, muted) over the total on the left;
  "speed ×1.6" in magenta over the 10 segments on the right. The segments are
  the multiplier as it is now; the newest one drains as the countdown.
- **Bottom row, history:** the move strip, one bar per move, and the newest
  bar outlined in white with its sum right after it:
  `← last [piece icon 25] [×1.6] = 40`. The word "last" and the outlined bar
  tie the chips to one move, so they can't be mistaken for the current state.
- The separate strip card is gone. Desktop side column: hand, then How to
  play. Mobile: board, hand, How to play. The rising text on the board is back
  to just the result (`+40`); the breakdown lives in the card.
- **Misses join the card (revised):** the separate misses box is gone. Misses
  are a second segmented meter in the card's top row, built like the speed
  meter: "misses left 11" over 12 white segments (a used one goes dark; at 3
  or fewer the count and segments turn red), beside "speed ×1.6" over its 10
  magenta segments. Desktop: both meters to the right of the total. Mobile:
  the total on its own row, the two meters side by side under it. Still
  visible from the first second, as decided.
- **Total sits on its moves (revised, in code):** the total moved from the top
  row to the start of the history row, read as a sum: `822 = ▮▮▮…`, then
  `← last [25] [×1.6] +40` for what the newest move added. The top row is the
  puzzle number and the two meters. Built in `src/ui/ScoreCard.tsx`.

## Second critique and fixes (built)

A re-critique of the coded quiet design against the five patterns above found
the complexity had partly moved into the score card. Fixed:

1. **No layout jump:** the history row has a fixed height and shows only the
   bars that fit between the total and the last sum (oldest fade off the
   left). Measured over a full game: the board's position never changes, on
   desktop or mobile.
2. **The staged animation is built:** worth chip, then × chip, then "+N",
   then the total counts up (~750 ms, purely visual).
3. **Speed readouts:** briefly cut to the segments alone; restored the
   "×1.6" number on the owner's call, so the two meters (misses, speed) match.
4. **Lemon means worth only:** selection, buttons, hints and the rising "+N"
   are white; rules copy keeps lemon for points (100, 25, 50) and puts times
   and counts in white.
5. **Onboarding teaches the real screen:** steps are Memorize it, Place a
   piece, Watch it add up (a miniature of the score card's bottom row); the
   rules rows use the same segment meters as the card.
6. **Tidy:** the hand hint is a tab on the panel's top edge (no reserved
   band); How to play is a lighter outlined button, which gave the desktop
   hand slots their full size back; phones are top-aligned.
- **Captions (built):** the bottom row had no words, so it only read if you
  already knew the rule. Each part now has a small muted caption under it,
  in the same voice as the meter labels: `822 score = ▮▮▮ your moves`
  `[25] joined` `[×2.0] speed` `+50 added`. "lone" / "joined" changes with
  each move, teaching the island rule in play; "speed" matches the meter
  above, tying the magenta chip to it. The row stays a fixed height.

## Contrast check (WCAG 2.2 AA)

Every text and required graphic pairing was measured (4.5:1 for normal
text, 3:1 for large text and for graphics a player must see). Fixed:

| Was failing | Ratio | Fix | Now |
| --- | --- | --- | --- |
| Magenta text (×1.6, onboarding/rules phrases) on surface | 3.67 | `multiplier` #e65cff → **#d690ff** | 4.65 |
| Red misses count (3 or fewer) on surface | 3.55 | `bad` #ff5f6b → **#ff8f96** | 4.81 |
| Board border on page | 2.32 | border `line` → `pieceOutline` | 4.34 |
| How to play outline on page | 2.32 | `pieceOutline` | 4.34 |
| Unlit meter segments on the card | 1.38 | 1px `pieceOutline` edge on every segment | 3.02 |

The magenta was also pushed slightly toward violet, so a lighter magenta and
lighter red stay apart for colour-blind players (tritanopia separation 69,
was 43 at #ef85ff). Two pairings remain under 3:1 by design and are exempt as
decoration, not information: card borders on the page (2.32; the cards
already differ by fill and hold labelled content) and the empty hand-slot
wells inside the hand panel (1.67; the pieces inside are the content).
Figma's `multiplier` and `bad` variables were updated to match.
