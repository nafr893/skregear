# Step 2 — Liquid: add the desktop rail markup

**File:** `sections/skre-layering-system.liquid`

The desktop rail lives **inside** `.skre-lb__builder`. It is `display:none` on mobile (the CSS in
Step 1 only reveals it at ≥750px), so adding it is safe for the existing mobile experience.

## Where to insert

Find the opening of the builder screen — this line:

```liquid
  {%- comment -%} ── Screen B: Builder ── {%- endcomment -%}
  <div class="skre-lb__builder" hidden>
```

**Immediately after** that opening `<div class="skre-lb__builder" hidden>` tag, paste the rail
block below (so the rail is the FIRST child of `.skre-lb__builder`, which is what the CSS grid
expects in `grid-column: 1`):

```liquid
    {%- comment -%} ── Desktop-only: YOUR SYSTEM rail (≥750px) ── {%- endcomment -%}
    <aside class="skre-lb__rail" aria-hidden="true">
      <div class="skre-lb__rail-head">
        <div class="skre-lb__rail-brand">
          {%- if section.settings.logo -%}
            {{
              section.settings.logo
              | image_url: width: 96
              | image_tag: alt: shop.name, loading: 'eager', class: 'skre-lb__rail-logo', widths: '48, 96'
            }}
          {%- else -%}
            <span class="skre-lb__rail-wordmark">{{ shop.name | upcase }}</span>
          {%- endif -%}
          <span class="skre-lb__rail-title">Your System</span>
        </div>
        <span class="skre-lb__rail-count"></span>
      </div>

      <div class="skre-lb__rail-list"></div>

      <div class="skre-lb__rail-foot">
        <div class="skre-lb__rail-totals">
          <div class="skre-lb__rail-line">
            <span>Subtotal</span>
            <span class="skre-lb__rail-subtotal">{{ 0 | money }}</span>
          </div>
          <div class="skre-lb__rail-line skre-lb__rail-savings-row" hidden>
            <span>You Save</span>
            <span class="skre-lb__rail-savings"></span>
          </div>
          <div class="skre-lb__rail-line skre-lb__rail-line--total">
            <span>System Total</span>
            <span class="skre-lb__rail-total">{{ 0 | money }}</span>
          </div>
        </div>
        <button class="skre-lb__rail-checkout" type="button" disabled>Review System</button>
      </div>
    </aside>
```

> **Note on the logo:** the section already has a `logo` setting (used on the picker screen). The
> rail reuses it, falling back to the shop name wordmark if no logo is set. If you prefer the
> dark logo here instead of the white one used on the olive picker, add a second `image_picker`
> setting and swap `section.settings.logo` for it.

That's the only Liquid change. Everything else (picker, region, media, info, summary, zoom) is
untouched.
