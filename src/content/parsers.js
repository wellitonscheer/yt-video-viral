// parseCount("1,2 mi de visualizações") -> 1200000
// parseCount("523 mil") -> 523000
// parseCount("15K views") -> 15000
// parseCount(null|undefined|"") -> null
// parseCount("não tem número") -> null

var YTVV = (typeof YTVV !== 'undefined') ? YTVV : {};

YTVV.parseCount = function (text) {
  if (!text || typeof text !== 'string') return null;

  // Captura o primeiro número (com possível , ou . decimal) seguido opcionalmente de um sufixo.
  // pt-BR: "1,2 mi", "523 mil", "1,2 bi", "2,42 milhões"
  // en:    "1.2M", "523K", "1.2B", "29.8 million"
  // Alternativas mais longas primeiro — million/billion ANTES de mil/mi/bi, senão "mil" casaria
  // como prefixo de "million" e devolveria 1e3 em vez de 1e6.
  // Aceita múltiplos separadores de milhar (ex.: "1.234.567" / "1,234,567") via `*` no grupo
  var match = text.match(/([\d]+(?:[.,]\d+)*)\s*(milhões|milhão|thousand|million|billion|trillion|mil|mi|bi|M|K|B|m|k|b)?/i);
  if (!match) return null;

  var rawNum = match[1];
  var suffix = (match[2] || '').toLowerCase();

  // pt-BR usa vírgula decimal. Caso "1.234" (en) ou "1,234" (pt-BR como milhar) sem sufixo,
  // é ambíguo. Heurística: se tem sufixo, vírgula = decimal; sem sufixo, vírgula como milhar.
  var normalized;
  if (suffix) {
    // Com sufixo, parte decimal é tratada como tal (substitui , por .)
    normalized = rawNum.replace(/,/g, '.');
  } else {
    // Sem sufixo: remove separadores de milhar (tanto . quanto ,) — view count "1.234" = 1234
    normalized = rawNum.replace(/[.,]/g, '');
  }

  var num = parseFloat(normalized);
  if (isNaN(num)) return null;

  var multiplier = 1;
  if (suffix === 'k' || suffix === 'mil' || suffix === 'thousand') multiplier = 1e3;
  else if (suffix === 'm' || suffix === 'mi' || suffix === 'milhões' || suffix === 'milhão' || suffix === 'million') multiplier = 1e6;
  else if (suffix === 'b' || suffix === 'bi' || suffix === 'billion') multiplier = 1e9;
  else if (suffix === 'trillion') multiplier = 1e12;

  return Math.round(num * multiplier);
};

// Extrai o handle do canal a partir da URL: https://www.youtube.com/@nome -> @nome
//                                            https://www.youtube.com/channel/UCxxx -> UCxxx
//                                            https://www.youtube.com/user/foo -> user/foo
YTVV.extractChannelKey = function (channelHref) {
  if (!channelHref) return null;
  try {
    var url = new URL(channelHref, 'https://www.youtube.com');
    var path = url.pathname.replace(/^\/+|\/+$/g, '');
    // Casos: "@handle", "channel/UCxxx", "user/foo", "c/foo"
    var parts = path.split('/');
    if (parts[0].startsWith('@')) return parts[0];
    if (parts[0] === 'channel' && parts[1]) return 'channel/' + parts[1];
    if (parts[0] === 'user' && parts[1]) return 'user/' + parts[1];
    if (parts[0] === 'c' && parts[1]) return 'c/' + parts[1];
    return path || null;
  } catch (e) {
    return null;
  }
};
