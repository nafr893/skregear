/**
 * Quick Filter
 * Filters product grid items based on their data-filter-group attribute,
 * which is set server-side from the custom.filter_group metafield.
 *
 * Load-more visibility: when a specific filter is active, the load-more
 * button is hidden once all expected products for that group are in the DOM,
 * and shown while there are still unloaded products remaining.
 *
 * A MutationObserver re-applies the active filter and re-evaluates load-more
 * visibility whenever infinite scroll / load-more appends new products.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container: '.quick-filter',
    button: '.quick-filter__button',
    productItem: '.product-grid__item',
    grid: '.product-grid',
    loadMore: 'skre-load-more',
  };

  const CLASSES = {
    active: 'quick-filter__button--active',
    hidden: 'quick-filter-hidden',
  };

  /** @type {string} */
  let activeFilter = 'all';

  /** @type {number} */
  let activeExpectedCount = 0;

  function init() {
    const container = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.container));
    if (!container) return;

    const buttons = /** @type {NodeListOf<HTMLElement>} */ (container.querySelectorAll(SELECTORS.button));
    if (!buttons.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((btn) => btn.classList.remove(CLASSES.active));
        button.classList.add(CLASSES.active);
        activeFilter = (button.dataset.filter || 'all').trim();
        activeExpectedCount = parseInt(button.dataset.count || '0', 10);
        applyFilter(activeFilter);
        updateLoadMore();
      });
    });

    // Re-apply filter and re-check load-more when new products arrive in the DOM
    const grid = document.querySelector(SELECTORS.grid);
    if (grid) {
      const observer = new MutationObserver(() => {
        if (activeFilter !== 'all') {
          applyFilter(activeFilter);
          updateLoadMore();
        }
      });
      observer.observe(grid, { childList: true });
    }
  }

  /**
   * Show/hide every product item based on the active filter.
   * @param {string} filterValue
   */
  function applyFilter(filterValue) {
    const productItems = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(SELECTORS.productItem));
    productItems.forEach((item) => {
      const group = (item.dataset.filterGroup || '').trim();
      if (filterValue === 'all' || group === filterValue) {
        item.classList.remove(CLASSES.hidden);
      } else {
        item.classList.add(CLASSES.hidden);
      }
    });
  }

  /**
   * Count how many product items in the DOM match the active filter.
   * @param {string} filterValue
   * @returns {number}
   */
  function countInDom(filterValue) {
    let n = 0;
    /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(SELECTORS.productItem)).forEach((item) => {
      if ((item.dataset.filterGroup || '').trim() === filterValue) n++;
    });
    return n;
  }

  /**
   * Show or hide the load-more element based on whether all expected
   * products for the active filter are already in the DOM.
   */
  function updateLoadMore() {
    const lm = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.loadMore));
    if (!lm) return;

    if (activeFilter === 'all') {
      lm.style.display = '';
      return;
    }

    // Hide load-more only once every expected product is in the DOM.
    // While some are still on unloaded pages, keep the button visible
    // so the user can load more and see the rest of their filtered results.
    const domCount = countInDom(activeFilter);
    lm.style.display = domCount >= activeExpectedCount ? 'none' : '';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
