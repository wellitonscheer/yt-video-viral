# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Vanilla JS Chrome extension (Manifest V3). **Sem `package.json`, sem bundler, sem lint, sem testes automatizados.** Cada arquivo é carregado diretamente pelo browser conforme declarado em `manifest.json`. Não execute `npm install` nem espere encontrar scripts de build.

## Rodando localmente

1. Abrir `chrome://extensions/` no Chrome/Brave/Edge.
2. Ativar **Modo desenvolvedor** (canto superior direito).
3. **Carregar sem compactação** → apontar para a raiz deste repositório.
4. Abrir https://www.youtube.com e verificar os badges 🔥 sobre thumbs.

Após editar **content scripts** (`src/content/`, `src/shared/`), clicar no botão de **recarregar** no card da extensão e dar F5 na aba do YouTube.

Após editar o **service worker** (`src/background/`), clicar no link **"service worker"** no card da extensão para abrir o DevTools dedicado dele, e clicar em recarregar.

## Arquitetura — três camadas

### `src/shared/` — carregado primeiro pelos content scripts
- `constants.js` cria o global `window.YTVV.CONSTANTS` (`CACHE_TTL_MS`, `RATIO_THRESHOLD`, `PROCESSED_ATTR`, `BADGE_CLASS`, `MSG_GET_SUBS`, `LOG_PREFIX`, `DEBUG`).
- `selectors.js` define `YTVV.SELECTORS` por contexto (`home`, `sidebar`, `search`) e os agrega em `YTVV.CARD_SELECTORS_JOINED`.

⚠️ **O service worker NÃO importa `shared/`.** Ele tem cópias literais (`MSG_GET_SUBS` em `background.js:4`, `CACHE_TTL_MS` em `cache.js:4`). Se alterar uma constante de protocolo IPC, **alterar nos dois lados**, senão o handshake quebra silenciosamente (handler ignora a mensagem, badge nunca aparece).

### `src/content/` — content scripts (ordem importa, vide `manifest.json`)
- `parsers.js` — `YTVV.parseCount(text)` (texto → número absoluto, suporta pt-BR `"1,2 mi"` e en `"1.2M"`) e `YTVV.extractChannelKey(href)`.
- `scanner.js` — `YTVV.extractCard(cardEl)` percorre o card via `TreeWalker`, encontra `videoAnchor` (`a[href*="/watch"]`), `channelAnchor` (prefixos `/@`, `/channel/`, `/user/`, `/c/`) e `viewsText` via regex `_VIEWS_PATTERN`. `matchContext(cardEl)` descarta `yt-lockup-view-model` aninhado em wrappers da home/busca para evitar badge duplicado.
- `badge.js` — `YTVV.applyBadge(container, ratio)` cria/atualiza/remove um `<div class="ytvv-badge ytvv-badge--low|mid|high">`. Limiar de cor: amarelo `≥ 1x`, laranja `≥ 2x`, vermelho `≥ 5x`.
- `content.js` — entry point. `MutationObserver(document.body)` + rescan periódico a cada 3 s × 5 (cobre cards que aparecem tardiamente). Usa `WeakSet inFlight` por card e atributo DOM `data-ytvv-processed="1"` para idempotência.

### `src/background/` — service worker (ES modules, `"type": "module"`)
- `background.js` — entry. Listener `chrome.runtime.onMessage` para `MSG_GET_SUBS`. Orquestra: `getChannelHref` → `getSubs` → resposta. `resolveChannelHrefViaOembed` cobre o caso da sidebar do `/watch` (não expõe anchor de canal no DOM).
- `cache.js` — `getCached`/`setCached`/`dedupe`/`clearCache` sobre `chrome.storage.local['ytvv_channel_cache']`. Schema: `{ [key]: { subs, fetchedAt } }`. TTL 24 h. Escritas serializadas globalmente via `writeChain` para evitar race read-modify-write entre chaves diferentes.
- `channel-fetcher.js` — `fetchSubscribers(channelHref)` faz `fetch` da página HTML do canal e roda **cinco estratégias regex em cascata** (`extractInscritosFromHtml`): pageHeaderRenderer → accessibility label → simpleText (legado) → runs (legado) → meta description. Cada uma é tolerante a abreviações pt-BR (`mi`, `mil`, `bi`, `milhões`).

