/**
 * Blog category filter row.
 * Reads data-blog-categories JSON from each .blog-post-item and shows/hides
 * articles based on the selected category button.
 *
 * When a specific category is active, adds .skre-blog-filter--filtered to the
 * grid container so CSS can force a uniform 3-column layout.
 */

(function () {
  'use strict';

  function init() {
    const nav = /** @type {HTMLElement|null} */ (document.querySelector('.skre-blog-filter'));
    if (!nav) return;

    const buttons = /** @type {NodeListOf<HTMLButtonElement>} */ (
      nav.querySelectorAll('.skre-blog-filter__btn')
    );
    if (!buttons.length) return;

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter || 'all';

        buttons.forEach((b) => {
          b.classList.remove('skre-blog-filter__btn--active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('skre-blog-filter__btn--active');
        btn.setAttribute('aria-pressed', 'true');

        filterPosts(filter);
      });
    });
  }

  /**
   * @param {string} filterValue
   */
  function filterPosts(filterValue) {
    const grid = /** @type {HTMLElement|null} */ (document.querySelector('.blog-posts-container'));
    const items = /** @type {NodeListOf<HTMLElement>} */ (
      document.querySelectorAll('.blog-post-item')
    );

    const isFiltered = filterValue !== 'all';
    if (grid) grid.classList.toggle('skre-blog-filter--filtered', isFiltered);

    items.forEach((item) => {
      if (!isFiltered) {
        item.classList.remove('skre-blog-filter--hidden');
        return;
      }

      let cats = /** @type {string[]} */ ([]);
      try {
        const parsed = JSON.parse(item.dataset.blogCategories || '[]');
        if (Array.isArray(parsed)) cats = parsed;
      } catch (_) {
        // article has no categories — keep hidden
      }

      if (cats.includes(filterValue)) {
        item.classList.remove('skre-blog-filter--hidden');
      } else {
        item.classList.add('skre-blog-filter--hidden');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
