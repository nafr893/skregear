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
