class SkreLayerBuilder extends HTMLElement {
  #data = null;
  #condition = null;
  #layerIndex = 0;
  #productIndexes = {};   // layerIndex → productIndex
  #selectedVariants = {}; // layerIndex → variant snapshot
  #cartLines = [];        // items added to system
  #subtotal = 0;          // in cents
  #msrpTotal = 0;         // compare_at_price sum for savings calculation
  #imgUrls = [];          // images for current product
  #imgIndex = 0;          // active image index

  // DOM refs cached on connect
  #picker = null;
  #builder = null;
  #summaryPanel = null;

  connectedCallback() {
    this.#picker = this.querySelector('.skre-lb__picker');
    this.#builder = this.querySelector('.skre-lb__builder');
    this.#summaryPanel = this.querySelector('.skre-lb__summary-panel');

    this.#bindPicker();
    this.#bindBuilder();

    const script = this.querySelector('#skre-lb-data');
    if (!script) {
      console.error('[skre-layer-builder] Data script tag not found');
      return;
    }
    try {
      this.#data = JSON.parse(script.textContent);
      this.#data.conditions.forEach(c => {
        c.slots.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
      });
    } catch (e) {
      console.error('[skre-layer-builder] Failed to parse data — check for JSON errors in the Liquid output', e);
    }
  }

  // ── Picker ──────────────────────────────────────────────────────────────

  #bindPicker() {
    this.querySelectorAll('[data-condition]').forEach(btn => {
      btn.addEventListener('click', () => this.#selectCondition(btn.dataset.condition));
    });
  }

  #selectCondition(key) {
    this.#condition = key;
    this.#layerIndex = 0;
    this.#productIndexes = {};
    this.#selectedVariants = {};
    this.#cartLines = [];
    this.#subtotal = 0;
    this.#msrpTotal = 0;
    this.#builder?.classList.remove('skre-lb__builder--has-items');

    if (this.#picker) this.#picker.hidden = true;
    if (this.#builder) this.#builder.hidden = false;

    this.#renderTabs();
    this.#setLayer(0);
  }

  // ── Builder ─────────────────────────────────────────────────────────────

  #bindBuilder() {
    this.querySelector('.skre-lb__close')?.addEventListener('click', () => {
      window.location.href = this.dataset.exitUrl || '/';
    });
    this.querySelector('.skre-lb__prev')?.addEventListener('click', () => this.#prevProduct());
    this.querySelector('.skre-lb__next')?.addEventListener('click', () => this.#nextProduct());
    this.#bindImageSwipe();
    this.querySelector('.skre-lb__atc')?.addEventListener('click', () => this.#addToSystem());
    this.querySelector('.skre-lb__summary-btn')?.addEventListener('click', () => this.#showSummary());
    this.querySelector('.skre-lb__summary-close')?.addEventListener('click', () => this.#hideSummary());
    this.querySelector('.skre-lb__summary-panel')?.addEventListener('click', e => {
      if (e.target === this.#summaryPanel) this.#hideSummary();
    });

    // Zoom / full-screen
    this.querySelector('.skre-lb__zoom-btn')?.addEventListener('click', () => this.#openZoom());
    this.querySelector('.skre-lb__zoom-close')?.addEventListener('click', () => this.#closeZoom());
    const zoomDialog = this.querySelector('.skre-lb__zoom-dialog');
    if (zoomDialog) {
      zoomDialog.addEventListener('click', e => {
        if (e.target === zoomDialog) this.#closeZoom();
      });
      let zoomSwipeY = 0;
      zoomDialog.addEventListener('touchstart', e => {
        zoomSwipeY = e.touches[0].clientY;
      }, { passive: true });
      zoomDialog.addEventListener('touchend', e => {
        if (e.changedTouches[0].clientY - zoomSwipeY > 60) this.#closeZoom();
      }, { passive: true });
      zoomDialog.addEventListener('cancel', () => this.#closeZoom());
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  #getConditionData() {
    return this.#data?.conditions?.find(c => c.key === this.#condition) ?? null;
  }

  #getSlots() {
    return this.#getConditionData()?.slots ?? [];
  }

  #activeSlot() {
    return this.#getSlots()[this.#layerIndex] ?? null;
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────

  #renderTabs() {
    const slots = this.#getSlots();
    const tabs = this.querySelector('.skre-lb__tabs');
    if (!tabs) return;

    tabs.innerHTML = slots.map((slot, i) => {
      const isActive = i === this.#layerIndex;
      const isDone = Boolean(this.#selectedVariants[i]);
      return `<button
        class="skre-lb__tab${isActive ? ' skre-lb__tab--active' : ''}${isDone && !isActive ? ' skre-lb__tab--done' : ''}"
        data-layer="${i}"
        role="tab"
        aria-selected="${isActive}"
      >${slot.label}</button>`;
    }).join('');

    tabs.querySelectorAll('[data-layer]').forEach(btn => {
      btn.addEventListener('click', () => this.#setLayer(Number(btn.dataset.layer)));
    });
  }

  // ── Layer navigation ─────────────────────────────────────────────────────

  #setLayer(i) {
    const slots = this.#getSlots();
    if (i < 0 || i >= slots.length) return;
    this.#layerIndex = i;
    this.#renderTabs();

    const slot = slots[i];
    const pi = this.#productIndexes[i] ?? 0;

    const labelEl = this.querySelector('.skre-lb__layer-label');
    if (labelEl) labelEl.textContent = `${slot.label} Options`;

    if (slot.products.length > 0) {
      this.#renderProduct(slot.products[Math.min(pi, slot.products.length - 1)], pi, slot.products.length);
    } else {
      this.#renderEmptySlot();
    }
  }

  #prevProduct() {
    const slot = this.#activeSlot();
    if (!slot) return;
    const current = this.#productIndexes[this.#layerIndex] ?? 0;
    const next = Math.max(0, current - 1);
    this.#productIndexes[this.#layerIndex] = next;
    this.#renderProduct(slot.products[next], next, slot.products.length);
  }

  #nextProduct() {
    const slot = this.#activeSlot();
    if (!slot) return;
    const current = this.#productIndexes[this.#layerIndex] ?? 0;
    const next = Math.min(slot.products.length - 1, current + 1);
    this.#productIndexes[this.#layerIndex] = next;
    this.#renderProduct(slot.products[next], next, slot.products.length);
  }

  // ── Product rendering ────────────────────────────────────────────────────

  #renderProduct(product, productIndex, totalProducts) {
    // Progress
    const progressText = this.querySelector('.skre-lb__progress-text');
    const progressFill = this.querySelector('.skre-lb__progress-fill');
    if (progressText) progressText.textContent = `${productIndex + 1}/${totalProducts}`;
    if (progressFill) {
      const pct = totalProducts > 1 ? ((productIndex + 1) / totalProducts) * 100 : 100;
      progressFill.style.width = `${pct}%`;
    }

    // Back/Next nav
    const prevBtn = this.querySelector('.skre-lb__prev');
    const nextBtn = this.querySelector('.skre-lb__next');
    if (prevBtn) prevBtn.disabled = productIndex === 0;
    if (nextBtn) nextBtn.disabled = productIndex === totalProducts - 1;

    // Text fields
    this.#setText('.skre-lb__title', product.title ?? '');
    this.#setText('.skre-lb__price', product.price_display ?? '');

    this.#renderRating(product);

    // Determine default variant (first available, else first)
    const defaultVariant = product.variants.find(v => v.available) ?? product.variants[0] ?? null;

    const defaultColor = defaultVariant?.option1 ?? null;
    const defaultSize = defaultVariant?.option2 ?? null;

    this.#renderSwatches(product, defaultColor);
    this.#renderSizes(product, defaultColor, defaultSize);

    const images = this.#getVariantImages(product, defaultVariant);
    this.#updateImages(images);
    this.#updateAtcPrice(defaultVariant);

    // Store selection snapshot for this layer
    if (defaultVariant) {
      this.#selectedVariants[this.#layerIndex] = {
        id: defaultVariant.id,
        title: defaultVariant.title,
        price: defaultVariant.price,
        price_display: defaultVariant.price_display,
        compare_at_price: defaultVariant.compare_at_price ?? null,
        option1: defaultVariant.option1,
        option2: defaultVariant.option2,
        imageUrl: images[0] ?? product.featured_image ?? '',
        productTitle: product.title,
      };
    }
  }

  #renderEmptySlot() {
    this.#setText('.skre-lb__title', 'No products in this slot yet.');
    this.#setText('.skre-lb__preview', '');
    this.#setText('.skre-lb__price', '');
    this.#updateImages([]);
    this.#updateAtcPrice(null);

    const prevBtn = this.querySelector('.skre-lb__prev');
    const nextBtn = this.querySelector('.skre-lb__next');
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;

    const progressText = this.querySelector('.skre-lb__progress-text');
    if (progressText) progressText.textContent = '0/0';

    const progressFill = this.querySelector('.skre-lb__progress-fill');
    if (progressFill) progressFill.style.width = '0%';
  }

  // ── Rating ───────────────────────────────────────────────────────────────

  #renderRating(product) {
    const starsEl = this.querySelector('.skre-lb__stars');
    const countEl = this.querySelector('.skre-lb__rating-count');

    const r = parseFloat(product.rating ?? 0);

    if (!r || !starsEl) {
      if (starsEl) starsEl.innerHTML = '';
      if (countEl) countEl.textContent = '';
      return;
    }

    const decimal = r % 1;
    const hasHalf = decimal >= 0.3 && decimal <= 0.7;
    const fullCount = Math.floor(r) + (decimal > 0.7 ? 1 : 0);
    const halfIndex = hasHalf ? Math.floor(r) : -1;

    starsEl.innerHTML = Array.from({ length: 5 }, (_, i) => {
      const full = i < fullCount;
      const half = i === halfIndex;
      const style = half ? ' style="fill:url(#skre-lb-half)"' : '';
      return `<svg class="skre-lb__star-svg${full || half ? ' filled-star' : ''}" viewBox="0 0 32 32" role="presentation"${style}><use href="#skre-lb-star"></use></svg>`;
    }).join('');

    if (countEl) countEl.textContent = product.rating_count ? `(${product.rating_count})` : '';
  }

  // ── Swatches ─────────────────────────────────────────────────────────────

  #renderSwatches(product, selectedColor) {
    const colorOpt = product.options.find(o => o.name.toLowerCase() === 'color');
    const container = this.querySelector('.skre-lb__swatches');
    const colorRow = this.querySelector('.skre-lb__color-row');
    const colorName = this.querySelector('.skre-lb__color-name');

    if (!colorOpt || !container) {
      if (colorRow) colorRow.hidden = true;
      return;
    }

    if (colorRow) colorRow.hidden = false;
    if (colorName) colorName.textContent = selectedColor ?? colorOpt.values[0] ?? '';

    container.innerHTML = colorOpt.values.map(val => {
      const swatch = product.swatches?.[val];
      const swStyle = swatch?.image
        ? `background-image:url('${swatch.image}')`
        : swatch?.color
          ? `background-color:${swatch.color}`
          : 'background-color:#ccc';
      const isActive = val === selectedColor;
      return `<button
        class="skre-lb__swatch${isActive ? ' skre-lb__swatch--active' : ''}"
        data-color="${this.#esc(val)}"
        style="${swStyle}"
        aria-label="${this.#esc(val)}"
        aria-pressed="${isActive}"
      ></button>`;
    }).join('');

    container.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => this.#selectColor(btn.dataset.color));
    });
  }

  // ── Sizes ─────────────────────────────────────────────────────────────────

  #renderSizes(product, selectedColor, selectedSize) {
    const sizeOpt = product.options.find(o => o.name.toLowerCase() === 'size');
    const container = this.querySelector('.skre-lb__sizes');
    if (!container) return;

    if (!sizeOpt) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = sizeOpt.values.map(val => {
      const v = product.variants.find(vv => {
        const colorMatch = !selectedColor || vv.option1 === selectedColor;
        const sizeMatch = vv.option2 === val || (!vv.option2 && vv.option1 === val);
        return colorMatch && sizeMatch;
      });
      const available = v?.available !== false;
      const isActive = val === selectedSize;
      return `<button
        class="skre-lb__size${isActive ? ' skre-lb__size--active' : ''}${!available ? ' skre-lb__size--unavailable' : ''}"
        data-size="${this.#esc(val)}"
        ${!available ? 'disabled' : ''}
        aria-pressed="${isActive}"
      >${val}</button>`;
    }).join('');

    container.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => this.#selectSize(btn.dataset.size));
    });
  }

  // ── Color selection ───────────────────────────────────────────────────────

  #selectColor(colorValue) {
    const slot = this.#activeSlot();
    if (!slot) return;
    const pi = this.#productIndexes[this.#layerIndex] ?? 0;
    const product = slot.products[pi];
    if (!product) return;

    const currentSize = this.#selectedVariants[this.#layerIndex]?.option2;

    let variant =
      product.variants.find(v => v.option1 === colorValue && v.option2 === currentSize && v.available) ??
      product.variants.find(v => v.option1 === colorValue && v.available) ??
      product.variants.find(v => v.option1 === colorValue);

    const images = this.#getVariantImages(product, variant);
    this.#updateImages(images);

    const colorName = this.querySelector('.skre-lb__color-name');
    if (colorName) colorName.textContent = colorValue;

    this.querySelectorAll('.skre-lb__swatch').forEach(btn => {
      const active = btn.dataset.color === colorValue;
      btn.classList.toggle('skre-lb__swatch--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    this.#renderSizes(product, colorValue, variant?.option2 ?? null);
    this.#updateAtcPrice(variant);

    if (variant) {
      this.#selectedVariants[this.#layerIndex] = {
        id: variant.id,
        title: variant.title,
        price: variant.price,
        price_display: variant.price_display,
        compare_at_price: variant.compare_at_price ?? null,
        option1: variant.option1,
        option2: variant.option2,
        imageUrl: images[0] ?? product.featured_image ?? '',
        productTitle: product.title,
      };
    }
  }

  // ── Size selection ────────────────────────────────────────────────────────

  #selectSize(sizeValue) {
    const slot = this.#activeSlot();
    if (!slot) return;
    const pi = this.#productIndexes[this.#layerIndex] ?? 0;
    const product = slot.products[pi];
    if (!product) return;

    const currentColor = this.#selectedVariants[this.#layerIndex]?.option1;

    const variant =
      product.variants.find(v => v.option1 === currentColor && v.option2 === sizeValue) ??
      product.variants.find(v => v.option2 === sizeValue || v.option1 === sizeValue);

    this.querySelectorAll('.skre-lb__size').forEach(btn => {
      const active = btn.dataset.size === sizeValue;
      btn.classList.toggle('skre-lb__size--active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (variant) {
      this.#selectedVariants[this.#layerIndex] = {
        ...this.#selectedVariants[this.#layerIndex],
        id: variant.id,
        title: variant.title,
        price: variant.price,
        price_display: variant.price_display,
        option2: variant.option2,
      };
      this.#updateAtcPrice(variant);
    }
  }

  // ── Images ────────────────────────────────────────────────────────────────

  #getVariantImages(product, variant) {
    if (variant?.variant_images?.length) return variant.variant_images;
    if (variant?.featured_image) return [variant.featured_image];
    if (product?.featured_image) return [product.featured_image];
    return [];
  }

  #updateImages(urls) {
    this.#imgUrls = urls;
    this.#imgIndex = 0;
    this.#renderHeroImage();
  }

  #renderHeroImage() {
    const hero = this.querySelector('.skre-lb__hero');
    const fill = this.querySelector('.skre-lb__img-fill');
    const track = this.querySelector('.skre-lb__img-track');
    const urls = this.#imgUrls;

    if (hero) hero.src = urls[this.#imgIndex] ?? '';

    const total = urls.length;
    const pct = total > 1 ? ((this.#imgIndex + 1) / total) * 100 : 100;
    if (fill) fill.style.width = `${pct}%`;
    if (track) track.style.display = total > 1 ? '' : 'none';
  }

  #prevImage() {
    if (this.#imgIndex > 0) {
      this.#imgIndex--;
      this.#renderHeroImage();
    }
  }

  #nextImage() {
    if (this.#imgIndex < this.#imgUrls.length - 1) {
      this.#imgIndex++;
      this.#renderHeroImage();
    }
  }

  #bindImageSwipe() {
    const wrap = this.querySelector('.skre-lb__media');
    if (!wrap) return;
    let startX = 0;
    let startY = 0;
    wrap.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    wrap.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) this.#nextImage();
      else this.#prevImage();
    }, { passive: true });
  }

  // ── ATC button ────────────────────────────────────────────────────────────

  #updateAtcPrice(variant) {
    const priceEl = this.querySelector('.skre-lb__atc-price');
    const btn = this.querySelector('.skre-lb__atc');
    if (priceEl) priceEl.textContent = variant?.price_display ?? '';
    if (btn) btn.disabled = !variant?.id;
  }

  async #addToSystem() {
    const variantData = this.#selectedVariants[this.#layerIndex];
    if (!variantData?.id) {
      alert('Please select options before adding to your system.');
      return;
    }

    const btn = this.querySelector('.skre-lb__atc');
    const labelEl = btn?.querySelector('.skre-lb__atc-label');
    if (btn) btn.disabled = true;
    if (labelEl) labelEl.textContent = 'Adding…';

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: variantData.id, quantity: 1 }] }),
      });
      const data = await res.json();
      if (data.status) throw new Error(data.message ?? 'Cart error');

      const addedItem = Array.isArray(data.items) ? data.items[0] : data;
      const layerLabel = this.#activeSlot()?.label ?? '';
      const variantDisplay = variantData.title === 'Default Title' ? '' : variantData.title;

      const msrp = (variantData.compare_at_price && variantData.compare_at_price > variantData.price)
        ? variantData.compare_at_price
        : variantData.price;

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

      this.#subtotal += variantData.price;
      this.#msrpTotal += msrp;
      this.#builder?.classList.add('skre-lb__builder--has-items');
      this.#renderSubtotal();
      this.#advanceLayer();

    } catch (err) {
      console.error('[skre-layer-builder] Cart add failed', err);
      alert('Something went wrong adding to cart. Please try again.');
    } finally {
      if (btn) btn.disabled = false;
      if (labelEl) labelEl.textContent = 'ADD TO SYSTEM';
    }
  }

  #advanceLayer() {
    const slots = this.#getSlots();
    const next = this.#layerIndex + 1;
    if (next < slots.length) {
      this.#setLayer(next);
    } else {
      this.#showSummary();
    }
  }

  // ── Subtotal ──────────────────────────────────────────────────────────────

  #renderSubtotal() {
    const el = this.querySelector('.skre-lb__subtotal-amount');
    if (el) el.textContent = this.#formatMoney(this.#subtotal);

    const savings = Math.max(0, this.#msrpTotal - this.#subtotal);
    const savingsLabel = this.querySelector('.skre-lb__savings-label');
    const savingsAmount = this.querySelector('.skre-lb__savings-amount');
    if (savingsLabel) {
      const hasItems = this.#cartLines.length > 0;
      if (savingsAmount) savingsAmount.textContent = this.#formatMoney(savings);
      savingsLabel.hidden = !hasItems;
    }
  }

  #formatMoney(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // ── Summary panel ─────────────────────────────────────────────────────────

  #showSummary() {
    if (!this.#summaryPanel) return;
    this.#renderSummaryItems();
    this.#summaryPanel.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  #hideSummary() {
    if (!this.#summaryPanel) return;
    this.#summaryPanel.hidden = true;
    document.body.style.overflow = '';
  }

  #renderSummaryItems() {
    const itemsContainer = this.querySelector('.skre-lb__summary-items');
    const totalEl = this.querySelector('.skre-lb__summary-total');

    if (itemsContainer) {
      if (this.#cartLines.length === 0) {
        itemsContainer.innerHTML =
          '<p style="padding:1.25rem 1rem;color:#888;font-size:0.82rem;">No items added yet.</p>';
      } else {
        itemsContainer.innerHTML = this.#cartLines.map((line, i) =>
          `<div class="skre-lb__summary-item">
            <img class="skre-lb__si-img" src="${line.imageUrl}" alt="${this.#esc(line.title)}" loading="lazy">
            <div class="skre-lb__si-info">
              <p class="skre-lb__si-name">${line.title}</p>
              <p class="skre-lb__si-variant">${line.layerLabel}${line.variantTitle ? ' &middot; ' + line.variantTitle : ''}</p>
            </div>
            <span class="skre-lb__si-price">${line.price_display}</span>
            <button class="skre-lb__si-remove" data-key="${this.#esc(line.key)}" data-idx="${i}" type="button" aria-label="Remove">
              &#215;
            </button>
          </div>`
        ).join('');

        itemsContainer.querySelectorAll('[data-key]').forEach(btn => {
          btn.addEventListener('click', () =>
            this.#removeLine(btn.dataset.key, Number(btn.dataset.idx))
          );
        });
      }
    }

    if (totalEl) {
      totalEl.innerHTML = `<span>System Total</span><span>${this.#formatMoney(this.#subtotal)}</span>`;
    }
  }

  async #removeLine(lineKey, lineIdx) {
    if (lineIdx < 0 || lineIdx >= this.#cartLines.length) return;
    try {
      await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: lineKey, quantity: 0 }),
      });
      const [removed] = this.#cartLines.splice(lineIdx, 1);
      if (removed) {
        this.#subtotal = Math.max(0, this.#subtotal - removed.price);
        this.#msrpTotal = Math.max(0, this.#msrpTotal - (removed.msrp ?? removed.price));
        if (this.#cartLines.length === 0) {
          this.#builder?.classList.remove('skre-lb__builder--has-items');
        }
        this.#renderSubtotal();
        this.#renderSummaryItems();
      }
    } catch (err) {
      console.error('[skre-layer-builder] Remove line failed', err);
    }
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────

  #openZoom() {
    const dialog = this.querySelector('.skre-lb__zoom-dialog');
    const img = this.querySelector('.skre-lb__zoom-img');
    if (!dialog || !img) return;
    img.src = this.#imgUrls[this.#imgIndex] ?? '';
    dialog.showModal();
  }

  #closeZoom() {
    const dialog = this.querySelector('.skre-lb__zoom-dialog');
    if (dialog?.open) dialog.close();
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  #setText(selector, text) {
    const el = this.querySelector(selector);
    if (el) el.textContent = text;
  }

  #esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
}

if (!customElements.get('skre-layer-builder')) {
  customElements.define('skre-layer-builder', SkreLayerBuilder);
}
