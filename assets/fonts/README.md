# Fonts

Bundled with the site (never loaded from a font CDN), both under the SIL Open Font License 1.1
(see the `OFL-*.txt` files next to them).

| File | Font | Notes |
| --- | --- | --- |
| `VarelaRound_400Regular.ttf` | Varela Round, the only weight | Unmodified. Its licence reserves the name "Varela Round", so don't subset or edit it without renaming. |
| `ShantellSans_700Bold.ttf`, `ShantellSans_800ExtraBold.ttf` | Shantell Sans | Subset (no reserved font name) |

The Shantell files come from `@expo-google-fonts/shantell-sans`, subset with fontTools to ASCII
plus the symbols the UI uses, keeping only kerning (dropping the alternate letter shapes cuts
each weight from ~400 KB to ~35 KB):

```sh
python -m fontTools.subset ShantellSans_700Bold.ttf \
  --unicodes="U+0020-007E,U+00A0,U+00B7,U+00D7,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2022,U+2026,U+2190-2193,U+2212" \
  --layout-features=kern --output-file=ShantellSans_700Bold.ttf
```

Add a character to the list (and re-run for both weights) before using it in display text;
anything outside it falls back to the system font.
