// Preload swatch variant images before they're needed so hover swaps are instant.
// Runs when a product-card enters within 300px of the viewport, removes loading="lazy"
// from every variant-image slide's img so the browser starts fetching them.
(function () {
  if (!('IntersectionObserver' in window)) return;

  function preloadVariantImages(card) {
    card.querySelectorAll('[variant-image] img[loading="lazy"]').forEach(function (img) {
      img.removeAttribute('loading');
    });
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        preloadVariantImages(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '300px' }
  );

  function observeCards() {
    document.querySelectorAll('product-card').forEach(function (card) {
      observer.observe(card);
    });
  }

  // Also observe cards added to the DOM after initial load (filtered collections, etc.)
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (!(node instanceof Element)) return;
        if (node.tagName && node.tagName.toLowerCase() === 'product-card') {
          observer.observe(node);
        }
        node.querySelectorAll && node.querySelectorAll('product-card').forEach(function (card) {
          observer.observe(card);
        });
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeCards);
  } else {
    observeCards();
  }
})();

// Auto-select a default size variant on product pages when no variant is pre-selected via URL.
(function () {
  var defaultSize = document.body.dataset.defaultSize;
  if (!defaultSize) return;
  if (new URLSearchParams(window.location.search).has('variant')) return;

  function autoSelectDefaultSize() {
    document.querySelectorAll('variant-picker').forEach(function (picker) {
      picker.querySelectorAll('fieldset').forEach(function (fieldset) {
        var legend = fieldset.querySelector('legend');
        if (!legend) return;
        if (!legend.textContent.trim().toLowerCase().includes('size')) return;

        // Don't override if the user has already interacted
        if (fieldset.querySelector('input[type="radio"]:checked[data-current-checked="false"]')) return;

        var target = Array.from(fieldset.querySelectorAll('input[type="radio"]')).find(function (input) {
          return input.value.trim().toLowerCase() === defaultSize.trim().toLowerCase()
            && input.getAttribute('aria-disabled') !== 'true';
        });
        if (target && !target.checked) target.click();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoSelectDefaultSize);
  } else {
    autoSelectDefaultSize();
  }
})();
