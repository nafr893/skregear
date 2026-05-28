# SKRE Layering System — Desktop Build (Handoff)

This package upgrades the **existing** Layering System builder so that **on desktop (≥ 750px)** it
becomes the full-viewport, no-scroll, three-column experience:

```
┌──────────────────────────────────────────────────────────────┐
│  [ YOUR SYSTEM rail ] │  [ product image ]  │ [ spec panel ]  │
│  builds as you add    │  swatch-tinted hero │ rating / price  │
│  click to jump        │  pill + Back/Next   │ swatches/sizes  │
│  subtotal · savings   │  zoom               │ performance     │
│  Review System ►      │                     │ ADD TO SYSTEM   │
└──────────────────────────────────────────────────────────────┘
```

**Below 750px the builder is 100% unchanged** — same single-column mobile flow you have today. The
desktop layout is purely additive and gated behind a media query + a `display:none` rail.

A live, working reference of the target desktop UX is in this project at
`ui_kits/layering-system/index.html` (open it to interact with the exact behavior this patch
reproduces in your theme).

---

## What changes (2 files)

| File | Change | Risk |
|---|---|---|
| `sections/skre-layering-system.liquid` | (a) paste the desktop CSS block before `{% endstylesheet %}`; (b) paste the rail markup as the first child of `.skre-lb__builder` | Additive only |
| `assets/skre-layer-builder.js` | 3 one-line hooks + 1 new `#renderRail()` method | Additive only |

No files are deleted or restructured. No mobile rules are touched.

---

## Apply it

Hand this whole folder to your VS Code Claude with a prompt like:

> Apply the SKRE layering-system desktop build in `handoff/layering-desktop/`. Follow
> `01`, `02`, `03` exactly — they're additive edits to `sections/skre-layering-system.liquid` and
> `assets/skre-layer-builder.js`. Don't change any mobile (<750px) behavior.

Or apply manually, in order:

1. **`01-desktop-styles.css`** → paste inside the section's `{% stylesheet %}`, right before
   `{% endstylesheet %}` (after the existing `@media (min-width: 600px)` block).
2. **`02-section-liquid.md`** → paste the rail `<aside>` as the first child of
   `.skre-lb__builder`.
3. **`03-builder-js.md`** → four small edits to `assets/skre-layer-builder.js` (Edits A–D).

Then commit → push → let your pipeline deploy to Shopify, and preview the
**/pages/layering-system** page on a desktop width.

---

## Verify after deploy

- **Mobile (< 750px):** identical to before — no rail, single column. ✔
- **Desktop (≥ 750px):**
  - Left rail lists all layers; empty slots show a number, filled slots show the product
    thumbnail + variant + price.
  - The active layer is highlighted with the accent bar (your "Add to System button colour").
  - Adding a layer fills its rail row and advances to the next layer; the rail subtotal /
    savings / count update.
  - Clicking a rail row jumps to that layer; the × removes it (and removes from cart).
  - **Review System** opens the existing summary panel; checkout still goes to `/cart`.
  - Everything fits one viewport — no page scroll (only the rail list and spec panel scroll
    internally if a layer has a very long spec list).

---

## Notes & options

- **Accent color** comes from the section's existing *Add to System button colour* setting
  (`#b8431a` default) via the `--skre-lb-accent` CSS variable set in Edit A.
- **Breakpoint** is `750px` everywhere in this package. To make it true-desktop-only, change every
  `min-width: 750px` in `01-desktop-styles.css` to `990px` (and tell your VS Code Claude the same).
- **Logo in the rail** reuses `section.settings.logo`. If that's your *white* logo (used on the
  olive picker) and looks wrong on the light rail, add a second image setting for a dark logo and
  swap the reference in `02-section-liquid.md`.
- **Real product photos** flow in automatically — the rail thumbnails and hero use the same
  `imageUrl` / variant images the production builder already resolves from your metaobjects.
- The two existing desktop helpers in the section (`@media (min-width: 600px)`) are left in place;
  the new `≥750px` rules override the `max-width: 480px` cap where needed.
