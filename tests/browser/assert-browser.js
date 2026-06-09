// Asserts mínimos para os harnesses de navegador. Cada harness chama YTVVTest.finalize() ao final,
// que parka window.__YTVV_RESULTS__ = { passed, failed, cases } — o Playwright lê isso via browser_evaluate.
(function () {
  var cases = [];
  function j(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  window.YTVVTest = {
    eq: function (actual, expected, label) {
      var ok = Object.is(actual, expected);
      cases.push({ ok: ok, label: label, detail: ok ? '' : 'esperado ' + j(expected) + ', obtido ' + j(actual) });
    },
    ok: function (cond, label) {
      cases.push({ ok: !!cond, label: label, detail: cond ? '' : 'esperado truthy, obtido falsy' });
    },
    contains: function (haystack, needle, label) {
      var ok = typeof haystack === 'string' && haystack.indexOf(needle) !== -1;
      cases.push({ ok: ok, label: label, detail: ok ? '' : j(haystack) + ' não contém ' + j(needle) });
    },
    finalize: function () {
      var passed = 0;
      for (var i = 0; i < cases.length; i++) if (cases[i].ok) passed++;
      window.__YTVV_RESULTS__ = { passed: passed, failed: cases.length - passed, cases: cases };
      return window.__YTVV_RESULTS__;
    }
  };
})();
