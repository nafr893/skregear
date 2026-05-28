# Step 3 — JS: rail rendering + hooks

**File:** `assets/skre-layer-builder.js`

Four small, surgical edits. Three are one-liners that hook into existing methods; one is a new
method. None change mobile behavior — `#renderRail()` simply finds nothing to update when the rail
isn't in the DOM path... actually the rail element always exists (it's just `display:none` on
mobile), so `#renderRail()` runs harmlessly on mobile too, writing into a hidden element. That's
fine and keeps the code path identical across breakpoints.

---

## Edit A — bind the rail checkout button + set the accent variable

In **`#bindBuilder()`**, find the existing summary-button binding:

```js
    this.querySelector('.skre-lb__summary-btn')?.addEventListener('click', () => this.#showSummary());
```

**Add immediately after it:**

```js
    // Desktop rail: checkout opens the summary; accent var drives the active marker
    this.querySelector('.skre-lb__rail-checkout')?.addEventListener('click', () => this.#showSummary());
    this.style.setProperty('--skre-lb-accent', this.dataset.atcColor || '#b8431a');
```

---

## Edit B — stamp the layer index onto each added line

In **`#addToSystem()`**, find the `this.#cartLines.push({ ... })` call and add a `layerIndex` field
so the rail can match lines back to their slot. Change:

```js
      this.#cartLines.push({
        key: addedItem?.key ?? String(variantData.id),
        variantId: variantData.id,
        title: variantData.productTitle,
        variantTitle: variantDisplay,
        price: variantData.price,
        price_display: variantData.price_display,
        msrp,
        imageUrl: variantData.imageUrl ?? '',
        layerLabel,
      });
```

to (one new line added):

```js
      this.#cartLines.push({
        key: addedItem?.key ?? String(variantData.id),
        variantId: variantData.id,
        title: variantData.productTitle,
        variantTitle: variantDisplay,
        price: variantData.price,
        price_display: variantData.price_display,
        msrp,
        imageUrl: variantData.imageUrl ?? '',
        layerLabel,
        layerIndex: this.#layerIndex,
      });
```

---

## Edit C — call `#renderRail()` whenever the layer or totals change

**C1.** At the **end of `#setLayer(i)`** (just before its closing `}`), add:

```js
    this.#renderRail();
```

**C2.** At the **end of `#renderSubtotal()`** (just before its closing `}`), add:

```js
    this.#renderRail();
```

These two cover every state change: navigating layers, adding to system, and removing a line all
route through one of them.

---

## Edit D — add the `#renderRail()` method

Paste this new method anywhere inside the class (e.g. right after `#renderSubtotal()`):

```js
  // ── Desktop rail (YOUR SYSTEM) ─────────────────────────────────────────────

  #renderRail() {
    const list = this.querySelector('.skre-lb__rail-list');
    if (!list) return; // rail markup not present

    const slots = this.#getSlots();
    const byIndex = {};
    this.#cartLines.forEach(l => { if (l.layerIndex != null) byIndex[l.layerIndex] = l; });

    list.innerHTML = slots.map((slot, i) => {
      const line = byIndex[i];
      const active = i === this.#layerIndex;
      const thumb = line
        ? `<span class="skre-lb__rail-thumb"><img src="${line.imageUrl}" alt="" loading="lazy"></span>`
        : `<span class="skre-lb__rail-thumb skre-lb__rail-thumb--empty">${i + 1}</span>`;
      const sub = line
        ? `${this.#esc(line.title)}${line.variantTitle ? ' \u00b7 ' + this.#esc(line.variantTitle) : ''}`
        : 'Not selected';
      const right = line
        ? `<span class="skre-lb__rail-price">${line.price_display}</span>
           <button class="skre-lb__rail-remove" data-rail-remove="${i}" data-key="${this.#esc(line.key)}" type="button" aria-label="Remove">&#215;</button>`
        : '';
      return `<button class="skre-lb__rail-slot${active ? ' skre-lb__rail-slot--active' : ''}" data-rail-layer="${i}" type="button">
        ${thumb}
        <span class="skre-lb__rail-info">
          <span class="skre-lb__rail-layer">${this.#esc(slot.label)}</span>
          <span class="skre-lb__rail-prod${line ? '' : ' skre-lb__rail-prod--empty'}">${sub}</span>
        </span>
        ${right}
      </button>`;
    }).join('');

    // Jump to a layer (ignore clicks that land on the remove button)
    list.querySelectorAll('[data-rail-layer]').forEach(btn => {
      btn.addEventListener('click', e => {
        if (e.target.closest('[data-rail-remove]')) return;
        this.#setLayer(Number(btn.dataset.railLayer));
      });
    });
    // Remove a line from the system
    list.querySelectorAll('[data-rail-remove]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const li = this.#cartLines.findIndex(l => l.layerIndex === Number(btn.dataset.railRemove));
        if (li >= 0) this.#removeLine(btn.dataset.key, li);
      });
    });

    // Count + totals + savings + checkout state
    const countEl = this.querySelector('.skre-lb__rail-count');
    if (countEl) countEl.textContent = `${this.#cartLines.length} / ${slots.length}`;

    const subEl = this.querySelector('.skre-lb__rail-subtotal');
    if (subEl) subEl.textContent = this.#formatMoney(this.#subtotal);
    const totalEl = this.querySelector('.skre-lb__rail-total');
    if (totalEl) totalEl.textContent = this.#formatMoney(this.#subtotal);

    const savings = Math.max(0, this.#msrpTotal - this.#subtotal);
    const savRow = this.querySelector('.skre-lb__rail-savings-row');
    const savEl = this.querySelector('.skre-lb__rail-savings');
    if (savEl) savEl.textContent = '\u2212' + this.#formatMoney(savings);
    if (savRow) savRow.hidden = savings <= 0;

    const checkoutBtn = this.querySelector('.skre-lb__rail-checkout');
    if (checkoutBtn) checkoutBtn.disabled = this.#cartLines.length === 0;
  }
```

---

## Why this is mobile-safe

- The rail element is `display:none` below 750px (Step 1 CSS), so it is never visible on mobile.
- `#renderRail()` writes into that hidden element; the work is trivial and has no visible effect on
  mobile. If you'd rather skip it entirely on mobile, you can early-return when
  `!window.matchMedia('(min-width: 750px)').matches`, but it isn't necessary.
- No existing method's behavior is changed — only additive lines and one new method.
