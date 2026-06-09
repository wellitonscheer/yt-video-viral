// Cria/atualiza o badge sobre o container da thumbnail.
// ratio < threshold => remove badge se existir, sem injetar.

var YTVV = (typeof YTVV !== 'undefined') ? YTVV : {};

YTVV.formatRatio = function (ratio) {
  if (ratio >= 10) return Math.round(ratio) + 'x';
  return ratio.toFixed(1).replace('.', ',') + 'x';
};

YTVV.intensityClass = function (ratio) {
  if (ratio >= 5) return 'ytvv-badge--high';
  if (ratio >= 2) return 'ytvv-badge--mid';
  return 'ytvv-badge--low';
};

YTVV.applyBadge = function (thumbnailContainer, ratio) {
  if (!thumbnailContainer) return;

  var existing = thumbnailContainer.querySelector(':scope > .' + YTVV.CONSTANTS.BADGE_CLASS);

  if (ratio < YTVV.CONSTANTS.RATIO_THRESHOLD) {
    if (existing) existing.remove();
    return;
  }

  var text = '🔥 ' + YTVV.formatRatio(ratio);
  var cls = YTVV.CONSTANTS.BADGE_CLASS + ' ' + YTVV.intensityClass(ratio);

  if (existing) {
    existing.textContent = text;
    existing.className = cls;
    return;
  }

  // O badge é position:absolute; precisa de um ancestral posicionado. badge.css aplica
  // position:relative às âncoras conhecidas, mas se o YouTube vencer por especificidade ou se a
  // âncora escolhida não casar os seletores, garantimos aqui (idempotente) que o container ancora o badge.
  if (getComputedStyle(thumbnailContainer).position === 'static') {
    thumbnailContainer.style.position = 'relative';
  }

  var badge = document.createElement('div');
  badge.className = cls;
  badge.textContent = text;
  thumbnailContainer.appendChild(badge);
};
