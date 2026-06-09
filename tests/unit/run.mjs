// Runner zero-config dos testes unitários. Rodar:  node tests/unit/run.mjs
// Sai com código != 0 se qualquer asserção falhar (útil pra CI/manual gate).

import { createSuite } from './assert.mjs';
import parsers from './parsers.test.mjs';
import extractInscritos from './extract-inscritos.test.mjs';
import channelKey from './channel-key.test.mjs';

const suites = [
  ['parsers (parseCount / parseCountStr)', parsers],
  ['extractInscritosFromHtml (fixtures reais)', extractInscritos],
  ['extractChannelKey', channelKey],
];

let totalPass = 0;
let totalFail = 0;

for (const [name, fn] of suites) {
  const { t, cases } = createSuite();
  try {
    await fn(t);
  } catch (err) {
    cases.push({ ok: false, label: `suite lançou exceção: ${err && err.message}`, detail: String(err && err.stack || err) });
  }
  const pass = cases.filter((c) => c.ok).length;
  const fail = cases.length - pass;
  totalPass += pass;
  totalFail += fail;

  console.log(`\n## ${name} — ${pass}/${cases.length} ok${fail ? ` (${fail} FALHARAM)` : ''}`);
  for (const c of cases) {
    if (c.ok) console.log(`   ✓ ${c.label}`);
    else console.log(`   ✗ ${c.label} — ${c.detail}`);
  }
}

console.log(`\n=== TOTAL: ${totalPass} ok, ${totalFail} fail ===`);
process.exit(totalFail > 0 ? 1 : 0);
