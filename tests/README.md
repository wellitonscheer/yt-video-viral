# Testes — YT Video Viral

Provam que a extensão funciona em **pt-BR e inglês**, sem `package.json`, sem bundler, sem `npm install`
(coerente com as regras do `CLAUDE.md`). Três camadas + um gate manual.

## Camadas

| Camada | O que prova | Como rodar |
|---|---|---|
| **Unit (Node)** | Parsing de views/inscritos pt-BR + en (incl. `29.8 million`), extração contra HTML real de canal, normalização de href de canal | `node tests/unit/run.mjs` |
| **Browser** | `extractCard` nos 3 contextos (home/sidebar/search) + aninhado; `applyBadge`/`formatRatio`/`intensityClass`; pipeline e2e do `content.js` com IPC stubbada renderizando o badge | Playwright MCP → `tests/playwright/RUNBOOK.md` |
| **Smoke ao vivo** | Os seletores ainda casam com o YouTube atual (hl=en e hl=pt-BR) | Playwright MCP (informativo, allow-failure) |
| **E2E manual** | Handshake real SW↔content + `fetch` real do canal, extensão instalada | `chrome://extensions` (vide RUNBOOK §4) |

## Por que sem `package.json`

`channel-fetcher.js` é ES module (`export`). Sem um `package.json {"type":"module"}`, o Node parseia `.js`
como CommonJS e o `import` quebra. Em vez de adicionar esse arquivo (proibido pelo CLAUDE.md), os
carregadores em `tests/unit/load.mjs` leem o fonte como **texto**, retiram os `export` e avaliam num
`new Function`. Os content scripts (padrão global `var YTVV`) são concatenados na ordem do manifest e
avaliados igual. Só funções puras rodam no Node; o que toca DOM roda no navegador.

## Estrutura

```
tests/
  fixtures/        # HTML real trimado de canal (pt-BR/en) + formas legadas sintéticas
  unit/            # testes Node zero-config (load.mjs, assert.mjs, run.mjs, *.test.mjs)
  browser/         # harnesses HTML + chrome-stub.js + assert-browser.js (dirigidos pelo Playwright MCP)
  playwright/      # RUNBOOK.md (sequência exata) + inject-and-extract.js (probe do smoke ao vivo)
```

## Atualizando fixtures

As fixtures `channel-ptbr.html` / `channel-en.html` / `channel-en-label.html` são janelas trimadas reais
de `youtube.com/@MrBeast?hl=...`. Se o YouTube mudar o formato, recapture uma janela (~500 B) ao redor da
string de inscritos/subscribers preservando as aspas/chaves que os regexes precisam, e ajuste o valor
esperado no teste. As `channel-legacy-*.html` são sintéticas (o YouTube não serve mais essas formas).
