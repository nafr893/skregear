(function () {
  var ALPHA_THRESHOLD = 240; // corner pixel alpha below this = transparent background

  function cornersAreTransparent(ctx, w, h) {
    try {
      var s = Math.min(3, w, h);
      var corners = [
        ctx.getImageData(0, 0, s, s),
        ctx.getImageData(w - s, 0, s, s),
        ctx.getImageData(0, h - s, s, s),
        ctx.getImageData(w - s, h - s, s, s),
      ];
      for (var c = 0; c < corners.length; c++) {
        var d = corners[c].data;
        for (var i = 3; i < d.length; i += 4) {
          if (d[i] < ALPHA_THRESHOLD) return true;
        }
      }
    } catch (e) { /* tainted canvas — skip */ }
    return false;
  }

  function check(tiny, container) {
    var w = tiny.naturalWidth;
    var h = tiny.naturalHeight;
    if (!w || !h) return;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    try { ctx.drawImage(tiny, 0, 0); } catch (e) { return; }
    if (cornersAreTransparent(ctx, w, h)) {
      container.classList.add('skre-transparent-bg');
    }
  }

  function detect() {
    document.querySelectorAll('.product-media__image[data-bg-src]').forEach(function (img) {
      var container = img.closest('.product-media-container');
      if (!container || container.dataset.bgChecked) return;
      container.dataset.bgChecked = '1';
      var tiny = new Image();
      tiny.crossOrigin = 'anonymous';
      tiny.onload = function () { check(tiny, container); };
      tiny.src = img.dataset.bgSrc;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detect);
  } else {
    detect();
  }
  document.addEventListener('variant:update', function () {
    setTimeout(detect, 50);
  });
})();
