# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Vanilla JS Chrome extension (Manifest V3). **Sem `package.json`, sem bundler, sem lint.** Cada arquivo é carregado diretamente pelo browser conforme declarado em `manifest.json`. Não execute `npm install` nem espere encontrar scripts de build.

Há testes em `tests/` (ver `tests/README.md`), mas **sem dependências**: os testes unitários rodam com `node tests/unit/run.mjs` (carregam o código lendo o arquivo como texto + `eval`, sem `package.json`); os testes de DOM/badge são páginas HTML dirigidas pelo Playwright MCP (`tests/browser/`). O E2E real com a extensão carregada continua sendo passo **manual** em `chrome://extensions`.

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

⚠️ **O service worker NÃO importa `shared/`.** Ele tem cópias literais (`MSG_GET_SUBS` em `background.js:4`, `CACHE_TTL_MS` em `cache.js:10`). Se alterar uma constante de protocolo IPC, **alterar nos dois lados**, senão o handshake quebra silenciosamente (handler ignora a mensagem, badge nunca aparece).

### `src/content/` — content scripts (ordem importa, vide `manifest.json`)
- `parsers.js` — `YTVV.parseCount(text)` (texto → número absoluto, suporta pt-BR `"1,2 mi"` e en `"1.2M"`) e `YTVV.extractChannelKey(href)`.
- `scanner.js` — `YTVV.extractCard(cardEl)` percorre o card via `TreeWalker`, encontra `videoAnchor` (`a[href*="/watch"]`), `channelAnchor` (prefixos `/@`, `/channel/`, `/user/`, `/c/`) e `viewsText`. Para views há **três caminhos**, em ordem: (1) ancorado na palavra via `_VIEWS_PATTERN`; (2) **`aria-label`** que é SÓ a contagem (`_VIEWS_LABEL_PATTERN`, ancorado `^…$`) — cobre contagens < 1000 do layout compacto (aba Vídeos de canal), que na tela aparecem como `"548"` mas o `<span>` tem `aria-label="548 visualizações"`; (3) **fallback aditivo** (`_BARE_COUNT_PATTERN` + `_DATE_HINT_PATTERN`) para o layout compacto atual do YouTube, que mostra a contagem SEM "views/visualizações" (ex.: `"70 mi • há 10 dias"`) — pega uma folha cujo texto inteiro é uma contagem pura (com sufixo OU separador, p/ rejeitar inteiros soltos) adjacente a uma data relativa. (2) e (3) só rodam se os anteriores falharem, então nunca alteram cards que já funcionavam. `matchContext(cardEl)` descarta `yt-lockup-view-model` aninhado em wrappers da home/busca para evitar badge duplicado.
- `badge.js` — `YTVV.applyBadge(container, ratio)` cria/atualiza/remove um `<div class="ytvv-badge ytvv-badge--low|mid|high">`. Limiar de cor: amarelo `≥ 1x`, laranja `≥ 2x`, vermelho `≥ 5x`.
- `content.js` — entry point. `MutationObserver(document.body)` (`childList` + `href`) agenda um **scan completo com throttle** (~200 ms) de `CARD_SELECTORS_JOINED` — cobre cards novos, preenchidos tarde, scroll infinito e **reciclados**. Idempotência pelo atributo `data-ytvv-processed="<videoId>"` (ID do vídeo, não `"1"`) + `WeakMap inFlight` card→videoId. Um `IntersectionObserver` (`rootMargin: 800px`) só libera o request para cards perto da tela (páginas ocultas do SPA nunca geram request). Na aba **Vídeos/Ao vivo** de um canal, card sem âncora de canal usa o canal da URL (`pageChannelHref`) em vez de 1 oEmbed por vídeo.

### `src/background/` — service worker (ES modules, `"type": "module"`)
- `background.js` — entry. Listener `chrome.runtime.onMessage` para `MSG_GET_SUBS`. Orquestra: `getChannelHref` → `getSubs` → resposta. `resolveChannelHrefViaOembed` cobre o caso da sidebar do `/watch` (não expõe anchor de canal no DOM). `createLimiter` (fila FIFO) limita requests simultâneos: 6 páginas de canal, 8 oEmbeds — o timeout de 6 s só começa quando o request sai da fila.
- `cache.js` — `getCached`/`setCached`/`dedupe`/`clearCache`/`flush` sobre `chrome.storage.local['ytvv_channel_cache']`. Schema: `{ [key]: { subs, fetchedAt } }` (chaves de canal e `video:<id>` → href do oEmbed). TTL 24 h (1 h p/ `null`). Carrega o objeto **uma vez por ativação do SW** num `Map` em memória; `setCached` só atualiza a memória e agenda `flush()` (debounce 1 s), que poda expirados, limita a `MAX_ENTRIES` (5000, remove os mais antigos) e grava uma vez. `flush` nunca rejeita (falha → `console.warn`).
- `channel-fetcher.js` — `fetchSubscribers(channelHref)` faz `fetch` (com timeout via `AbortController`, ~6 s) da página HTML do canal e roda **cinco estratégias regex em cascata** (`extractInscritosFromHtml`): pageHeaderRenderer → accessibility label → simpleText (legado) → runs (legado) → meta description. **Bilíngue:** ancora em `(?:inscritos|subscribers)` e tolera abreviações pt-BR (`mi`, `mil`, `bi`, `milhões`) e inglês compacto/extenso (`M`, `K`, `B`, `million`, `thousand`, `billion`). A estratégia 1 (`"content"`) é a única garantidamente do canal dono; 2-5 são fallbacks (a 2 pode pegar um canal em destaque — vide Armadilhas).

