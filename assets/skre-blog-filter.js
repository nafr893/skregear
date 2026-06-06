/**
 * Blog category filter row.
 *
 * Category buttons are built from the data-blog-categories attributes on the
 * rendered .blog-post-item elements rather than from server-side Liquid. This
 * keeps the filter in sync with whatever is actually in the DOM, so stale
 * Shopify page caches or pagination differences never produce mismatched buttons.
 *
 * Flow:
 *  1. Scan .blog-post-item[data-blog-categories] to collect unique categories.
 *  2. Inject <li><button> elements into the existing nav list.
 *  3. Show the nav (it ships with hidden so there's no flash of an empty bar).
 *  4. Wire click handlers for show/hide + 3-column grid toggle.
 */

(function () {
  'use strict';

  function init() {
    const nav = /** @type {HTMLElement|null} */ (document.querySelector('.skre-blog-filter'));
    if (!nav) return;

    const list = /** @type {HTMLElement|null} */ (nav.querySelector('.skre-blog-filter__list'));
    if (!list) return;

    const items = /** @type {NodeListOf<HTMLElement>} */ (
      document.querySelectorAll('.blog-post-item')
    );

    // Collect unique categories in DOM order
    const seen = /** @type {Set<string>} */ (new Set());
    items.forEach((item) => {
      let cats = /** @type {string[]} */ ([]);
      try {
        const parsed = JSON.parse(item.dataset.blogCategories || '[]');
        if (Array.isArray(parsed)) cats = parsed;
      } catch (_) {}
      cats.forEach((c) => { if (c) seen.add(c); });
    });

    // Nothing to filter — leave the nav hidden
    if (seen.size === 0) return;

    // Inject category buttons
    seen.forEach((cat) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skre-blog-filter__btn';
      btn.dataset.filter = cat;
      btn.setAttribute('aria-pressed', 'false');
      btn.textContent = cat;
      li.appendChild(btn);
      list.appendChild(li);
    });

    // Show the nav now that buttons are ready
    nav.removeAttribute('hidden');

    // Wire all buttons (including the "All" button already in the DOM)
    const buttons = /** @type {NodeListOf<HTMLButtonElement>} */ (
      nav.querySelectorAll('.skre-blog-filter__btn')
    );

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
      } catch (_) {}

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
