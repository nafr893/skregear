/**
 * Quick Filter
 *
 * When a specific filter is active, fetches every remaining page of the
 * collection directly (bypassing the load-more button entirely) so that
 * filtering always operates on the full collection, not just the products
 * already in the DOM.
 *
 * Pages are fetched in sequence; each batch is appended to the existing
 * product grid and filtered immediately as it arrives.  Once every expected
 * product is present the load-more element is hidden (user has nothing left
 * to page through for this filter group).  Switching back to "All" restores
 * normal load-more behaviour.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container:   '.quick-filter',
    button:      '.quick-filter__button',
    productItem: '.product-grid__item',
    grid:        '.product-grid',
    loadMore:    'skre-load-more',
  };

  const CLASSES = {
    active: 'quick-filter__button--active',
    hidden: 'quick-filter-hidden',
  };

  let activeFilter        = 'all';
  let activeExpectedCount = 0;

  /** Set to true while an async fetch-and-load cycle is running. */
  let loading = false;

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
        handleLoadMore();
      });
    });

    // Re-apply filter whenever the theme adds products to the grid
    // (e.g. infinite scroll or load-more web component firing after our applyFilter call).
    const grid = document.querySelector(SELECTORS.grid);
    if (grid) {
      new MutationObserver(() => {
        if (activeFilter !== 'all') applyFilter(activeFilter);
      }).observe(grid, { childList: true });
    }
  }

  // ─── filtering ──────────────────────────────────────────────────────────────

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

  // ─── pagination ─────────────────────────────────────────────────────────────

  /**
   * After a filter change, decide whether to fetch remaining pages or just
   * toggle load-more visibility.
   */
  function handleLoadMore() {
    const lm = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.loadMore));

    if (activeFilter === 'all') {
      if (lm) lm.style.display = '';
      return;
    }

    // If all expected products are already in the DOM, just hide load-more.
    if (countInDom(activeFilter) >= activeExpectedCount) {
      if (lm) lm.style.display = 'none';
      return;
    }

    // Some products are on later pages — fetch them now.
    if (lm) lm.style.display = 'none'; // hide while we auto-load
    fetchRemainingPages();
  }

  /**
   * Walk through every page of the collection (starting from page 2) and
   * append any product <li> elements that are not already in the DOM.
   * Stops early once all expected products for the active filter are present.
   */
  async function fetchRemainingPages() {
    if (loading) return;
    loading = true;

    const grid = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.grid));
    if (!grid) { loading = false; return; }

    // Total pages is stored on the grid by the Liquid template.
    const lastPage = parseInt(grid.dataset.lastPage || '1', 10);
    if (lastPage <= 1) { loading = false; restoreLoadMore(); return; }

    // Collect IDs already in the DOM so we never duplicate.
    /** @type {Set<string>} */
    const existing = new Set();
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(SELECTORS.productItem))
      .forEach((el) => { if (el.dataset.productId) existing.add(el.dataset.productId); });

    const capturedFilter = activeFilter; // snapshot — user may re-click mid-fetch

    for (let page = 2; page <= lastPage; page++) {
      // Abort if user changed the filter while we were fetching.
      if (activeFilter !== capturedFilter) break;

      const items = await fetchPageItems(page);
      if (!items || !items.length) break;

      items.forEach((item) => {
        const id = /** @type {HTMLElement} */ (item).dataset.productId;
        if (!id || existing.has(id)) return; // skip duplicates
        existing.add(id);
        // Pre-apply filter before inserting so the item is never briefly visible.
        const group = (item.dataset.filterGroup || '').trim();
        if (activeFilter !== 'all' && group !== activeFilter) {
          item.classList.add(CLASSES.hidden);
        }
        grid.appendChild(item);
      });

      // Full pass to catch anything the pre-filter missed.
      applyFilter(activeFilter);

      // Early-exit if we already have everything we need.
      if (countInDom(activeFilter) >= activeExpectedCount) break;
    }

    loading = false;

    // Final load-more decision.
    if (activeFilter === capturedFilter) {
      restoreLoadMore();
    }
  }

  /**
   * Fetch one page of the collection and return its product <li> elements.
   * @param {number} pageNum
   * @returns {Promise<HTMLElement[]>}
   */
  async function fetchPageItems(pageNum) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(pageNum));

      const response = await fetch(url.toString(), {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!response.ok) return [];

      const html = await response.text();
      const doc  = new DOMParser().parseFromString(html, 'text/html');

      const items = /** @type {NodeListOf<HTMLElement>} */ (doc.querySelectorAll(SELECTORS.productItem));
      const result = /** @type {HTMLElement[]} */ ([]);
      items.forEach((item) => result.push(item));
      return result;
    } catch (_) {
      return [];
    }
  }

  /**
   * After auto-loading completes, decide final load-more visibility.
   * Hide if all expected products are present; show otherwise.
   */
  function restoreLoadMore() {
    const lm = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.loadMore));
    if (!lm) return;

    if (activeFilter === 'all') {
      lm.style.display = '';
      return;
    }

    lm.style.display = countInDom(activeFilter) >= activeExpectedCount ? 'none' : '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
