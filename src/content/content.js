// Entry point do content script. Observa o DOM, processa cards perto da tela, dispara badges.
//
// O YouTube RECICLA elementos de card: ao trocar a ordenação (ex.: "Em alta" na aba Vídeos), refazer
// uma busca ou navegar watch → watch, o mesmo <ytd-rich-item-renderer>/<yt-lockup-view-model> passa a
// mostrar outro vídeo. Por isso o atributo de processado guarda o ID DO VÍDEO (não "1"): se o card
// agora mostra outro vídeo, o badge antigo sai e o card é processado de novo.

// console.log('[YTVV] content.js carregado — URL:', location.href);

(function () {
  var C = YTVV.CONSTANTS;
  var log = function () {
    if (!C.DEBUG) return;
    var args = [C.LOG_PREFIX].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  };
  var warn = function () {
    var args = [C.LOG_PREFIX].concat(Array.prototype.slice.call(arguments));
    console.warn.apply(console, args);
  };

  var SCAN_THROTTLE_MS = 200;
  // Pede dados só para cards até ~1 tela acima/abaixo da área visível. Cards em páginas ocultas do SPA
  // (display:none) nunca intersectam, então não geram request.
  var VIEWPORT_MARGIN = '800px 0px';
  // Abas de um canal que só listam uploads do próprio canal. Nelas os cards não têm âncora de canal;
  // em vez de 1 oEmbed por vídeo, usamos o canal da página. A aba Início NÃO entra: mistura
  // prateleiras com vídeos de outros canais.
  var CHANNEL_UPLOADS_PATH = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/(?:videos|streams)(?:\/|$)/;

  var inFlight = new WeakMap();   // card -> videoId com request pendente
  var nearViewport = new WeakSet();
  var observed = new Set();       // cards no IntersectionObserver (p/ unobserve dos desconectados)
  var stats = { seen: 0, extracted: 0, sent: 0, replied: 0, badged: 0, errors: 0 };
  // window.__YTVV_STATS = stats;

  function currentVideoId(cardEl) {
    var a = cardEl.querySelector('a[href*="/watch"]');
    if (!a) return null;
    var href = a.getAttribute('href') || '';
    try {
      return new URL(href, location.origin).searchParams.get('v') || href;
    } catch (e) {
      return href;
    }
  }

  function removeBadges(cardEl) {
    var old = cardEl.querySelectorAll('.' + C.BADGE_CLASS);
    for (var i = 0; i < old.length; i++) old[i].remove();
  }

  function pageChannelHref(cardEl) {
    var m = location.pathname.match(CHANNEL_UPLOADS_PATH);
    if (!m) return null;
    var browse = cardEl.closest('ytd-browse');
    if (!browse || browse.hasAttribute('hidden') || browse.getAttribute('page-subtype') !== 'channels') return null;
    return '/' + m[1];
  }

  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.isIntersecting) {
        nearViewport.add(e.target);
        processCard(e.target);
      } else {
        nearViewport.delete(e.target);
      }
    }
  }, { rootMargin: VIEWPORT_MARGIN });

  function watch(cardEl) {
    if (observed.has(cardEl)) return;
    observed.add(cardEl);
    io.observe(cardEl);
  }

  function unwatch(cardEl) {
    if (!observed.has(cardEl)) return;
    observed.delete(cardEl);
    io.unobserve(cardEl);
  }

  function processCard(cardEl) {
    if (!cardEl) return;
    // matchContext barato antes de tudo: descarta lockups aninhados (o wrapper é quem processa).
    if (!YTVV.matchContext(cardEl)) return;

    var videoId = currentVideoId(cardEl);
    if (!videoId) return; // shorts, playlist, card ainda vazio

    var done = cardEl.getAttribute(C.PROCESSED_ATTR);
    if (done === videoId) return;
    if (inFlight.get(cardEl) === videoId) return;

    if (done !== null) {
      // Card reciclado: o YouTube reaproveitou o elemento para outro vídeo. Esquece a posição
      // conhecida; o IO reavalia se o card está perto da tela.
      log('card reciclado:', done, '->', videoId);
      removeBadges(cardEl);
      cardEl.removeAttribute(C.PROCESSED_ATTR);
      nearViewport.delete(cardEl);
    }

    if (!nearViewport.has(cardEl)) {
      watch(cardEl); // o callback do IO chama processCard quando chegar perto da tela
      return;
    }

    stats.seen++;

    var data = YTVV.extractCard(cardEl);
    if (!data) {
      log('card ignorado (extract retornou null):', cardEl.tagName);
      return; // continua observado: o próximo scan tenta de novo (metadados podem chegar depois)
    }
    stats.extracted++;

    var views = YTVV.parseCount(data.viewsText);
    if (views === null) {
      log('views inválidas:', data.viewsText);
      return;
    }

    var channelHref = data.channelHref || pageChannelHref(cardEl);
    log('card ->', { context: data.context, viewsText: data.viewsText, views: views, channelHref: channelHref });

    inFlight.set(cardEl, videoId);
    unwatch(cardEl);
    stats.sent++;

    try {
      chrome.runtime.sendMessage(
        { type: C.MSG_GET_SUBS, channelHref: channelHref, videoHref: data.videoHref },
        function (response) {
          var lastError = chrome.runtime.lastError; // ler sempre, senão o Chrome loga "Unchecked lastError"
          if (inFlight.get(cardEl) === videoId) inFlight.delete(cardEl);
          stats.replied++;

          // Reciclado enquanto a resposta vinha: descarta; o scan trata o vídeo novo.
          if (currentVideoId(cardEl) !== videoId) {
            scheduleScan();
            return;
          }

          // Marca mesmo em erro: sem isso, um SW com falha viraria reenvio a cada scan.
          cardEl.setAttribute(C.PROCESSED_ATTR, videoId);

          if (lastError) {
            stats.errors++;
            warn('sendMessage error:', lastError.message);
            return;
          }
          if (!response || !response.ok) {
            warn('resposta ruim:', response);
            return;
          }

          var subs = response.subs;
          log('resposta subs=', subs, 'para', channelHref);

          if (subs === null || subs === undefined || subs <= 0) return;

          var ratio = views / subs;
          log('ratio=', ratio.toFixed(2), 'views=', views, 'subs=', subs);

          if (ratio >= C.RATIO_THRESHOLD) {
            // O YouTube pode ter re-renderizado o <a> da thumb (mesmo vídeo) enquanto a resposta vinha.
            var container = cardEl.contains(data.thumbnailContainer)
              ? data.thumbnailContainer
              : cardEl.querySelector('a[href*="/watch"]');
            YTVV.applyBadge(container, ratio);
            stats.badged++;
          }
        }
      );
    } catch (e) {
      // Tipicamente "Extension context invalidated" (extensão atualizada/recarregada com a aba aberta).
      inFlight.delete(cardEl);
      cardEl.setAttribute(C.PROCESSED_ATTR, videoId);
      stats.errors++;
      warn('sendMessage threw:', e);
      if (!chrome.runtime || !chrome.runtime.id) stop();
    }
  }

  function scan() {
    observed.forEach(function (card) {
      if (!card.isConnected) unwatch(card);
    });
    var cards = document.querySelectorAll(YTVV.CARD_SELECTORS_JOINED);
    for (var i = 0; i < cards.length; i++) processCard(cards[i]);
  }

  // Scan completo com throttle: um único querySelectorAll por janela, em vez de varrer cada nó
  // adicionado. Cobre cards novos, cards preenchidos depois de inseridos, scroll infinito e cards
  // reciclados (em que só o conteúdo interno/href muda, não o elemento do card).
  var scanTimer = null;
  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      scan();
    }, SCAN_THROTTLE_MS);
  }

  var observer = new MutationObserver(scheduleScan);

  // Content script órfão (extensão atualizada/recarregada): para de observar em vez de falhar em loop.
  function stop() {
    observer.disconnect();
    io.disconnect();
    observed.clear();
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = null;
  }

  function start() {
    log('start() chamado — seletores:', YTVV.CARD_SELECTORS_JOINED);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href']
    });
    scan();
    log('observer ativo');
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  // Atalho global pra inspecionar manualmente
  // window.__YTVV_RESCAN = function () { scan(); console.log('[YTVV] manual rescan, stats:', stats); };
  // window.__YTVV_TEST_PARSE = YTVV.parseCount;
})();
