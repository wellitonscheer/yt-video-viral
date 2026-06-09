// Carregadores ZERO-CONFIG (sem package.json, sem npm install).
//
// O código da extensão usa dois estilos: content scripts no padrão global `var YTVV` (script
// clássico) e o service worker em ES modules. Para testá-los no Node sem um package.json
// {"type":"module"}, lemos o arquivo como TEXTO, retiramos os `export` e avaliamos via `new Function`
// num escopo isolado. Os parsers/extratores são puros (string-in, string/number-out), então rodam
// no Node; o que toca DOM (extractCard, applyBadge) é testado no navegador via Playwright.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// channel-fetcher.js é ES module: tira `export` e devolve as funções puras.
export function loadChannelFetcher() {
  let src = readFileSync(join(ROOT, 'src/background/channel-fetcher.js'), 'utf8');
  src = src
    .replace(/^export\s+(async\s+)?function/gm, '$1function') // export [async] function -> [async] function
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');              // remove `export { ... };`
  const factory = new Function(src + '\nreturn { parseCountStr, extractInscritosFromHtml };');
  const mod = factory();
  if (typeof mod.parseCountStr !== 'function' || typeof mod.extractInscritosFromHtml !== 'function') {
    throw new Error('load.mjs: strip de export falhou — parseCountStr/extractInscritosFromHtml ausentes');
  }
  return mod; // { parseCountStr, extractInscritosFromHtml }
}

// Concatena os globais de content na ORDEM do manifest e devolve o objeto YTVV resultante.
// (Só os helpers puros são chamados nos testes Node — o idiom `var YTVV = ... || {}` torna a
// concatenação segura, e nenhum arquivo toca document/window no topo de módulo.)
export function loadContentGlobals() {
  const files = [
    'src/shared/constants.js',
    'src/shared/selectors.js',
    'src/content/parsers.js',
    'src/content/badge.js',
    'src/content/scanner.js',
  ];
  const src = files.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n');
  const factory = new Function(src + '\nreturn YTVV;');
  const YTVV = factory();
  if (!YTVV || typeof YTVV.parseCount !== 'function' || typeof YTVV.extractChannelKey !== 'function') {
    throw new Error('load.mjs: globais de content não carregaram (YTVV.parseCount/extractChannelKey ausentes)');
  }
  return YTVV;
}
