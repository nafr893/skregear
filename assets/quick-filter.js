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
        allButtons.forEach((btn) => btn.classList.remove(CLASSES.active));
        button.classList.add(CLASSES.active);
        activeFilter = button.dataset.filter || 'all';
        applyFilter(activeFilter);
        syncLoadMore(activeFilter);
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

    // Keep a reference so the click handler above can access buttons
    var allButtons = buttons;
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
   * @param {string} filterValue
   */
  function syncLoadMore(filterValue) {
    const lm = /** @type {HTMLElement|null} */ (document.querySelector('skre-load-more'));
    if (!lm) return;

    const btn   = /** @type {HTMLElement|null} */ (lm.querySelector('.skre-lm__btn'));
    const label = /** @type {HTMLElement|null} */ (lm.querySelector('.skre-lm__label'));
    const fillD = /** @type {HTMLElement|null} */ (lm.querySelector('.skre-lm__fill--desk'));
    const fillM = /** @type {HTMLElement|null} */ (lm.querySelector('.skre-lm__fill--mob'));

    if (filterValue === 'all') {
      lm.style.display = '';
      if (lm.dataset.savedLabel && label) label.innerHTML = lm.dataset.savedLabel;
      if (fillD) fillD.style.width = (lm.dataset.savedPctD || lm.dataset.pctDesk || '0') + '%';
      if (fillM) fillM.style.width = (lm.dataset.savedPctM || lm.dataset.pctMob  || '0') + '%';
      if (btn)   btn.style.display = '';
      return;
    }

    if (!lm.dataset.savedLabel && label) {
      lm.dataset.savedLabel = label.innerHTML;
      lm.dataset.savedPctD  = (fillD ? fillD.style.width : '').replace('%', '') || lm.dataset.pctDesk || '0';
      lm.dataset.savedPctM  = (fillM ? fillM.style.width : '').replace('%', '') || lm.dataset.pctMob  || '0';
    }

    lm.style.display = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
