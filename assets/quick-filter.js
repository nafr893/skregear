/**
 * Quick Filter
 * Filters product grid items based on their data-filter-group attribute,
 * which is set server-side from the custom.filter_group metafield.
 * A MutationObserver re-applies the active filter whenever infinite scroll
 * appends new products to the grid.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container: '.quick-filter',
    button: '.quick-filter__button',
    productItem: '.product-grid__item',
    grid: '.product-grid',
  };

  const CLASSES = {
    active: 'quick-filter__button--active',
    hidden: 'quick-filter-hidden',
  };

  /** @type {string} */
  let activeFilter = 'all';

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
        applyFilter(activeFilter);
      });
    });

    // Re-apply the active filter whenever infinite scroll adds new products
    const grid = document.querySelector(SELECTORS.grid);
    if (grid) {
      const observer = new MutationObserver(() => {
        if (activeFilter !== 'all') applyFilter(activeFilter);
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

  // syncLoadMore intentionally omitted: hiding the load-more/infinite-scroll
  // trigger when a filter is active prevents later pages from loading, so
  // filtered products that live on page 2+ never appear. Pagination runs
  // normally; the MutationObserver above filters each batch as it arrives.

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
