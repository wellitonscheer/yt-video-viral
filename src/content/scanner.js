// Extração baseada em CONTEÚDO (não nomes de classe), resistente a redesigns do YouTube.
// - videoAnchor: primeiro <a href*="/watch"> dentro do card.
// - channelAnchor: primeiro <a> com href começando por /@ /channel/ /user/ /c/, que NÃO seja
//   descendente do videoAnchor.
// - viewsText: primeiro elemento "folha" cujo texto casa o padrão de views (pt-BR ou en).
// - thumbnailContainer: o próprio videoAnchor (CSS força position relativa).

var YTVV = (typeof YTVV !== 'undefined') ? YTVV : {};

YTVV.matchContext = function (cardEl) {
  var tag = cardEl.tagName.toLowerCase();
  // yt-lockup-view-model é tanto raiz (sidebar, playlists, canal) quanto aninhado em
  // ytd-rich-item-renderer (home) / ytd-video-renderer (busca) / outros wrappers. Quando
  // aninhado, ignoramos: o wrapper já vai disparar processCard.
  if (tag === 'yt-lockup-view-model') {
    if (cardEl.parentElement && cardEl.parentElement.closest(YTVV.WRAPPER_SELECTORS_JOINED)) return null;
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

// Aceita plural e singular em ambos idiomas: "1.2M views" / "1 view" / "523 mil visualizações" / "1 visualização".
YTVV._VIEWS_PATTERN = /\b\d[\d.,]*\s*(?:thousand|million|billion|trillion|mil|mi|bi|milhões|milhão|K|M|B)?\s*(?:de\s+)?(?:views?|visualizaç(?:ões|ão))\b/i;

// Layout compacto (ex.: aba Vídeos de um canal) mostra só "548" na tela, mas o <span> carrega
// aria-label="548 visualizações" / "548 views". Ancorado no label INTEIRO (^...$) para não pegar
// aria-labels de título/thumbnail que apenas contêm a palavra (ex.: "Top 10 gols 548 visualizações").
YTVV._VIEWS_LABEL_PATTERN = /^\s*\d[\d.,]*\s*(?:thousand|million|billion|trillion|milhões|milhão|mil|mi|bi|K|M|B)?\s*(?:de\s+)?(?:views?|visualizaç(?:ões|ão))\s*$/i;

// Layout compacto do YouTube atual omite a palavra "views/visualizações" e mostra só a contagem
// ("70 mi • há 10 dias"). Para o fallback (vide extractCard), reconhecemos uma contagem PURA (texto
// inteiro = número+sufixo, com sufixo ou separador, p/ rejeitar inteiros soltos) e uma DATA relativa
// (pt/en) que confirma que a contagem está numa linha de metadados de vídeo, não um número avulso.
YTVV._BARE_COUNT_PATTERN = /^(\d[\d.,]*)\s*(thousand|million|billion|trillion|mil|mi|bi|milhões|milhão|K|M|B)?$/i;
YTVV._DATE_HINT_PATTERN = /(^|\s)há\s|\bago\b|atrás|transmitido|streamed|\b\d+\s*(?:dias?|semanas?|sem\.|meses|m[êe]s|anos?|horas?|minutos?|days?|weeks?|months?|years?|hours?|minutes?)\b/i;

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
  // aria-label (aditivo — só roda se o texto visível não trouxe a palavra): cobre contagens < 1000 do
  // layout compacto, que aparecem como inteiro puro ("548") e o fallback abaixo rejeita de propósito.
  if (!viewsText) {
    var labeled = cardEl.querySelectorAll('[aria-label]');
    for (var li = 0; li < labeled.length; li++) {
      var label = labeled[li].getAttribute('aria-label');
      if (label && label.length <= 40 && YTVV._VIEWS_LABEL_PATTERN.test(label)) {
        viewsText = label.trim();
        break;
      }
    }
  }
  // Fallback (aditivo — só roda se o caminho ancorado na palavra falhou): YouTube atual às vezes
  // mostra a contagem SEM "views/visualizações" (ex.: "70 mi • há 10 dias"). Procuramos uma folha cujo
  // texto INTEIRO seja uma contagem pura (com sufixo OU separador) e que esteja ao lado de uma data
  // relativa (ancestral curto com marcador de data), confirmando que é a linha de metadados do vídeo.
  if (!viewsText) {
    var w2 = document.createTreeWalker(cardEl, NodeFilter.SHOW_ELEMENT, null);
    var leaf;
    while ((leaf = w2.nextNode())) {
      if (leaf.children.length > 0) continue; // só folhas reais
      var lt = (leaf.textContent || '').trim();
      if (!lt || lt.length > 24) continue;
      var bm = lt.match(YTVV._BARE_COUNT_PATTERN);
      if (!bm) continue;
      var hasSuffix = !!bm[2];
      var hasSep = /[.,]/.test(bm[1]);
      if (!hasSuffix && !hasSep) continue; // rejeita inteiros soltos curtos (ex.: "10" de uma data)
      // confirma contexto de metadados: algum ancestral curto contém marcador de data relativa
      var anc = leaf.parentElement;
      var hops = 0;
      while (anc && hops < 4) {
        var at = (anc.textContent || '').trim();
        if (at.length <= 60 && YTVV._DATE_HINT_PATTERN.test(at)) { viewsText = lt; break; }
        anc = anc.parentElement;
        hops++;
      }
      if (viewsText) break;
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
