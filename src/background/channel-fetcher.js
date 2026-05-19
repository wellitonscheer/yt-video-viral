// Faz fetch da página do canal e extrai contagem de inscritos.
// Estratégia em cascata baseada no que o YouTube atualmente devolve (pt-BR):
//  1. pageHeaderRenderer:                "content":"20,7 mi de inscritos"
//  2. accessibility label:               "label":"2,42 milhões de inscritos"
//  3. simpleText (forma antiga)
//  4. runs (forma antiga)
//  5. <meta name="description"> (fallback)

export function parseCountStr(text) {
  if (!text || typeof text !== 'string') return null;
  // Aceita também "milhões" e "milhão" (extenso pt-BR usado em accessibility labels)
  // Importante: alternativas mais longas vêm primeiro (mil antes de mi)
  // Aceita múltiplos separadores de milhar (ex.: "1.234.567 inscritos") via `*` no grupo
  const match = text.match(/([\d]+(?:[.,]\d+)*)\s*(milhões|milhão|mil|mi|bi|M|K|B|m|k|b)?/i);
  if (!match) return null;

  const rawNum = match[1];
  const suffix = (match[2] || '').toLowerCase();

  const normalized = suffix
    ? rawNum.replace(/,/g, '.')
    : rawNum.replace(/[.,]/g, '');

  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  let multiplier = 1;
  if (suffix === 'k' || suffix === 'mil') multiplier = 1e3;
  else if (suffix === 'm' || suffix === 'mi' || suffix === 'milhões' || suffix === 'milhão') multiplier = 1e6;
  else if (suffix === 'b' || suffix === 'bi') multiplier = 1e9;

  return Math.round(num * multiplier);
}

function extractInscritosFromHtml(html) {
  // 1) pageHeaderRenderer: "content":"X mi de inscritos"
  //    Âncora: número+sufixo opcional imediatamente antes de "inscritos", sem prefixo.
  //    Evita capturar "@OutroCanal • 247 inscritos" de cards relacionados na mesma página.
  let m = html.match(/"content":"(\d[\d.,]*(?:\s*(?:milh[õo]es|milh[ãa]o|mil|mi|bi|M|K|B))?\s*(?:de\s+)?inscritos)"/i);
  if (m) return m[1];

  // 2) accessibility label — mesma âncora
  m = html.match(/"label":"(\d[\d.,]*(?:\s*(?:milh[õo]es|milh[ãa]o|mil|mi|bi|M|K|B))?\s*(?:de\s+)?inscritos)"/i);
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

export async function fetchSubscribers(channelHref) {
  const url = normalizeChannelUrl(channelHref);
  const res = await fetch(url, {
    credentials: 'omit',
    headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' }
  });
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
