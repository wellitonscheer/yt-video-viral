# YT Video Viral

> Extensão de navegador que destaca vídeos do YouTube cujas **visualizações ultrapassam o número de inscritos do canal** — um sinal simples de que o vídeo "bombou" além da base habitual.

![placeholder do screenshot — adicionar docs/screenshot.png após instalar e tirar a print](docs/screenshot.png)

## O que faz

Enquanto você navega no YouTube (home, busca, sidebar de vídeos), um badge 🔥 aparece em cima das thumbs cujo `views / inscritos ≥ 1×`. A cor indica a magnitude:

- 🟡 **Amarelo** — `1× a 2×` (vídeo um pouco acima da base)
- 🟠 **Laranja** — `2× a 5×` (claramente viralizou)
- 🔴 **Vermelho** — `≥ 5×` (bombou pesado)

O número exibido é o múltiplo arredondado (ex.: `🔥 3,2x`).

## Instalação

### Opção 1 — Chrome Web Store (recomendado)

[**Chrome Web Store — link em breve**](#) *(será publicado em breve; substituir aqui pela URL real após aprovação)*

### Opção 2 — Sideload via GitHub Release

1. Baixar o `.zip` da última release: [Releases](../../releases).
2. Descompactar para uma pasta de sua preferência.
3. Abrir `chrome://extensions/` no Chrome/Brave/Edge.
4. Ativar **Modo desenvolvedor** (canto superior direito).
5. Clicar em **"Carregar sem compactação"** e apontar para a pasta descompactada.

### Opção 3 — Sideload via clone

```bash
git clone https://github.com/SEU-USUARIO/yt-video-viral.git
```

Depois, `chrome://extensions/` → **Modo desenvolvedor** → **Carregar sem compactação** → apontar para a pasta `yt-video-viral/`.

## Como funciona

A extensão observa o DOM do YouTube via `MutationObserver`, extrai de cada card o link do vídeo, o link do canal e o texto de visualizações. Um service worker consulta a página do canal correspondente (com cache local de 24 h) para descobrir o número de inscritos. Se a razão `views / inscritos` cruzar o limiar, o badge é renderizado sobre a thumbnail.

## Onde funciona

- ✅ Página inicial do YouTube (`/`)
- ✅ Resultados de busca (`/results`)
- ✅ Sidebar de vídeos recomendados na página de watch (`/watch`)
- ❌ Shorts, playlists puras, páginas de canal (sem badges nesses contextos)

## Privacidade

- **Nenhum dado é coletado.** A extensão não envia nada para servidores próprios — não há "próprios".
- O único tráfego de rede é para `https://www.youtube.com/` (endpoint oEmbed do próprio YouTube e a página HTML pública do canal), feito a partir do seu navegador como se você estivesse navegando manualmente.
- O cache de inscritos por canal fica em `chrome.storage.local` do seu próprio browser, com expiração de 24 h, e é apagado ao desinstalar a extensão.
- Sem analytics, sem terceiros, sem rastreamento.

Política completa: [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Limitações conhecidas

- Parsing depende do HTML atual do YouTube em **pt-BR**. Redesigns futuros podem quebrar a extração de inscritos até atualização.
- Canais que ocultam contagem de inscritos retornam sem dado — sem badge.
- A primeira visita a um canal novo precisa de um `fetch` da página dele (alguns segundos); visitas subsequentes usam cache.
- Não funciona em YouTube Shorts.

## Contribuir

Issues e PRs são bem-vindos. Se você usa **Claude Code** ou outro assistente de IA para contribuir, leia primeiro [`CLAUDE.md`](CLAUDE.md) — descreve a arquitetura, armadilhas conhecidas (service worker MV3, parsers duplicados, idioma pt-BR) e como rodar localmente.

Para reportar um bug ou pedir feature, abra uma [issue](../../issues).

## Licença

[MIT](LICENSE) © Welliton Scheer
