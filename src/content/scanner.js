// Extração baseada em CONTEÚDO (não nomes de classe), resistente a redesigns do YouTube.
// - videoAnchor: primeiro <a href*="/watch"> dentro do card.
// - channelAnchor: primeiro <a> com href começando por /@ /channel/ /user/ /c/, que NÃO seja
//   descendente do videoAnchor.
// - viewsText: primeiro elemento "folha" cujo texto casa o padrão de views (pt-BR ou en).
// - thumbnailContainer: o próprio videoAnchor (CSS força position relativa).

var YTVV = (typeof YTVV !== 'undefined') ? YTVV : {};

YTVV.matchContext = function (cardEl) {
  var tag = cardEl.tagName.toLowerCase();
  // yt-lockup-view-model é tanto raiz (sidebar) quanto aninhado em
  // ytd-rich-item-renderer (home) / ytd-video-renderer (busca). Quando
  // aninhado, ignoramos: o wrapper já vai disparar processCard.
  if (tag === 'yt-lockup-view-model') {
    if (cardEl.closest('ytd-rich-item-renderer, ytd-video-renderer')) return null;
    return 'sidebar';
  }
  for (var name in YTVV.SELECTORS) {
    if (YTVV.SELECTORS[name].card === tag) return name;
  }
  return null;
};

// YTVV._missLogs = { home: 0, sidebar: 0, search: 0 };
//
// YTVV._logMiss = function (contextName, reason, cardEl) {
//   if (YTVV._missLogs[contextName] === undefined) YTVV._missLogs[contextName] = 0;
//   if (YTVV._missLogs[contextName] >= 3) return;
//   YTVV._missLogs[contextName]++;
//
//   var prefix = YTVV.CONSTANTS.LOG_PREFIX;
//   console.log(prefix, 'extractCard miss em', contextName + ':', reason);
//   if (cardEl && cardEl.outerHTML) {
//     console.log(prefix, 'outerHTML[0..300]:', cardEl.outerHTML.slice(0, 300));
//   }
// };

YTVV._VIEWS_PATTERN = /\b\d[\d.,]*\s*(?:mil|mi|bi|milhões|milhão|K|M|B)?\s*(?:de\s+)?(?:views|visualizações)\b/i;

YTVV.extractCard = function (cardEl) {
  var contextName = YTVV.matchContext(cardEl);
  if (!contextName) return null;

  // videoAnchor — qualquer <a> apontando para /watch
  var videoAnchor = cardEl.querySelector('a[href*="/watch"]');
  if (!videoAnchor) return null; // shorts, canal, playlist puro — ignora silenciosamente
  var videoHref = videoAnchor.href || videoAnchor.getAttribute('href');

  // channelAnchor — prefixo de canal, descartando aninhados ao videoAnchor.
  // Pode não existir (sidebar do watch usa só <div role="button"> + span);
  // nesse caso o background resolve via oEmbed a partir do videoHref.
  var channelAnchor = null;
  var candidates = cardEl.querySelectorAll(
    'a[href^="/@"], a[href^="/channel/"], a[href^="/user/"], a[href^="/c/"]'
  );
  for (var i = 0; i < candidates.length; i++) {
    if (videoAnchor.contains(candidates[i])) continue;
    channelAnchor = candidates[i];
    break;
  }
  var channelHref = channelAnchor ? (channelAnchor.href || channelAnchor.getAttribute('href')) : null;

  // viewsText — TreeWalker, primeiro nó-folha (ou quase) cujo texto bate o padrão
  var viewsText = null;
  var walker = document.createTreeWalker(cardEl, NodeFilter.SHOW_ELEMENT, null);
  var node;
  while ((node = walker.nextNode())) {
    if (node.children.length > 3) continue;
    var t = (node.textContent || '').trim();
    if (!t || t.length > 80) continue;
    if (YTVV._VIEWS_PATTERN.test(t)) {
      viewsText = t;
      break;
    }
  }
  if (!viewsText) {
    // YTVV._logMiss(contextName, 'viewsEl não encontrado (busca por texto)', cardEl);
    return null;
  }

  return {
    context: contextName,
    videoHref: videoHref,
    channelHref: channelHref,
    viewsText: viewsText,
    thumbnailContainer: videoAnchor
  };
};

// Inspetor manual: __YTVV_INSPECT() ou __YTVV_INSPECT('ytd-compact-video-renderer')
// window.__YTVV_INSPECT = function (cardSelector) {
//   cardSelector = cardSelector || 'ytd-rich-item-renderer';
//   var cardEl = document.querySelector(cardSelector);
//   if (!cardEl) {
//     console.log('[YTVV/inspect] nenhum card para', cardSelector);
//     return null;
//   }
//
//   var videoAnchor = cardEl.querySelector('a[href*="/watch"]');
//   var channelAnchors = Array.from(cardEl.querySelectorAll(
//     'a[href^="/@"], a[href^="/channel/"], a[href^="/user/"], a[href^="/c/"]'
//   ));
//   var data = YTVV.extractCard(cardEl);
//
//   console.table([
//     { campo: 'videoAnchor',                    ok: !!videoAnchor,                       valor: videoAnchor ? videoAnchor.href : '—' },
//     { campo: 'channelAnchors (total)',         ok: channelAnchors.length > 0,           valor: channelAnchors.length },
//     { campo: 'channelAnchor (selecionado)',    ok: !!(data && data.channelHref),        valor: data ? data.channelHref : '—' },
//     { campo: 'viewsText',                      ok: !!(data && data.viewsText),          valor: data ? data.viewsText : '—' },
//     { campo: 'extract() resultado',            ok: !!data,                              valor: data ? 'OK' : 'null' }
//   ]);
//   return data;
// };
