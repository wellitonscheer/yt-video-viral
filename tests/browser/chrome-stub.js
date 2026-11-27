// Stub do objeto `chrome` para rodar content.js fora do contexto de extensão.
// content.js só usa chrome.runtime.sendMessage (e chrome.runtime.id p/ detectar contexto órfão); respondemos com um subs canned a partir de
// window.__YTVV_STUB_SUBS (lookup por substring do channelHref, pois em file:// o href resolve para
// "file:///@handle"). Inclui um storage.local no-op por robustez.
(function () {
  function lookupSubs(channelHref) {
    var table = window.__YTVV_STUB_SUBS || {};
    var href = channelHref || '';
    for (var key in table) {
      if (key === '__default') continue;
      if (href.indexOf(key) !== -1) return table[key];
    }
    return ('__default' in table) ? table.__default : null;
  }

  window.__YTVV_SENT = []; // mensagens enviadas pelo content.js, em ordem (para os asserts do e2e)

  window.chrome = {
    runtime: {
      id: 'ytvv-stub',
      lastError: null,
      sendMessage: function (msg, cb) {
        window.__YTVV_SENT.push(msg);
        var subs = lookupSubs(msg && msg.channelHref);
        // responde de forma assíncrona, como a IPC real
        Promise.resolve().then(function () { cb({ ok: true, subs: subs }); });
      }
    },
    storage: {
      local: {
        _d: {},
        get: function (k, cb) { var o = {}; o[k] = this._d[k]; if (cb) cb(o); return Promise.resolve(o); },
        set: function (o, cb) { Object.assign(this._d, o); if (cb) cb(); return Promise.resolve(); },
        remove: function (k, cb) { delete this._d[k]; if (cb) cb(); return Promise.resolve(); }
      }
    }
  };
})();
