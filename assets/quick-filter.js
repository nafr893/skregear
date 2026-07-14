/**
 * Quick Filter
 * Filters product grid items based on their data-filter-group attribute,
 * set server-side from the custom.filter_group metafield.
 *
 * When a filter is active the load-more element is hidden from the user and
 * auto-clicked in the background until every expected product for that group
 * is in the DOM. This avoids forcing the user to manually paginate through
 * unrelated products to find the rest of their filtered results.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container:    '.quick-filter',
    button:       '.quick-filter__button',
    productItem:  '.product-grid__item',
    grid:         '.product-grid',
    loadMore:     'skre-load-more',
    loadMoreBtn:  '.skre-lm__btn',
  };

  const CLASSES = {
    active: 'quick-filter__button--active',
    hidden: 'quick-filter-hidden',
  };

  let activeFilter        = 'all';
  let activeExpectedCount = 0;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let retryTimer = null;

  function init() {
    const container = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.container));
    if (!container) return;

    const buttons = /** @type {NodeListOf<HTMLElement>} */ (container.querySelectorAll(SELECTORS.button));
    if (!buttons.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((btn) => btn.classList.remove(CLASSES.active));
        button.classList.add(CLASSES.active);

        activeFilter        = (button.dataset.filter || 'all').trim();
        activeExpectedCount = parseInt(button.dataset.count || '0', 10);

        applyFilter(activeFilter);
        syncLoadMore();
      });
    });

    // Re-apply filter each time a new batch of products lands in the DOM
    const grid = document.querySelector(SELECTORS.grid);
    if (grid) {
      const observer = new MutationObserver(() => {
        if (activeFilter !== 'all') {
          applyFilter(activeFilter);
          autoLoadNextIfNeeded();
        }
      });
      observer.observe(grid, { childList: true });
    }
  }

  /** @param {string} filterValue */
  function applyFilter(filterValue) {
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(SELECTORS.productItem))
      .forEach((item) => {
        const group = (item.dataset.filterGroup || '').trim();
        if (filterValue === 'all' || group === filterValue) {
          item.classList.remove(CLASSES.hidden);
        } else {
          item.classList.add(CLASSES.hidden);
        }
      });
  }

  /** @param {string} filterValue @returns {number} */
  function countInDom(filterValue) {
    let n = 0;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(SELECTORS.productItem))
      .forEach((item) => {
        if ((item.dataset.filterGroup || '').trim() === filterValue) n++;
      });
    return n;
  }

  /**
   * Hide load-more while a filter is active (auto-loading handles pagination).
   * Restore it when "All" is selected.
   */
  function syncLoadMore() {
    const lm = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.loadMore));
    if (!lm) return;

    if (activeFilter === 'all') {
      lm.style.display = '';
    } else {
      lm.style.display = 'none';
      autoLoadNextIfNeeded();
    }
  }

  /**
   * If there are still unloaded products for the active filter, programmatically
   * trigger the load-more button. Retries until the button is ready or all
   * expected products are found.
   */
  function autoLoadNextIfNeeded() {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (activeFilter === 'all') return;

    const domCount = countInDom(activeFilter);
    if (domCount >= activeExpectedCount) return; // All accounted for

    const lm  = document.querySelector(SELECTORS.loadMore);
    const btn = /** @type {HTMLButtonElement|null} */ (lm && lm.querySelector(SELECTORS.loadMoreBtn));
    if (!btn) return; // No more pages left

    // Button may be temporarily disabled while a request is in flight — retry shortly
    if (btn.disabled || btn.getAttribute('aria-busy') === 'true') {
      retryTimer = setTimeout(autoLoadNextIfNeeded, 400);
      return;
    }

    btn.click(); // MutationObserver fires when items arrive → calls us again
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
