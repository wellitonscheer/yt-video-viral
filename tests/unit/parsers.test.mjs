// Prova: parseCount (content) e parseCountStr (background) parseiam pt-BR E inglês,
// incluindo o caso que estava quebrado ("29.8 million" devolvia 29800), e que os dois
// parsers duplicados produzem saída IDÊNTICA (regra "manter em sincronia").

import { loadContentGlobals, loadChannelFetcher } from './load.mjs';

export default function (t) {
  const { parseCount } = loadContentGlobals();
  const { parseCountStr } = loadChannelFetcher();

  // [entrada, esperado]
  const cases = [
    // pt-BR
    ['1,2 mi de visualizações', 1200000],
    ['523 mil', 523000],
    ['1,2 milhão', 1200000],
    ['2,42 milhões de inscritos', 2420000],
    ['1,2 bi', 1200000000],
    ['1.234.567 visualizações', 1234567],
    ['1 visualização', 1],
    // inglês compacto
    ['15K views', 15000],
    ['1.2M views', 1200000],
    ['498M subscribers', 498000000],
    ['1,234,567 views', 1234567],
    ['1 view', 1],
    // inglês extenso (o bug "mil dentro de million")
    ['29.8 million subscribers', 29800000],
    ['523 thousand', 523000],
    ['1 billion subscribers', 1000000000],
    ['2 trillion', 2000000000000],
    // sem número / inválidos
    ['', null],
    [null, null],
    [undefined, null],
    ['não tem número', null],
  ];

  for (const [input, expected] of cases) {
    t.eq(parseCount(input), expected, `parseCount(${JSON.stringify(input)})`);
    t.eq(parseCountStr(input), expected, `parseCountStr(${JSON.stringify(input)})`);
    t.eq(parseCount(input), parseCountStr(input), `sincronia parseCount==parseCountStr (${JSON.stringify(input)})`);
  }
}