## Fluxo de uma requisição

```
content script               service worker
─────────────────            ──────────────────────────────
extractCard(cardEl)
  → { videoHref, channelHref, viewsText }
parseCount(viewsText)
  → views (number)
sendMessage({type: MSG_GET_SUBS, channelHref, videoHref})
                             onMessage handler
                             → getSubs({channelHref, videoHref})
                                 ├── se channelHref ausente: resolveChannelHrefViaOembed(videoHref)
                                 │     (fetch youtube.com/oembed)
                                 ├── channelKeyFromHref → cache get
                                 ├── miss? fetch página do canal
                                 │     → extractInscritosFromHtml
                                 │     → parseCountStr
                                 └── cache set + responde {ok, subs}
sendResponse callback
  → setAttribute('data-ytvv-processed', '1')
  → ratio = views/subs
  → ratio >= RATIO_THRESHOLD ? applyBadge() : nada
```

## Armadilhas conhecidas

- **SW MV3 é efêmero.** Qualquer variável de módulo no `background/` é reiniciada quando o Chrome encerra o worker (~30 s ocioso). `inFlight` em `cache.js` é correto **dentro** de uma ativação; persistência real é só `chrome.storage.local`.
- **Parsers duplicados.** `YTVV.parseCount` em `src/content/parsers.js` e `parseCountStr` em `src/background/channel-fetcher.js` são código idêntico. Manter em sincronia ao corrigir bugs de parsing.
- **Idioma.** `_VIEWS_PATTERN` em `scanner.js` aceita pt-BR e en. Já `extractInscritosFromHtml` (background) é **pt-BR only** — a âncora é a string `"inscritos"`. Para suportar en, adicionar estratégias paralelas com `"subscribers"`.
- **Cards aninhados.** `yt-lockup-view-model` aparece tanto solo (sidebar) quanto aninhado em `ytd-rich-item-renderer`/`ytd-video-renderer`. `matchContext` retorna `null` no caso aninhado para que o wrapper externo dispare `processCard` uma única vez.
- **Cache poisoning evitado.** `getChannelHref`/`getSubs` só chamam `setCached` em respostas efetivas (mesmo `null` definitivo). Exceção de fetch → retorna `null` **sem** cachear, evitando 24 h sem badge após uma falha transitória.

## Debug

- Flag global `DEBUG` em `src/shared/constants.js:11`. Quando `true`, a função `log()` em `content.js` emite `console.log` prefixado `[YTVV]`. Em produção fica `false`.
- Helpers de inspeção (`window.__YTVV_STATS`, `__YTVV_RESCAN`, `__YTVV_TEST_PARSE`, `__YTVV_INSPECT`, função `_logMiss`) estão **comentados com `//`** em `content.js` e `scanner.js`. Descomentar localmente para diagnosticar; **não fazer commit ativando-os** (são acessíveis à página do YouTube e a outras extensões, viram superfície de fingerprinting).
- Limpar cache manualmente: no console do service worker (chrome://extensions → service worker), `chrome.storage.local.remove('ytvv_channel_cache')`.

## Permissões — manter mínimo absoluto

`manifest.json` declara apenas:
- `permissions: ["storage"]`
- `host_permissions: ["https://www.youtube.com/*"]`

Qualquer fetch fora de `youtube.com` exige nova `host_permission` (e revisão na Chrome Web Store). Antes de adicionar, considerar se o dado pode ser inferido sem o request.

## Versionamento

Versão da extensão em `manifest.json:version`. Releases públicas seguem semver e refletem em GitHub Releases + Chrome Web Store. `docs/PUBLISH_CHECKLIST.md` contém o roteiro de release.