## Fluxo de uma requisição

```
content script               service worker
─────────────────            ──────────────────────────────
extractCard(cardEl)
  → { videoHref, channelHref, viewsText }
parseCount(viewsText)
  → views (number)
(só quando o card está perto da tela — IntersectionObserver)
sendMessage({type: MSG_GET_SUBS, channelHref, videoHref})
  (channelHref ausente na aba Vídeos de canal → canal da URL)
                             onMessage handler
                             → getSubs({channelHref, videoHref})
                                 ├── se channelHref ausente: resolveChannelHrefViaOembed(videoHref)
                                 │     (fetch youtube.com/oembed)
                                 │     (oembedLimit: máx. 8 simultâneos)
                                 ├── channelKeyFromHref → cache get (memória)
                                 ├── miss? fetch página do canal (channelLimit: máx. 6)
                                 │     → extractInscritosFromHtml
                                 │     → parseCountStr
                                 └── cache set (memória + flush adiado) + responde {ok, subs}
sendResponse callback
  → card ainda mostra o mesmo vídeo? senão descarta (foi reciclado)
  → setAttribute('data-ytvv-processed', videoId)
  → ratio = views/subs
  → ratio >= RATIO_THRESHOLD ? applyBadge() : nada
```

## Armadilhas conhecidas

- **SW MV3 é efêmero.** Qualquer variável de módulo no `background/` é reiniciada quando o Chrome encerra o worker (~30 s ocioso). `inFlight` e o `Map` em memória de `cache.js` são corretos **dentro** de uma ativação (o `Map` é recarregado do storage na próxima); persistência real é só `chrome.storage.local`, gravada pelo `flush` com debounce.
- **Parsers duplicados.** `YTVV.parseCount` em `src/content/parsers.js` e `parseCountStr` em `src/background/channel-fetcher.js` são código idêntico (mesma alternância de sufixo bilíngue, mesmos multiplicadores incl. `million`/`thousand`/`billion`/`trillion`). Manter em sincronia ao corrigir bugs de parsing — `tests/unit/parsers.test.mjs` afirma que os dois produzem saída idêntica.
- **Idioma (pt-BR + en).** Tanto `_VIEWS_PATTERN` (`scanner.js`) quanto `extractInscritosFromHtml` (background) são **bilíngues**: âncoras `(?:views?|visualizaç(?:ões|ão))` e `(?:inscritos|subscribers)`. ⚠️ **Ordem do sufixo importa:** `million`/`billion`/`thousand` vêm ANTES de `mil`/`mi`/`bi` na alternância, senão `mil` casaria como prefixo de `million` e devolveria 1e3 em vez de 1e6. Para um terceiro idioma, adicionar a âncora + os multiplicadores extensos nos dois parsers.
- **Cards reciclados.** O YouTube reaproveita o MESMO elemento de card para outro vídeo: chips de ordenação ("Em alta" na aba Vídeos), nova busca por SPA, watch → watch. Por isso `data-ytvv-processed` guarda o **ID do vídeo**: se diferir do vídeo atual do card, `processCard` remove o badge velho e reprocessa; a resposta do SW é descartada se o card mudou de vídeo enquanto ela vinha. Não voltar para um atributo booleano — com ele, "Em alta" mostrava 0 de 30 badges.
- **Atalho de canal só em uploads.** `pageChannelHref` vale só para `/{canal}/videos|streams` dentro de `ytd-browse[page-subtype="channels"]` visível. A aba Início fica de fora (mistura prateleiras com vídeos de outros canais) e continua no oEmbed.
- **Cards aninhados.** `yt-lockup-view-model` aparece tanto solo (sidebar) quanto aninhado em `ytd-rich-item-renderer`/`ytd-video-renderer`. `matchContext` retorna `null` no caso aninhado para que o wrapper externo dispare `processCard` uma única vez.
- **Cache poisoning evitado.** `getChannelHref`/`getSubs` só chamam `setCached` em respostas efetivas (mesmo `null` definitivo). Exceção de fetch (incl. timeout do `AbortController`) → retorna `null` **sem** cachear, evitando 24 h sem badge após uma falha transitória. Além disso, entradas `null` (canal sem contagem OU falha de parse) usam TTL curto `NULL_TTL_MS` (1 h) em `cache.js`, não 24 h — uma mudança de formato no YouTube auto-cura em 1 h. E `setCached`/`flush` nunca rejeitam: o desenho antigo encadeava escritas numa promise que, após UMA falha (ex.: quota), ficava rejeitada para sempre e fazia todo canal novo voltar sem badge.

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
