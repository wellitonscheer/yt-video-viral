// Faz fetch da página do canal e extrai contagem de inscritos/subscribers.
// Bilíngue: pt-BR ("inscritos") e inglês ("subscribers"), compacto ("498M") e extenso ("29.8 million").
// Estratégia em cascata baseada no que o YouTube atualmente devolve:
//  1. pageHeaderRenderer:   pt "content":"20,7 mi de inscritos"  | en "content":"498M subscribers"
//  2. accessibility label:  pt "label":"2,42 milhões de inscritos" | en "label":"29.8 million subscribers"
//  3. simpleText (forma antiga)
//  4. runs (forma antiga)
//  5. <meta name="description"> (fallback)
//
// CONFIABILIDADE: a estratégia 1 ("content" do pageHeaderRenderer) é a única garantidamente do canal
// dono da página, em ambos idiomas. A estratégia 2 ("label") é best-effort: páginas de canal listam
// canais em destaque com seus próprios labels, e .match() devolve o PRIMEIRO — que pode ser de um canal
// em destaque, não o dono. Por isso 1 vem primeiro; 2-5 são fallbacks raros.

export function parseCountStr(text) {
  if (!text || typeof text !== 'string') return null;
  // Aceita pt-BR ("milhões"/"milhão") e inglês extenso ("thousand"/"million"/"billion"/"trillion"),
  // ambos usados em accessibility labels.
  // Importante: alternativas mais longas vêm primeiro — "million" ANTES de "mil"/"mi", senão "mil"
  // casaria como prefixo de "million" e devolveria 1e3 em vez de 1e6 (idem "billion" antes de "bi").
  // Aceita múltiplos separadores de milhar (ex.: "1.234.567 inscritos" / "1,234,567 subscribers") via `*` no grupo
  const match = text.match(/([\d]+(?:[.,]\d+)*)\s*(milhões|milhão|thousand|million|billion|trillion|mil|mi|bi|M|K|B|m|k|b)?/i);
  if (!match) return null;

  const rawNum = match[1];
  const suffix = (match[2] || '').toLowerCase();

  const normalized = suffix
    ? rawNum.replace(/,/g, '.')
    : rawNum.replace(/[.,]/g, '');

  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  let multiplier = 1;
  if (suffix === 'k' || suffix === 'mil' || suffix === 'thousand') multiplier = 1e3;
  else if (suffix === 'm' || suffix === 'mi' || suffix === 'milhões' || suffix === 'milhão' || suffix === 'million') multiplier = 1e6;
  else if (suffix === 'b' || suffix === 'bi' || suffix === 'billion') multiplier = 1e9;
  else if (suffix === 'trillion') multiplier = 1e12;

  return Math.round(num * multiplier);
}

function extractInscritosFromHtml(html) {
  // 1) pageHeaderRenderer: pt "content":"X mi de inscritos" | en "content":"498M subscribers"
  //    Âncora: número+sufixo opcional imediatamente antes de "inscritos"/"subscribers", sem prefixo.
  //    Como exige dígito logo após a aspa, evita capturar "@OutroCanal • 247 inscritos" de cards relacionados.
  //    Sufixo bilíngue, alternativas longas primeiro (million antes de mi/mil; billion antes de bi).
  let m = html.match(/"content":"(\d[\d.,]*(?:\s*(?:milh[õo]es|milh[ãa]o|thousand|million|billion|trillion|mil|mi|bi|M|K|B))?\s*(?:de\s+)?(?:inscritos|subscribers))"/i);
  if (m) return m[1];

  // 2) accessibility label — mesma âncora (best-effort, vide nota de confiabilidade acima)
  m = html.match(/"label":"(\d[\d.,]*(?:\s*(?:milh[õo]es|milh[ãa]o|thousand|million|billion|trillion|mil|mi|bi|M|K|B))?\s*(?:de\s+)?(?:inscritos|subscribers))"/i);
  if (m) return m[1];

  // 3) simpleText (forma antiga)
  m = html.match(/"subscriberCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/);
  if (m) return m[1];

  // 4) runs (forma antiga)
  // [\s\S]*? atravessa sub-objetos (ex.: "accessibility":{...}) antes de chegar a "runs"
  m = html.match(/"subscriberCountText"\s*:\s*\{[\s\S]*?"runs"\s*:\s*\[([^\]]+)\]/);
  if (m) {
    const parts = [...m[1].matchAll(/"text"\s*:\s*"([^"]+)"/g)].map(x => x[1]);
    if (parts.length) return parts.join('');
  }

  // 5) meta description fallback (raro)
  m = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  if (m) {
    const sub = m[1].match(/[\d.,]+\s*[mMkKbB][iI]?\s*(?:subscribers|inscritos)/i);
    if (sub) return sub[0];
  }

  return null;
}

// fetch com timeout (ver mesma nota em background.js). Em timeout, lança e o caller não cacheia.
async function fetchWithTimeout(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options, { signal: ctrl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSubscribers(channelHref) {
  const url = normalizeChannelUrl(channelHref);
  // Accept-Language pede pt-BR mas a extração é bilíngue: se o YouTube responder em inglês
  // (geo/IP costuma sobrepor o header em requests anônimos), parseamos "subscribers" do mesmo jeito.
  const res = await fetchWithTimeout(url, {
    credentials: 'omit',
    headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
  }, 6000);
  if (!res.ok) return null;
  const html = await res.text();

  const text = extractInscritosFromHtml(html);
  if (!text) return null;
  return parseCountStr(text);
}

// Exporta também para uso em testes offline
export { extractInscritosFromHtml };

function normalizeChannelUrl(channelHref) {
  try {
    return new URL(channelHref, 'https://www.youtube.com').toString();
  } catch {
    return channelHref;
  }
}
