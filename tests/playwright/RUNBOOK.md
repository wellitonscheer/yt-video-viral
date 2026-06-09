# RUNBOOK — rodar os testes via Playwright MCP

Sequência verificada das chamadas do Playwright MCP. O MCP **bloqueia `file://`**, então os harnesses
de navegador são servidos por um servidor estático local (também é o caminho necessário caso se queira
testar `fetchSubscribers` como ES module no navegador).

## 0. Subir o servidor estático (uma vez)

```
Bash (background): python3 -m http.server 8765 --directory /home/caie/projects/yt-video-viral
```

Tudo abaixo usa `http://localhost:8765/...`. Ao terminar, mate o servidor.

## 1. Unit (Node) — rode primeiro, é o sinal mais rápido

```
Bash: node tests/unit/run.mjs
```
Espera-se `=== TOTAL: 80 ok, 0 fail ===` e exit code 0. Cobre parseCount/parseCountStr (pt-BR + en,
incl. `29.8 million`), extractInscritosFromHtml contra fixtures reais, e extractChannelKey.

## 2. Browser — extractCard, badge, e2e

Para cada harness: navegar, ler `window.__YTVV_RESULTS__`, asserir `failed === 0`.

### 2a. extractCard
```
browser_navigate  http://localhost:8765/tests/browser/harness-extract.html
browser_evaluate  () => window.__YTVV_RESULTS__          # esperar passed:23, failed:0
```

### 2b. badge / formatRatio / intensityClass
```
browser_navigate  http://localhost:8765/tests/browser/harness-badge.html
browser_evaluate  () => window.__YTVV_RESULTS__          # esperar passed:19, failed:0
```

### 2c. e2e (content.js + chrome stub) — assíncrono
```
browser_navigate       http://localhost:8765/tests/browser/harness-e2e.html
browser_wait_for       text: "🔥"                         # content.js responde via microtask + rAF
browser_evaluate       () => window.__YTVV_RESULTS__       # esperar passed:5, failed:0
browser_take_screenshot  filename: ytvv-e2e-badge.png      # prova visual: 🔥 12x no card viral, nada no card low
```

### Sanidade de console (qualquer harness)
```
browser_console_messages  level: error
```
Único erro aceitável: `404 favicon.ico` (o servidor não tem favicon). Qualquer outro erro = regressão.

## 3. Smoke ao vivo (informativo, allow-failure)

Valida que os SELETORES ainda casam com o YouTube atual, em ambos idiomas. Read-only: injeta os globais
e roda extractCard nos cards reais; **não** carrega a extensão nem aplica badge.

```
browser_navigate  https://www.youtube.com/results?search_query=mrbeast&hl=en
browser_evaluate  <conteúdo de tests/playwright/inject-and-extract.js>   # retorna amostra de extractCard
# repetir com &hl=pt-BR
```
Flakiness esperada (não deve bloquear o suite): A/B de layout (tags-raiz mudam), tela de consentimento de
cookies, cards lazy-loaded (pode exigir scroll), login wall, rate limit. Se vier vazio, rode de novo ou
role a página antes do evaluate.

## 4. E2E manual (gate final — NÃO automatizável via MCP)

O MCP não permite `--load-extension`, e o handshake real SW↔content-script + o `fetch` real da página do
canal só rodam com a extensão instalada. Passo manual:
1. `chrome://extensions` → Modo desenvolvedor → Carregar sem compactação → raiz do repo.
2. Abrir `https://www.youtube.com` (pt-BR) e `https://www.youtube.com/?hl=en` (inglês).
3. Confirmar badges 🔥 sobre thumbs de vídeos com mais views que inscritos, nos DOIS idiomas.
4. Limpar cache se necessário (console do service worker): `chrome.storage.local.remove('ytvv_channel_cache')`.
