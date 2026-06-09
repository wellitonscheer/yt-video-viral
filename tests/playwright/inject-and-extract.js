// Probe SELF-CONTAINED para o smoke test ao vivo (informativo). Cole como `function` no browser_evaluate
// numa aba de busca do YouTube. Espelha scanner.js (seletores + _VIEWS_PATTERN + fallback de contagem pura)
// — não importa o código real (CSP/CORS do youtube.com impedem carregar scripts externos). Serve só para
// confirmar que os seletores E o fallback ainda casam com o DOM atual, em pt-BR e inglês.
() => {
  const SEL = 'ytd-rich-item-renderer,yt-lockup-view-model,ytd-video-renderer';
  const VIEWS = /\b\d[\d.,]*\s*(?:thousand|million|billion|trillion|mil|mi|bi|milhões|milhão|K|M|B)?\s*(?:de\s+)?(?:views?|visualizaç(?:ões|ão))\b/i;
  const BARE = /^(\d[\d.,]*)\s*(thousand|million|billion|trillion|mil|mi|bi|milhões|milhão|K|M|B)?$/i;
  const DATE = /(^|\s)há\s|\bago\b|atrás|transmitido|streamed|\b\d+\s*(?:dias?|semanas?|sem\.|meses|m[êe]s|anos?|horas?|minutos?|days?|weeks?|months?|years?|hours?|minutes?)\b/i;

  function findViews(card) {
    // 1) ancorado na palavra
    let wk = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT, null), n;
    while ((n = wk.nextNode())) {
      if (n.children.length > 3) continue;
      const t = (n.textContent || '').trim();
      if (!t || t.length > 80) continue;
      if (VIEWS.test(t)) return { text: t, via: 'word' };
    }
    // 2) fallback: contagem pura adjacente a data
    wk = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT, null);
    while ((n = wk.nextNode())) {
      if (n.children.length > 0) continue;
      const t = (n.textContent || '').trim();
      if (!t || t.length > 24) continue;
      const bm = t.match(BARE);
      if (!bm || (!bm[2] && !/[.,]/.test(bm[1]))) continue;
      let anc = n.parentElement, hops = 0;
      while (anc && hops < 4) {
        const at = (anc.textContent || '').trim();
        if (at.length <= 60 && DATE.test(at)) return { text: t, via: 'fallback' };
        anc = anc.parentElement; hops++;
      }
    }
    return null;
  }

  const cards = Array.from(document.querySelectorAll(SEL)).slice(0, 8);
  const out = [];
  for (const card of cards) {
    const v = card.querySelector('a[href*="/watch"]');
    if (!v) continue;
    let ch = null;
    const cands = card.querySelectorAll('a[href^="/@"],a[href^="/channel/"],a[href^="/user/"],a[href^="/c/"]');
    for (const c of cands) { if (!v.contains(c)) { ch = c; break; } }
    const fv = findViews(card);
    out.push({ tag: card.tagName.toLowerCase(), channel: ch ? ch.getAttribute('href') : null, viewsText: fv && fv.text, via: fv && fv.via });
  }
  return { total: cards.length, withViews: out.filter((o) => o.viewsText).length, sample: out };
}
