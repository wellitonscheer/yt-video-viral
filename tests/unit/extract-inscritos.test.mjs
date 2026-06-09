// Prova: extractInscritosFromHtml extrai a contagem do canal a partir do HTML REAL do YouTube,
// em pt-BR ("inscritos") E inglês ("subscribers"), nas 4 primeiras estratégias da cascata,
// e NÃO captura menções de canais relacionados (sem dígito após a aspa).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadChannelFetcher } from './load.mjs';

const FIX = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const read = (f) => readFileSync(join(FIX, f), 'utf8');

export default function (t) {
  const { extractInscritosFromHtml, parseCountStr } = loadChannelFetcher();
  const num = (html) => parseCountStr(extractInscritosFromHtml(html));
  // pt-BR usa NBSP (U+00A0) entre número e unidade; normaliza p/ comparar texto (o regex `\s` já casa NBSP).
  const norm = (s) => (s == null ? s : s.replace(/\s+/g, ' '));

  // Estratégia 1 — pageHeaderRenderer "content" (a confiável, do canal dono), ambos idiomas
  t.eq(norm(extractInscritosFromHtml(read('channel-ptbr.html'))), '498 mi de inscritos', 'pt content -> string');
  t.eq(num(read('channel-ptbr.html')), 498000000, 'pt content -> 498M');
  t.eq(norm(extractInscritosFromHtml(read('channel-en.html'))), '498M subscribers', 'en content -> string');
  t.eq(num(read('channel-en.html')), 498000000, 'en content -> 498M');

  // Estratégia 2 — accessibility label em inglês extenso ("29.8 million subscribers")
  t.eq(num(read('channel-en-label.html')), 29800000, 'en label extenso -> 29.8M');

  // Estratégia 3 — simpleText legado
  t.eq(num(read('channel-legacy-simpletext.html')), 1200000, 'legacy simpleText -> 1.2M');

  // Estratégia 4 — runs legado (pt-BR)
  t.eq(num(read('channel-legacy-runs.html')), 523000, 'legacy runs -> 523k');

  // Decoy: card relacionado "@Canal • 247 inscritos" NÃO deve casar (content/label exigem dígito inicial)
  const decoy = '<template>...,{"text":{"content":"@OutroCanal • 247 inscritos"}},...</template>';
  t.eq(extractInscritosFromHtml(decoy), null, 'decoy @canal • 247 inscritos -> null');

  // Nada de inscritos -> null
  t.eq(extractInscritosFromHtml(''), null, 'string vazia -> null');
  t.eq(extractInscritosFromHtml('<html><body>sem contagem aqui</body></html>'), null, 'sem subs -> null');
}
