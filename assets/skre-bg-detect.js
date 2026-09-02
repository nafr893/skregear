(function () {
  var THRESHOLD = 230; // min RGB value to count as near-white
  var SAMPLE_SIZE = 3; // px to average at each corner

  function cornerIsWhite(ctx, x, y, w, h) {
    try {
      var data = ctx.getImageData(x, y, w, h).data;
      var total = data.length / 4;
      var whites = 0;
      for (var i = 0; i < data.length; i += 4) {
        if (data[i] >= THRESHOLD && data[i + 1] >= THRESHOLD && data[i + 2] >= THRESHOLD) whites++;
      }
      return whites / total >= 0.8;
    } catch (e) {
      return false;
    }
  }

  function checkTiny(tiny, container) {
    var canvas = document.createElement('canvas');
    var w = tiny.naturalWidth;
    var h = tiny.naturalHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(tiny, 0, 0);
    } catch (e) {
      return; // tainted canvas — skip
    }
    var s = Math.min(SAMPLE_SIZE, w, h);
    var allWhite =
      cornerIsWhite(ctx, 0, 0, s, s) &&
      cornerIsWhite(ctx, w - s, 0, s, s) &&
      cornerIsWhite(ctx, 0, h - s, s, s) &&
      cornerIsWhite(ctx, w - s, h - s, s, s);

    if (allWhite) container.classList.add('skre-bg-white');
  }

  function detect() {
    document.querySelectorAll('.product-media__image[data-bg-src]').forEach(function (img) {
      var container = img.closest('.product-media-container');
      if (!container || container.dataset.bgChecked) return;
      container.dataset.bgChecked = '1';

      var tiny = new Image();
      tiny.crossOrigin = 'anonymous';
      tiny.onload = function () { checkTiny(tiny, container); };
      tiny.src = img.dataset.bgSrc;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detect);
  } else {
    detect();
  }

  // Re-run when variant changes swap the gallery
  document.addEventListener('variant:update', function () { setTimeout(detect, 50); });
})();
