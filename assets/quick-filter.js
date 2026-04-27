/**
 * Quick Filter
 * Filters product grid items based on custom.filter_group metafield values.
 * Also syncs the skre-load-more component so its count and button reflect
 * the filtered set rather than the whole collection.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container: '.quick-filter',
    button: '.quick-filter__button',
    jsonMap: '#quick-filter-map',
    productItem: '.product-grid__item',
  };

  const CLASSES = {
    active: 'quick-filter__button--active',
    hidden: 'quick-filter-hidden',
  };

  function init() {
    const container = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.container));
    if (!container) return;

    const mapElement = document.querySelector(SELECTORS.jsonMap);
    if (!mapElement) return;

    /** @type {Record<string,string>} */
    let productFilterMap;
    try {
      productFilterMap = JSON.parse(mapElement.textContent || '{}');
    } catch (e) {
      console.error('Quick Filter: Failed to parse product filter map', e);
      return;
    }

    const buttons = /** @type {NodeListOf<HTMLElement>} */ (container.querySelectorAll(SELECTORS.button));
    if (!buttons.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        handleFilterClick(button, buttons, productFilterMap);
      });
    });
  }

  /**
   * @param {HTMLElement} clickedButton
   * @param {NodeListOf<HTMLElement>} allButtons
   * @param {Record<string,string>} productFilterMap
   */
  function handleFilterClick(clickedButton, allButtons, productFilterMap) {
    allButtons.forEach((btn) => btn.classList.remove(CLASSES.active));
    clickedButton.classList.add(CLASSES.active);

    const filterValue = clickedButton.dataset.filter || 'all';
    const productItems = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(SELECTORS.productItem));

    productItems.forEach((item) => {
      const productFilterGroup = productFilterMap[item.dataset.productId || ''];
      if (filterValue === 'all' || productFilterGroup === filterValue) {
        item.classList.remove(CLASSES.hidden);
      } else {
        item.classList.add(CLASSES.hidden);
      }
    });

    syncLoadMore(filterValue, productFilterMap);
  }

  /**
   * @param {string} filterValue
   * @param {Record<string,string>} productFilterMap
   */
  function syncLoadMore(filterValue, productFilterMap) {
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

    // Count products in the current DOM that match this filter
    const items = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(SELECTORS.productItem));
    let n = 0;
    items.forEach((item) => {
      if (productFilterMap[item.dataset.productId || ''] === filterValue) n++;
    });

    // Filter active — all matched products are already in the DOM, nothing more to load
    lm.style.display = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
