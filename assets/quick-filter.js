/**
 * Quick Filter
 * Filters product grid items based on their data-filter-group attribute,
 * which is set server-side from the custom.filter_group metafield.
 * Also syncs the skre-load-more component so its count and button reflect
 * the filtered set rather than the whole collection.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container: '.quick-filter',
    button: '.quick-filter__button',
    productItem: '.product-grid__item',
  };

  const CLASSES = {
    active: 'quick-filter__button--active',
    hidden: 'quick-filter-hidden',
  };

  function init() {
    const container = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.container));
    if (!container) return;

    const buttons = /** @type {NodeListOf<HTMLElement>} */ (container.querySelectorAll(SELECTORS.button));
    if (!buttons.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        handleFilterClick(button, buttons);
      });
    });
  }

  /**
   * @param {HTMLElement} clickedButton
   * @param {NodeListOf<HTMLElement>} allButtons
   */
  function handleFilterClick(clickedButton, allButtons) {
    allButtons.forEach((btn) => btn.classList.remove(CLASSES.active));
    clickedButton.classList.add(CLASSES.active);

    const filterValue = clickedButton.dataset.filter || 'all';
    const productItems = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(SELECTORS.productItem));

    productItems.forEach((item) => {
      const group = item.dataset.filterGroup || '';
      if (filterValue === 'all' || group === filterValue) {
        item.classList.remove(CLASSES.hidden);
      } else {
        item.classList.add(CLASSES.hidden);
      }
    });

    syncLoadMore(filterValue);
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

    // Save the original state once, before any filter is applied
    if (!lm.dataset.savedLabel && label) {
      lm.dataset.savedLabel = label.innerHTML;
      lm.dataset.savedPctD  = (fillD ? fillD.style.width : '').replace('%', '') || lm.dataset.pctDesk || '0';
      lm.dataset.savedPctM  = (fillM ? fillM.style.width : '').replace('%', '') || lm.dataset.pctMob  || '0';
    }

    // Filter active — all matched products are already in the DOM, nothing more to load
    lm.style.display = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
