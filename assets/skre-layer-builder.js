class SkreLayerBuilder extends HTMLElement {
  #data = null;
  #condition = null;
  #region = null;
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
  #regionPicker = null;
  #builder = null;
  #summaryPanel = null;
  #scPanel = null;
  #tourStep = -1;
  #tourEl = null;

  static #SEEN_KEY = 'skre-lb-seen';

  static #TOUR_STEPS_DESKTOP = [
    {
      selector: '.skre-lb__rail-list',
      label: 'Your Layers',
      desc: 'See every layer of your system here. Each slot shows what you\'ve added.',
      cardSide: 'right',
    },
    {
      selector: '.skre-lb__media',
      label: 'Browse Images',
      desc: 'Swipe or tap the arrows to explore product images. Thumbnails let you jump to any angle.',
      cardSide: 'right',
    },
    {
      selector: '.skre-lb__cap-left',
      label: 'Base Layer Options',
      desc: 'This is where you select your base layer options. Use Back and Next to move between layers, and track your progress through the system.',
      cardSide: 'right',
    },
    {
      selector: '.skre-lb__info',
      label: 'Product Info',
      desc: 'Read specs, performance ratings, and product overview. Select your color and size here.',
      cardSide: 'left',
    },
    {
      selector: '.skre-lb__rail-foot',
      label: 'Add to System',
      desc: 'When you\'re ready, hit Add to System. Once all layers are chosen, Review System to check out.',
      cardSide: 'right',
    },
  ];

  static #TOUR_STEPS_MOBILE = [
    {
      selector: '.skre-lb__header',
      label: 'Your Layers',
      desc: 'See every layer of your system here. Each slot shows what you\'ve added.',
      cardSide: 'right',
    },
    {
      selector: '.skre-lb__media',
      label: 'Browse Images',
      desc: 'Swipe to explore product images and tap the \'layer options\' to see different styles.',
      cardSide: 'right',
    },
    {
      selector: '.skre-lb__info',
      label: 'Product Info',
      desc: 'Read specs, performance ratings, and product overview. Select your color and size here.',
      cardSide: 'right',
    },
    {
      selector: '.skre-lb__action-row',
      label: 'Add to System',
      desc: 'When you\'re ready, hit Add to System. Once all layers are chosen, Review System to check out.',
      cardSide: 'right',
    },
  ];

  connectedCallback() {
    this.#picker = this.querySelector('.skre-lb__picker');
    this.#regionPicker = this.querySelector('.skre-lb__region-picker');
    this.#builder = this.querySelector('.skre-lb__builder');
    this.#summaryPanel = this.querySelector('.skre-lb__summary-panel');
    this.#scPanel = this.querySelector('.skre-lb__sc-dialog');

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
    this.querySelector('.skre-lb__region-back')?.addEventListener('click', () => {
      if (this.#regionPicker) this.#regionPicker.hidden = true;
      if (this.#picker) this.#picker.hidden = false;
    });
  }

  #renderRegionPicker(regions) {
    const container = this.querySelector('.skre-lb__region-btns');
    if (!container) return;
    container.innerHTML = regions.map(r =>
      `<button class="skre-lb__region-btn" data-region="${this.#esc(r.key)}" type="button">
        ${this.#esc(r.key.toUpperCase())}
      </button>`
    ).join('');
    container.querySelectorAll('[data-region]').forEach(btn => {
      btn.addEventListener('click', () => this.#selectRegion(btn.dataset.region));
    });
  }

  #selectRegion(key) {
    this.#region = key;
    if (this.#regionPicker) this.#regionPicker.hidden = true;
    if (this.#builder) this.#builder.hidden = false;
    this.#renderTabs();
    this.#setLayer(0);
    this.#maybeShowTutorial();
  }

  #selectCondition(key) {
    this.#condition = key;
    this.#region = null;
    this.#layerIndex = 0;
    this.#productIndexes = {};
    this.#selectedVariants = {};
    this.#cartLines = [];
    this.#subtotal = 0;
    this.#msrpTotal = 0;
    this.#builder?.classList.remove('skre-lb__builder--has-items');

    if (this.#picker) this.#picker.hidden = true;

    const regions = this.#getConditionData()?.regions ?? [];
    if (regions.length > 1) {
      this.#renderRegionPicker(regions);
      if (this.#regionPicker) this.#regionPicker.hidden = false;
    } else {
      this.#region = regions[0]?.key ?? '';
      if (this.#builder) this.#builder.hidden = false;
      this.#renderTabs();
      this.#setLayer(0);
      this.#maybeShowTutorial();
    }
  }

  // ── Spotlight tour ───────────────────────────────────────────────────────

  #maybeShowTutorial() {
    if (!localStorage.getItem(SkreLayerBuilder.#SEEN_KEY)) {
      setTimeout(() => this.#showTutorial(0), 400);
    }
  }

  #showTutorial(step = 0) {
    // Remove any existing tour overlay
    this.#tourEl?.remove();

    const isDesktop = window.matchMedia('(min-width: 750px)').matches;
    const steps = isDesktop
      ? SkreLayerBuilder.#TOUR_STEPS_DESKTOP
      : SkreLayerBuilder.#TOUR_STEPS_MOBILE;

    const s = steps[step];
    if (!s) return;

    const target = this.querySelector(s.selector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    // Skip invisible steps (e.g. desktop-only element on mobile)
    if (rect.width === 0 && rect.height === 0) { this.#showTutorial(step + 1); return; }
    const pad = 6;

    // Build overlay
    const tour = document.createElement('div');
    tour.className = 'skre-lb__tour';
    this.#tourEl = tour;

    // Spotlight cutout
    const spot = document.createElement('div');
    spot.className = 'skre-lb__tour-spot';
    spot.style.cssText = `top:${rect.top - pad}px;left:${rect.left - pad}px;width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px;`;
    tour.appendChild(spot);

    // Info card — position above or below the spotlight
    const card = document.createElement('div');
    card.className = 'skre-lb__tour-card';

    const isLast = step === steps.length - 1;
    const nextLabel = isLast ? 'Start Building' : 'Next ›';

    card.innerHTML = `
      <button class="skre-lb__tour-close" type="button" aria-label="Close tour">&#215;</button>
      <div class="skre-lb__tour-step">${step + 1} / ${steps.length}</div>
      <div class="skre-lb__tour-label">${s.label}</div>
      <div class="skre-lb__tour-desc">${s.desc}</div>
      <div class="skre-lb__tour-nav">
        <button class="skre-lb__tour-btn" type="button">${nextLabel}</button>
      </div>`;

    tour.appendChild(card);
    document.body.appendChild(tour);

    // Position card after it's in the DOM so we know its size
    requestAnimationFrame(() => {
      const cardH = card.offsetHeight;
      const cardW = card.offsetWidth;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const GAP = 14;

      // Vertical: prefer below spotlight; flip above if not enough room
      let cardTop = rect.bottom + pad + GAP;
      if (cardTop + cardH > vh - 8) cardTop = rect.top - pad - GAP - cardH;
      cardTop = Math.max(8, cardTop);

      // Horizontal: align to left or right edge of spotlight, clamp to viewport
      let cardLeft = s.cardSide === 'left'
        ? rect.right + pad - cardW
        : rect.left - pad;
      cardLeft = Math.min(Math.max(8, cardLeft), vw - cardW - 8);

      card.style.top = `${cardTop}px`;
      card.style.left = `${cardLeft}px`;
    });

    // Wire buttons
    card.querySelector('.skre-lb__tour-close').addEventListener('click', () => this.#dismissTutorial());
    card.querySelector('.skre-lb__tour-btn').addEventListener('click', () => {
      if (isLast) {
        this.#dismissTutorial();
      } else {
        this.#showTutorial(step + 1);
      }
    });
  }

  #dismissTutorial() {
    localStorage.setItem(SkreLayerBuilder.#SEEN_KEY, '1');
    this.#tourEl?.remove();
    this.#tourEl = null;
    this.#tourStep = -1;
  }

  // ── Builder ─────────────────────────────────────────────────────────────

  #bindBuilder() {
    const exitFn = () => { window.location.href = this.dataset.exitUrl || '/'; };
    this.querySelector('.skre-lb__close')?.addEventListener('click', exitFn);
    this.querySelector('.skre-lb__info-close')?.addEventListener('click', exitFn);
    const skipFn = () => this.#advanceLayer();
    this.querySelector('.skre-lb__skip-btn')?.addEventListener('click', skipFn);
    this.querySelector('.skre-lb__rail-skip')?.addEventListener('click', skipFn);
    this.querySelector('.skre-lb__prev')?.addEventListener('click', () => this.#prevProduct());
    this.querySelector('.skre-lb__next')?.addEventListener('click', () => this.#nextProduct());
    this.querySelector('.skre-lb__strip-prev')?.addEventListener('click', () => this.#prevImage());
    this.querySelector('.skre-lb__strip-next')?.addEventListener('click', () => this.#nextImage());
    this.#bindImageSwipe();
    this.querySelector('.skre-lb__atc')?.addEventListener('click', () => this.#addToSystem());
    this.querySelector('.skre-lb__summary-btn')?.addEventListener('click', () => this.#showSummary());
    // Desktop rail: checkout opens the summary; accent var drives the active marker
    this.querySelector('.skre-lb__rail-checkout')?.addEventListener('click', () => this.#showSummary());
    this.querySelector('.skre-lb__rail-atc')?.addEventListener('click', () => this.#addToSystem());
    this.style.setProperty('--skre-lb-accent', this.dataset.atcColor || '#b8431a');
    this.querySelector('.skre-lb__summary-close')?.addEventListener('click', () => this.#hideSummary());
    this.querySelector('.skre-lb__size-chart-link')?.addEventListener('click', () => this.#openSizeChart());
    this.querySelector('.skre-lb__sc-close')?.addEventListener('click', () => this.#closeSizeChart());
    this.#scPanel?.addEventListener('click', e => { if (e.target === this.#scPanel) this.#closeSizeChart(); });
    this.#scPanel?.addEventListener('cancel', e => { e.preventDefault(); this.#closeSizeChart(); });
    this.querySelectorAll('.skre-lb__help-btn').forEach(btn =>
      btn.addEventListener('click', () => this.#showTutorial())
    );
    this.querySelector('.skre-lb__summary-panel')?.addEventListener('click', e => {
      if (e.target === this.#summaryPanel) this.#hideSummary();
    });

    // Zoom / full-screen
    this.querySelector('.skre-lb__expand')?.addEventListener('click', () => this.#toggleExpand());
    this.#bindAccordions();
    this.querySelector('.skre-lb__zoom-btn')?.addEventListener('click', () => this.#openZoom());
    this.querySelector('.skre-lb__hover-arrow--prev')?.addEventListener('click', () => this.#prevImage());
    this.querySelector('.skre-lb__hover-arrow--next')?.addEventListener('click', () => this.#nextImage());
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
    const regions = this.#getConditionData()?.regions ?? [];
    const region = regions.find(r => r.key === this.#region) ?? regions[0] ?? null;
    return region?.slots ?? [];
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
      const isDone = this.#cartLines.some(l => l.layerIndex === i);
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

    /* Defer ink positioning until after browser recalculates layout */
    requestAnimationFrame(() => this.#positionTabInk(tabs));
  }

  #positionTabInk(tabs) {
    let ink = tabs.querySelector('.skre-lb__tabs-ink');
    if (!ink) {
      ink = document.createElement('span');
      ink.className = 'skre-lb__tabs-ink';
      ink.setAttribute('aria-hidden', 'true');
      tabs.appendChild(ink);
    }
    const active = tabs.querySelector('.skre-lb__tab--active');
    if (active) {
      /* ink is inside the scrollable container so it scrolls with it —
         offsetLeft alone (no scrollLeft) gives the correct content position */
      ink.style.left = active.offsetLeft + 'px';
      ink.style.width = active.offsetWidth + 'px';
    }
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
    if (labelEl) labelEl.textContent = `More ${slot.label} Options`;

    if (slot.products.length > 0) {
      this.#renderProduct(slot.products[Math.min(pi, slot.products.length - 1)], pi, slot.products.length);
    } else {
      this.#renderEmptySlot();
    }
    this.#updateSkipLabel();
    this.#renderRail();
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
    this.#updateMediaBackground(product, defaultColor);
    this.#renderExpandedContent(product);
    this.#collapseExpand();

    const images = this.#getVariantImages(product, defaultVariant);
    this.#updateImages(images);
    this.#updateAtcPrice(defaultVariant);
    this.#updateSizeChartTable(product.size_chart ?? null);

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
    const ratingLeft = this.querySelector('.skre-lb__rating-left');

    const r = parseFloat(product.rating ?? 0);

    if (!r || !starsEl) {
      if (starsEl) starsEl.innerHTML = '';
      if (countEl) countEl.textContent = '';
      if (ratingLeft) ratingLeft.hidden = true;
      return;
    }
    if (ratingLeft) ratingLeft.hidden = false;

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

    const label = this.querySelector('.skre-lb__sizes-label');
    if (label) label.textContent = selectedSize ? `Select Size: ${selectedSize}` : 'Select Size';
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
    this.#updateMediaBackground(product, colorValue);

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

    const label = this.querySelector('.skre-lb__sizes-label');
    if (label) label.textContent = `Select Size: ${sizeValue}`;

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

  // ── Media background ─────────────────────────────────────────────────────

  #updateMediaBackground(product, colorValue) {
    const heroWrap = this.querySelector('.skre-lb__hero-wrap');
    if (!heroWrap) return;
    heroWrap.style.backgroundColor = '#fff';
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

    // Image filmstrip (desktop)
    const stripTrack = this.querySelector('.skre-lb__strip-track');
    const stripPrev = this.querySelector('.skre-lb__strip-prev');
    const stripNext = this.querySelector('.skre-lb__strip-next');

    if (stripTrack) {
      // Render 6 slots (5 visible + 1 hint) centred on active, using modulo for infinite loop
      const RENDER = 6;
      const items = [];
      for (let offset = -1; offset < RENDER - 1; offset++) {
        const idx = ((this.#imgIndex + offset) % total + total) % total;
        items.push({ idx, active: offset === 0 });
      }
      stripTrack.style.transform = '';
      stripTrack.innerHTML = items.map(({ idx, active }) =>
        `<button class="skre-lb__strip-thumb${active ? ' skre-lb__strip-thumb--active' : ''}" data-strip-img="${idx}" type="button" aria-label="Image ${idx + 1}">
          <img src="${urls[idx]}" alt="" loading="lazy">
        </button>`
      ).join('');
      stripTrack.querySelectorAll('[data-strip-img]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.#imgIndex = Number(btn.dataset.stripImg);
          this.#renderHeroImage();
        });
      });
    }
    if (stripPrev) stripPrev.disabled = urls.length <= 1;
    if (stripNext) stripNext.disabled = urls.length <= 1;

    // Hover arrows: invisible at boundaries so space-between layout stays stable
    const prevArrow = this.querySelector('.skre-lb__hover-arrow--prev');
    const nextArrow = this.querySelector('.skre-lb__hover-arrow--next');
    const hideArrow = (el, hide) => {
      if (!el) return;
      el.style.visibility = hide ? 'hidden' : '';
      el.style.pointerEvents = hide ? 'none' : '';
    };
    hideArrow(prevArrow, urls.length <= 1);
    hideArrow(nextArrow, urls.length <= 1);
  }

  #prevImage() {
    if (this.#imgUrls.length <= 1) return;
    this.#imgIndex = (this.#imgIndex - 1 + this.#imgUrls.length) % this.#imgUrls.length;
    this.#renderHeroImage();
  }

  #nextImage() {
    if (this.#imgUrls.length <= 1) return;
    this.#imgIndex = (this.#imgIndex + 1) % this.#imgUrls.length;
    this.#renderHeroImage();
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
    const railAtc = this.querySelector('.skre-lb__rail-atc');
    const railPrice = this.querySelector('.skre-lb__rail-atc-price');
    if (priceEl) priceEl.textContent = variant?.price_display ?? '';
    if (railPrice) railPrice.textContent = variant?.price_display ?? '';
    if (btn) btn.disabled = !variant?.id;
    if (railAtc) railAtc.disabled = !variant?.id;
  }

  async #addToSystem() {
    const variantData = this.#selectedVariants[this.#layerIndex];
    if (!variantData?.id) {
      alert('Please select options before adding to your system.');
      return;
    }

    const btn = this.querySelector('.skre-lb__atc');
    const labelEl = btn?.querySelector('.skre-lb__atc-label');
    const railAtc = this.querySelector('.skre-lb__rail-atc');
    const railLabel = this.querySelector('.skre-lb__rail-atc-label');
    if (btn) btn.disabled = true;
    if (railAtc) railAtc.disabled = true;

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: variantData.id, quantity: 1 }] }),
      });
      let data = {};
      try { data = await res.json(); } catch (_) {}
      if (!res.ok) throw new Error(data.message ?? 'Cart error');

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
        layerIndex: this.#layerIndex,
      });

      this.#subtotal += variantData.price;
      this.#msrpTotal += msrp;
      this.#builder?.classList.add('skre-lb__builder--has-items');
      this.#renderSubtotal();
      this.#renderTabs();
      this.#updateSkipLabel();

      if (btn) btn.disabled = false;
      if (railAtc) railAtc.disabled = false;
      return; // skip finally label-reset

    } catch (err) {
      console.error('[skre-layer-builder] Cart add failed', err);
    } finally {
      if (btn) btn.disabled = false;
      if (railAtc) railAtc.disabled = false;
    }
    // Only reached on error
    if (labelEl) labelEl.textContent = 'ADD TO SYSTEM';
    if (railLabel) railLabel.textContent = 'ADD TO SYSTEM';
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

  #updateSkipLabel() {
    const hasAdded = this.#cartLines.some(l => l.layerIndex === this.#layerIndex);
    const slots = this.#getSlots();
    const isLast = this.#layerIndex >= slots.length - 1;
    const label = hasAdded
      ? (isLast ? 'Review System' : 'Next Layer →')
      : 'Skip Layer';
    const skipBtn = this.querySelector('.skre-lb__skip-btn');
    const railSkip = this.querySelector('.skre-lb__rail-skip');
    if (skipBtn) skipBtn.textContent = label;
    if (railSkip) railSkip.textContent = label;
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
    this.#renderRail();
  }

  #formatMoney(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // ── Desktop rail (YOUR SYSTEM) ─────────────────────────────────────────────

  #renderRail() {
    const list = this.querySelector('.skre-lb__rail-list');
    if (!list) return; // rail markup not present

    const slots = this.#getSlots();
    // Group lines by layer, keeping absolute cart index for removal
    const byIndex = {};
    this.#cartLines.forEach((l, idx) => {
      if (l.layerIndex != null) {
        if (!byIndex[l.layerIndex]) byIndex[l.layerIndex] = [];
        byIndex[l.layerIndex].push({ ...l, _cartIdx: idx });
      }
    });

    list.innerHTML = slots.map((slot, i) => {
      const lines = byIndex[i] ?? [];
      const active = i === this.#layerIndex;
      const thumb = lines.length
        ? `<span class="skre-lb__rail-thumb"><img src="${lines[0].imageUrl}" alt="" loading="lazy"></span>`
        : `<span class="skre-lb__rail-thumb skre-lb__rail-thumb--empty">${i + 1}</span>`;
      const itemsHtml = lines.length
        ? lines.map(line => `
            <div class="skre-lb__rail-item">
              <span class="skre-lb__rail-prod">${this.#esc(line.title)}${line.variantTitle ? ' · ' + this.#esc(line.variantTitle) : ''}</span>
              <span class="skre-lb__rail-price">${line.price_display}</span>
            </div>`).join('')
        : `<span class="skre-lb__rail-prod skre-lb__rail-prod--empty">Not selected</span>`;
      const removeBtn = lines.length
        ? `<button class="skre-lb__rail-remove" data-rail-remove data-cart-idx="${lines[0]._cartIdx}" data-key="${this.#esc(lines[0].key)}" type="button" aria-label="Remove">&#215;</button>`
        : '';
      return `<div class="skre-lb__rail-slot${active ? ' skre-lb__rail-slot--active' : ''}" data-rail-layer="${i}" role="button" tabindex="0">
        ${removeBtn}
        ${thumb}
        <span class="skre-lb__rail-info">
          <span class="skre-lb__rail-layer">${this.#esc(slot.label)}</span>
          ${itemsHtml}
        </span>
      </div>`;
    }).join('');

    // Jump to a layer (ignore clicks that land on the remove button)
    list.querySelectorAll('[data-rail-layer]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-rail-remove]')) return;
        this.#setLayer(Number(el.dataset.railLayer));
      });
      el.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-rail-remove]')) {
          e.preventDefault();
          this.#setLayer(Number(el.dataset.railLayer));
        }
      });
    });
    // Remove a line from the system using absolute cart index
    list.querySelectorAll('[data-rail-remove]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.#removeLine(btn.dataset.key, Number(btn.dataset.cartIdx));
      });
    });

    // Count + totals + savings + checkout state
    const countEl = this.querySelector('.skre-lb__rail-count');
    if (countEl) {
      const filledLayers = new Set(this.#cartLines.map(l => l.layerIndex)).size;
      countEl.textContent = `${filledLayers} / ${slots.length}`;
    }

    const subEl = this.querySelector('.skre-lb__rail-subtotal');
    if (subEl) subEl.textContent = this.#formatMoney(this.#subtotal);
    const totalEl = this.querySelector('.skre-lb__rail-total');
    if (totalEl) totalEl.textContent = this.#formatMoney(this.#subtotal);

    const savings = Math.max(0, this.#msrpTotal - this.#subtotal);
    const savRow = this.querySelector('.skre-lb__rail-savings-row');
    const savEl = this.querySelector('.skre-lb__rail-savings');
    if (savEl) savEl.textContent = '−' + this.#formatMoney(savings);
    if (savRow) savRow.hidden = savings <= 0;

    const checkoutBtn = this.querySelector('.skre-lb__rail-checkout');
    if (checkoutBtn) checkoutBtn.disabled = this.#cartLines.length === 0;

    // Promo badge: 3+ items = 10% off
    this.querySelectorAll('.skre-lb__promo').forEach(el => {
      const textEl = el.querySelector('.skre-lb__promo-text');
      const iconEl = el.querySelector('.skre-lb__promo-icon');
      if (!textEl) return;
      if (filledLayers >= 3) {
        el.classList.add('skre-lb__promo--unlocked');
        textEl.textContent = '10% discount unlocked — applied at checkout';
      } else {
        el.classList.remove('skre-lb__promo--unlocked');
        const needed = 3 - filledLayers;
        textEl.textContent = needed === 1
          ? 'Add 1 more item to save 10%'
          : `Add ${needed} more items · save 10%`;
      }
    });
  }

  // ── Summary panel ─────────────────────────────────────────────────────────

  #showSummary() {
    if (!this.#summaryPanel) return;
    this.#renderSummaryItems();
    this.#summaryPanel.hidden = false;
    requestAnimationFrame(() => this.#summaryPanel.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
  }

  #hideSummary() {
    if (!this.#summaryPanel) return;
    this.#summaryPanel.classList.remove('is-open');
    const speed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drawer-animation-speed') || '0.2') * 1000;
    setTimeout(() => { this.#summaryPanel.hidden = true; }, speed);
    document.body.style.overflow = '';
  }

  // ── Size chart ──────────────────────────────────────────────────────────────

  #openSizeChart() {
    if (!this.#scPanel || this.#scPanel.open) return;
    this.#scPanel.showModal();
  }

  async #closeSizeChart() {
    const d = this.#scPanel;
    if (!d?.open) return;
    d.style.animation = 'none';
    void d.offsetWidth;
    d.classList.add('dialog-closing');
    d.style.animation = '';
    await new Promise(resolve => d.addEventListener('animationend', resolve, { once: true }));
    d.close();
    d.classList.remove('dialog-closing');
  }

  #updateSizeChartTable(data) {
    const wrap = this.querySelector('.skre-lb__sc-table-wrap');
    const empty = this.querySelector('.skre-lb__sc-empty');
    const hasData = Array.isArray(data) && data.length > 0;
    if (empty) empty.hidden = hasData;
    if (!wrap) return;
    if (!hasData) { wrap.innerHTML = ''; return; }
    const headers = Object.keys(data[0]);
    wrap.innerHTML = `<table class="skre-lb__sc-table">
      <thead><tr>${headers.map(h => `<th>${this.#esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${data.map((row, i) =>
        `<tr${i % 2 === 0 ? ' class="skre-lb__sc-row--even"' : ''}>${
          headers.map(h => `<td>${this.#esc(String(row[h] ?? ''))}</td>`).join('')
        }</tr>`
      ).join('')}</tbody>
    </table>`;
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
        this.#renderTabs();
        this.#updateSkipLabel();
        this.#renderSummaryItems();
      }
    } catch (err) {
      console.error('[skre-layer-builder] Remove line failed', err);
    }
  }

  // ── Expand / Collapse info ───────────────────────────────────────────────

  #toggleExpand() {
    const isExpanded = this.#builder?.classList.contains('skre-lb__builder--info-expanded');
    const label = this.querySelector('.skre-lb__expand');
    if (isExpanded) {
      this.#collapseExpand(true);
    } else {
      /* Freeze media height before info leaves normal flow, preventing layout jump */
      const media = this.#builder?.querySelector('.skre-lb__media');
      if (media) {
        media.style.flex = 'none';
        media.style.height = media.offsetHeight + 'px';
      }
      this.#builder?.classList.add('skre-lb__builder--info-expanded');
      if (label) label.innerHTML = 'Collapse Info <span class="skre-lb__expand-caret" style="display:inline-block;transform:rotate(180deg)">&#8963;</span>';
    }
  }

  #collapseExpand(animated = false) {
    const label = this.querySelector('.skre-lb__expand');
    const media = this.#builder?.querySelector('.skre-lb__media');
    const resetLabel = () => {
      if (label) label.innerHTML = 'Expand Info <span class="skre-lb__expand-caret">&#8963;</span>';
    };
    const releaseMedia = () => {
      if (media) { media.style.flex = ''; media.style.height = ''; }
    };
    if (animated && this.#builder?.classList.contains('skre-lb__builder--info-expanded')) {
      this.#builder.classList.add('skre-lb__builder--info-collapsing');
      const speed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drawer-animation-speed') || '0.2') * 1000;
      setTimeout(() => {
        this.#builder?.classList.remove('skre-lb__builder--info-expanded', 'skre-lb__builder--info-collapsing');
        resetLabel();
        releaseMedia();
      }, speed);
    } else {
      this.#builder?.classList.remove('skre-lb__builder--info-expanded', 'skre-lb__builder--info-collapsing');
      resetLabel();
      releaseMedia();
    }
  }

  // ── Accordions ───────────────────────────────────────────────────────────

  #bindAccordions() {
    this.querySelectorAll('[data-accordion] .skre-lb__accordion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const accordion = btn.closest('[data-accordion]');
        const body = accordion.querySelector('.skre-lb__accordion-body');
        const isOpen = !body.hidden;
        if (isOpen) {
          this.#closeAccordion(accordion);
        } else {
          this.querySelectorAll('[data-accordion]').forEach(a => this.#closeAccordion(a));
          this.#openAccordion(accordion);
        }
      });
    });
  }

  #openAccordion(accordion) {
    const body = accordion.querySelector('.skre-lb__accordion-body');
    const icon = accordion.querySelector('.skre-lb__accordion-icon');
    if (body) body.hidden = false;
    if (icon) icon.textContent = '−';
    if (accordion.dataset.accordion === 'performance') {
      requestAnimationFrame(() => this.#triggerPerfGlitch());
    }
  }

  #closeAccordion(accordion) {
    const body = accordion.querySelector('.skre-lb__accordion-body');
    const icon = accordion.querySelector('.skre-lb__accordion-icon');
    if (body) body.hidden = true;
    if (icon) icon.textContent = '+';
  }

  // ── Expanded content rendering ───────────────────────────────────────────

  #renderExpandedContent(product) {
    // Overview text
    const overviewEl = this.querySelector('.skre-lb__overview-text');
    if (overviewEl) overviewEl.textContent = product.overview ?? product.preview_text ?? '';

    // Best used for — rendered inside PERFORMANCE accordion using exact perf-seasons__* classes
    const seasonsContainer = this.querySelector('.skre-lb__perf-seasons');
    if (seasonsContainer) {
      const items = Array.isArray(product.seasons) ? product.seasons : [];
      if (items.length) {
        seasonsContainer.innerHTML =
          `<div class="perf-seasons__label">Best season used for:</div>
          <div class="perf-seasons__items">
            ${items.map(item =>
              `<span class="perf-seasons__item">
                <svg class="perf-seasons__check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="16" height="16" rx="1" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M4 9.5l3 3L14 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${this.#esc(String(item).trim())}
              </span>`
            ).join('')}
          </div>`;
      } else {
        seasonsContainer.innerHTML = '';
      }
    }

    // Performance bars
    this.#renderPerfBars(product);

    // Specs: populate from recommended_use; hide if empty
    const specsAccordion = this.querySelector('[data-accordion="specs"]');
    const specsBody = specsAccordion?.querySelector('.skre-lb__accordion-body');
    const recommendedUse = product.product_specs ?? '';
    if (specsBody) specsBody.innerHTML = recommendedUse;
    const hasSpecs = !!recommendedUse.replace(/<[^>]*>/g, '').trim();
    if (specsAccordion) specsAccordion.hidden = !hasSpecs;

    // Overview: hide if no content
    const overviewAccordion = this.querySelector('[data-accordion="overview"]');
    const hasOverview = !!(product.overview ?? '').trim();
    if (overviewAccordion) overviewAccordion.hidden = !hasOverview;

    // Performance: hide if no seasons and no stat bars
    const perfAccordion = this.querySelector('[data-accordion="performance"]');
    const hasPerfData = (product.perf_stats?.length > 0) || (Array.isArray(product.seasons) && product.seasons.length > 0);
    if (perfAccordion) perfAccordion.hidden = !hasPerfData;

    // Open the first available accordion
    this.querySelectorAll('[data-accordion]').forEach(a => this.#closeAccordion(a));
    if (hasPerfData && perfAccordion) {
      this.#openAccordion(perfAccordion);
    } else if (hasOverview && overviewAccordion) {
      this.#openAccordion(overviewAccordion);
    } else if (recommendedUse && specsAccordion) {
      this.#openAccordion(specsAccordion);
    }
  }

  #renderPerfBars(product) {
    const container = this.querySelector('.skre-lb__perf-bars');
    if (!container) return;

    const stats = Array.isArray(product.perf_stats) ? product.perf_stats : [];
    if (!stats.length) { container.innerHTML = ''; return; }

    container.innerHTML = stats.map(stat => {
      const val = Math.min(10, Math.max(0, Number(stat.rating)));
      const segments = Array.from({ length: 10 }, (_, i) =>
        `<div class="perf-stat__seg${i < val ? ' perf-stat__seg--on' : ''}"></div>`
      ).join('');
      return `<div class="perf-stat">
        <div class="perf-stat__row">
          <span class="perf-stat__label">${this.#esc(String(stat.label).toUpperCase())}</span>
          <span class="perf-stat__score">${val}/10</span>
        </div>
        <div class="perf-stat__bar" role="img" aria-label="${this.#esc(String(stat.label))}: ${val} out of 10">
          ${segments}
        </div>
      </div>`;
    }).join('');
  }

  #triggerPerfGlitch() {
    this.querySelectorAll('.skre-lb__perf-bars .perf-stat').forEach((stat, si) => {
      stat.querySelectorAll('.perf-stat__seg--on').forEach((seg, sj) => {
        seg.style.setProperty('--pd', `${150 + si * 25 + sj * 65}ms`);
        seg.classList.remove('perf-seg--glitch');
        void seg.offsetWidth;
        seg.classList.add('perf-seg--glitch');
      });
    });
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
