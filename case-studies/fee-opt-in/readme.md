# Fee Opt-In case study, image slots

These are labeled **placeholders**. The case study at
`content/work/fee-opt-in-experimentation.mdx` already references them, so the
layout looks complete right now. To use your real Raisely screenshots:

1. Export each screenshot and name it to match the slot (keep the number prefix).
2. Drop it in this folder, **overwriting the `.svg` placeholder**.
3. If you save as `.png` (recommended for screenshots), update that slot's
   extension in the MDX, find `fee-opt-in/<name>.svg` and change `.svg` → `.png`.
   (Saving your export as `.svg` with the same name needs no MDX edit.)

| Slot file                     | What goes here                                              |
| ----------------------------- | ---------------------------------------------------------- |
| `01-before-fallback`          | Legacy/before fallback UI (the fragmented, lowest-nudging one) |
| `02-variants`                 | The 3 tested variants: Slider · Toggle · Segmented Dropdown |
| `03-magicpatterns-prototype`  | MagicPatterns / Cursor interactive control-panel prototype |
| `04-future-state`             | Future-state unified contribution concept                  |
| `05-results`                  | Results visual (75% → 92% chart, or winning Slider final)   |
| `06-mobile-next`              | Mobile optimization / what's-next exploration              |

**Recommended export size:** ~1600px wide, 16:9. PNG or WebP. Optimize before
committing (large PNGs bloat the repo and slow the Vercel build).
