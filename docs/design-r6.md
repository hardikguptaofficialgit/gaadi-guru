# Patchwise r6 redesign — what makes good products feel non-generic

Studied: Linear, Vercel, Stripe, Raycast, Arc, Cal.com, and civic/map tools (FixMyStreet, SeeClickFix, NYC311, Citymapper).

| Product | Concrete move | Applied to Patchwise |
|---|---|---|
| Linear | Product UI *is* the hero; dense, quiet chrome; mono IDs (ENG-123); tight display tracking (-0.03em+) | Hero shows a real report ticket (`PW-d580…`) + real SAM overlay; mono ticket ids everywhere |
| Vercel | Strict hairline grid, numbers in mono, black/white + one accent, almost no rounded "cards" | 1px rules instead of floating cards; tokens: 1 accent (#2F69E9), yellow only for "needs attention" |
| Stripe | Editorial type scale, asymmetric 7/5 columns, copy states specifics ("in 135+ currencies") | Asymmetric hero; copy names wards, rupees, cities and the MoRTH number, not adjectives |
| Raycast | Keyboard-tool feel: list rows with right-aligned meta, small caps labels | Map side list + report metadata as label/value rows |
| Arc / Cal.com | Serif accent word in a sans headline; restrained motion (one reveal, not everything) | Instrument Serif italic accent, single line-mask reveal, hover = 1px border shift, no bounce |
| FixMyStreet / 311 | Report = public document with a reference number, status trail and who it went to | Report page laid out as a ticket: header strip (ref, status, filed, due, coords), letter, routing |

AI-slop tells removed: centred hero + 3 icon feature cards (Strip deleted), icon-in-rounded-square tiles (privacy list, ico-tile → plain rules),
uniform puffy cards (cards → flat hairline panels, 6–8px radius), pill overload (severity as text+dot), buzzword copy.

Type: Instrument Sans (UI/display, -0.035em on h1), Instrument Serif italic (one accent per headline), JetBrains Mono (ids, coords, money).
Scale: 12 / 13 / 15 / 18 / 24 / 32 / 48 / clamp(44–88) display. Spacing 4/8/12/16/24/40/64/112 — deliberately not the Tailwind 4-step.
