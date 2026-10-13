# Fee Opt-In case study figures

These images are rendered, not drawn. Each one is a 1600x900 frame built from
the same white-labelled checkout the case study's live demo uses
(`components/fee/Checkout.tsx`), composed in `components/fee/Figures.tsx`.

To change a figure:

1. Run the dev server and open `/figures/fee` (it 404s in production, and the
   GitHub Pages mirror build drops it).
2. Edit `components/fee/Figures.tsx` or the checkout.
3. Capture each `#fig-0N` section at 2x, save it here as a 2400x1350 JPG with
   the same name, and rebuild the cover with
   `python3 scripts/make-cover.py public/case-studies/fee-opt-in/02-variants.jpg "#e8e0cf" public/case-studies/fee-opt-in/cover.jpg`.

Only reported numbers appear: 75%, 82%, 92%, the 90% benchmark, and 12 to 20%
of donors clicking Edit. The buttons and dropdown variants have no published
rate, so none is shown.
