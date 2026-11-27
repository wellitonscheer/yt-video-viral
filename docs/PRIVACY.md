# Política de Privacidade — YT Video Viral

_Última atualização: 27 de novembro de 2026_

Este documento descreve como a extensão **YT Video Viral** lida com dados. Em resumo: **nada é coletado, nada é enviado a servidores próprios**.

## Dados coletados pela extensão

**Nenhum.** A extensão não coleta, não armazena externamente e não transmite dados de identificação pessoal, histórico de navegação, conteúdo de páginas, telemetria, métricas de uso ou qualquer outra informação para servidores controlados pelo autor.

## Tráfego de rede gerado pela extensão

Durante o uso normal, a extensão realiza requisições **apenas** para o domínio `https://www.youtube.com/`, especificamente:

- **Endpoint oEmbed do YouTube** (`https://www.youtube.com/oembed?url=...`): usado para resolver o canal de um vídeo quando o YouTube não expõe esse link no DOM da sidebar de watch.
- **Página HTML pública do canal** (`https://www.youtube.com/@handle` ou equivalente): usada para extrair o número de inscritos quando o YouTube não disponibiliza esse dado no card do vídeo.

Essas requisições partem do seu próprio navegador, direto para o YouTube. A requisição da página do canal é feita **sem enviar cookies** (`credentials: 'omit'`), ou seja, sem vínculo com a sua sessão do YouTube.

A extensão **não** se comunica com nenhum outro domínio — nem servidores do autor, nem provedores de analytics, nem terceiros.

## Armazenamento local

A extensão usa a API `chrome.storage.local` do navegador para armazenar **apenas** um cache de contagem de inscritos por canal, com o seguinte formato:

```json
{
  "ytvv_channel_cache": {
    "@nomeDoCanal": { "subs": 12345, "fetchedAt": 1747584000000 }
  }
}
```

Cada entrada expira após **24 horas** (ou após **1 hora**, quando o canal não tem contagem de inscritos disponível). O cache reduz o número de requisições à página do canal e acelera a renderização dos badges em visitas subsequentes.

Todo esse cache fica **somente no seu navegador, no seu dispositivo**, e é apagado:

- Automaticamente ao desinstalar a extensão.
- Manualmente, pelo usuário, via console do service worker: `chrome.storage.local.remove('ytvv_channel_cache')`.

## Permissões solicitadas e por quê

| Permissão | Por que é necessária |
|---|---|
| `storage` | Armazenar o cache local de 24 h descrito acima. |
| `host_permissions: https://www.youtube.com/*` | Fazer `fetch` da página do canal e do endpoint oEmbed para obter a contagem de inscritos. |

A extensão **não solicita**: `tabs`, `cookies`, `history`, `bookmarks`, `webRequest`, `identity`, `geolocation`, nem qualquer permissão de host fora de `youtube.com`.

## Compartilhamento de dados com terceiros

**Não há compartilhamento.** A extensão não envia dados para nenhum terceiro — não tem para onde enviar.

## Mudanças nesta política

Atualizações nesta política serão publicadas no mesmo arquivo dentro do repositório do GitHub. A data no topo do documento sempre refletirá a última alteração.

## Contato

Dúvidas, reportes de bug ou pedidos relacionados a privacidade:

- Issues no GitHub: https://github.com/wellitonscheer/yt-video-viral/issues
