// Entry point do content script. Monta MutationObserver, processa cards, dispara badges.

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

  var inFlight = new WeakSet();
  var stats = { seen: 0, extracted: 0, sent: 0, replied: 0, badged: 0, errors: 0 };
  // window.__YTVV_STATS = stats;

  function processCard(cardEl) {
    if (!cardEl || inFlight.has(cardEl)) return;
    if (cardEl.hasAttribute(C.PROCESSED_ATTR)) return;

    stats.seen++;

    var data = YTVV.extractCard(cardEl);
    if (!data) {
      log('card ignorado (extract retornou null):', cardEl.tagName);
      return;
    }
    stats.extracted++;

    var views = YTVV.parseCount(data.viewsText);
    if (views === null) {
      log('views inválidas:', data.viewsText);
      return;
    }

    log('card ->', { context: data.context, viewsText: data.viewsText, views: views, channelHref: data.channelHref });

    inFlight.add(cardEl);
    stats.sent++;

    try {
      chrome.runtime.sendMessage(
        { type: C.MSG_GET_SUBS, channelHref: data.channelHref, videoHref: data.videoHref },
        function (response) {
          inFlight.delete(cardEl);
          stats.replied++;

          if (chrome.runtime.lastError) {
            stats.errors++;
            warn('sendMessage error:', chrome.runtime.lastError.message);
            return;
          }
          if (!response || !response.ok) {
            cardEl.setAttribute(C.PROCESSED_ATTR, '1');
            warn('resposta ruim:', response);
            return;
          }

          cardEl.setAttribute(C.PROCESSED_ATTR, '1');

          var subs = response.subs;
          log('resposta subs=', subs, 'para', data.channelHref);

          if (subs === null || subs === undefined || subs <= 0) return;

          var ratio = views / subs;
          log('ratio=', ratio.toFixed(2), 'views=', views, 'subs=', subs);

          if (ratio >= C.RATIO_THRESHOLD) {
            YTVV.applyBadge(data.thumbnailContainer, ratio);
            stats.badged++;
          }
        }
      );
    } catch (e) {
      stats.errors++;
      warn('sendMessage threw:', e);
    }
  }

  function scanRoot(root) {
    if (!root || !root.querySelectorAll) return;

    if (root.matches && root.matches(YTVV.CARD_SELECTORS_JOINED)) {
      processCard(root);
    }

    var cards = root.querySelectorAll(YTVV.CARD_SELECTORS_JOINED);
    if (cards.length > 0) log('scanRoot achou', cards.length, 'cards em', root.tagName || root.nodeName);
    for (var i = 0; i < cards.length; i++) processCard(cards[i]);
  }

  var pending = new Set();
  var scheduled = false;
  function schedule(node) {
    pending.add(node);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      var batch = Array.from(pending);
      pending.clear();
      scheduled = false;
      batch.forEach(scanRoot);
    });
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      for (var j = 0; j < m.addedNodes.length; j++) {
        var n = m.addedNodes[j];
        if (n.nodeType === Node.ELEMENT_NODE) schedule(n);
      }
    }
  });

  function start() {
    log('start() chamado — seletores:', YTVV.CARD_SELECTORS_JOINED);
    observer.observe(document.body, { childList: true, subtree: true });
    scanRoot(document.body);
    log('observer ativo');

    // Re-scan periódico nos primeiros 15s pra cobrir cards que aparecem tardiamente
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      scanRoot(document.body);
      log('rescan #' + attempts, 'stats:', JSON.stringify(stats));
      if (attempts >= 5) clearInterval(iv);
    }, 3000);
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  // Atalho global pra inspecionar manualmente
  // window.__YTVV_RESCAN = function () { scanRoot(document.body); console.log('[YTVV] manual rescan, stats:', stats); };
  // window.__YTVV_TEST_PARSE = YTVV.parseCount;
})();
