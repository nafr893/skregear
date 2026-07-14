/**
 * Quick Filter
 *
 * When a specific filter is active:
 *  - Hides non-matching products in the DOM.
 *  - Auto-loads pages in the background until every expected product for
 *    that filter group is in the DOM (avoids the user needing to manually
 *    click "load more" to reveal filtered results on later pages).
 *  - Hides the load-more element once all expected products are present;
 *    keeps it visible (and keeps auto-loading) while there are still
 *    unloaded products remaining for that group.
 *
 * When "All" is selected the load-more element is restored to its
 * natural state and no auto-loading runs.
 */

(function () {
  'use strict';

  const SELECTORS = {
    container:   '.quick-filter',
    button:      '.quick-filter__button',
    productItem: '.product-grid__item',
    grid:        '.product-grid',
    loadMore:    'skre-load-more',
    loadMoreBtn: '.skre-lm__btn',
  };

  const CLASSES = {
    active: 'quick-filter__button--active',
    hidden: 'quick-filter-hidden',
  };

  let activeFilter        = 'all';
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

        activeFilter        = (button.dataset.filter || 'all').trim();
        activeExpectedCount = parseInt(button.dataset.count || '0', 10);

        applyFilter(activeFilter);
        updateLoadMore();
      });
    });

    // Each time new products are appended re-apply the filter and
    // re-evaluate whether more pages need loading.
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
   * Decide whether to show or hide the load-more element, and if products
   * are still missing for the active filter, trigger the next page load.
   */
  function updateLoadMore() {
    const lm  = /** @type {HTMLElement|null} */ (document.querySelector(SELECTORS.loadMore));
    if (!lm) return;

    if (activeFilter === 'all') {
      lm.style.display = '';   // restore normal behaviour
      return;
    }

    const domCount = countInDom(activeFilter);
    const allFound = domCount >= activeExpectedCount;

    // Hide load-more once every expected product is present
    lm.style.display = allFound ? 'none' : '';

    if (!allFound) {
      // Trigger the next page load — keep lm VISIBLE so the button
      // click is guaranteed to fire in all browsers/custom-element
      // implementations.
      triggerNextPage(lm);
    }
  }

  /**
   * Click the load-more button to fetch the next page.
   * If the button is currently disabled (a request is already in flight),
   * wait for it to re-enable using a MutationObserver then retry.
   * @param {HTMLElement} lm
   */
  function triggerNextPage(lm) {
    const btn = /** @type {HTMLButtonElement|null} */ (lm.querySelector(SELECTORS.loadMoreBtn));
    if (!btn) return; // No more pages

    if (btn.disabled) {
      // A fetch is in flight — observe the button's disabled attribute and
      // retry as soon as it clears.
      const watcher = new MutationObserver(() => {
        if (!btn.disabled) {
          watcher.disconnect();
          // Re-check count in case the in-flight load already satisfied it
          if (countInDom(activeFilter) < activeExpectedCount) {
            triggerNextPage(lm);
          }
        }
      });
      watcher.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
      return;
    }

    btn.click();
    // The grid MutationObserver fires when new <li> elements arrive →
    // calls updateLoadMore → repeats until allFound.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
