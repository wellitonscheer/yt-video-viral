# Rascunho — Listagem da Chrome Web Store

> **Uso interno.** Este arquivo NÃO é a listagem em si — é o material de origem que será copiado/colado no formulário do Chrome Web Store Developer Dashboard ao submeter a extensão. Mantido no repositório para histórico e revisão.

---

## Informações básicas

- **Nome da extensão:** YT Video Viral
- **Versão:** 0.1.0 (sincronizar com `manifest.json:version`)
- **Categoria sugerida:** Produtividade / Ferramentas
- **Idioma primário:** Português (Brasil)
- **Idiomas adicionais:** (deixar em branco no v0.1.0; adicionar `English` quando traduzir)

---

## Título da loja (máx. 45 caracteres)

```
YT Video Viral — destaca vídeos que bombaram
```

Contagem: 44 caracteres. ✓

---

## Descrição curta (máx. 132 caracteres)

```
Destaca no YouTube vídeos cujas visualizações ultrapassam o número de inscritos do canal — um sinal claro de viralização.
```

Contagem: 121 caracteres. ✓

---

## Descrição detalhada (máx. 16.000 caracteres)

```
YT Video Viral marca vídeos do YouTube cujas visualizações superam o número de inscritos do canal — um indicador simples e visual de que aquele vídeo "estourou" muito além da base habitual de espectadores.

▶ O QUE A EXTENSÃO FAZ

Enquanto você navega no YouTube, um badge 🔥 aparece sobre as thumbnails dos vídeos onde a razão "visualizações ÷ inscritos" é igual ou maior que 1. O número exibido (ex.: 🔥 3,2x) mostra exatamente quantas vezes o vídeo ultrapassou a base de inscritos.

A cor do badge escala com a magnitude:
• 🟡 Amarelo: 1× a 2×
• 🟠 Laranja: 2× a 5×
• 🔴 Vermelho: 5× ou mais

▶ ONDE FUNCIONA

• Página inicial do YouTube
• Resultados de busca
• Sidebar de vídeos recomendados na página de assistir

(YouTube Shorts, playlists e páginas de canal não recebem badges nesta versão.)

▶ PRIVACIDADE PRIMEIRO

• Não coleta nada. Sem analytics. Sem rastreamento. Sem servidores próprios.
• Todo o tráfego de rede é direto para o próprio YouTube (oEmbed e página pública do canal), partindo do seu navegador.
• Cache de inscritos por canal fica somente no seu dispositivo (chrome.storage.local) e expira em 24 horas.

Política completa: (URL do PRIVACY.md no GitHub)

▶ COMO FUNCIONA POR DENTRO

A extensão observa o DOM do YouTube em tempo real. Para cada card de vídeo, extrai o link do canal, busca a contagem de inscritos (com cache local de 24 h para não repetir buscas) e, se a razão views ÷ inscritos cruzar o limiar configurado, aplica o badge sobre a thumbnail.

▶ PERMISSÕES — MÍNIMAS POSSÍVEIS

• "storage": para o cache local de 24 h.
• Acesso a https://www.youtube.com/*: para ler a contagem de inscritos da página pública do canal.

Sem acesso a outras abas, sem leitura de histórico, sem acesso a cookies fora do YouTube.

▶ LIMITAÇÕES CONHECIDAS

• A extração depende do HTML atual do YouTube em português ou inglês (outros idiomas não são reconhecidos); redesigns podem temporariamente quebrar o parsing até atualização.
• Canais que ocultam contagem de inscritos não recebem badge.
• A primeira visita a um canal novo precisa de um fetch da página dele; visitas seguintes usam cache local.

▶ OPEN SOURCE

Código-fonte aberto sob licença MIT:
https://github.com/wellitonscheer/yt-video-viral

Reporte bugs e sugira features em:
https://github.com/wellitonscheer/yt-video-viral/issues
```

---

## Single purpose description (campo obrigatório do Web Store)

```
Destacar visualmente, no DOM do YouTube, vídeos cujo número de visualizações excede a quantidade de inscritos do canal correspondente.
```

---

## Justificativa de cada permissão (campo obrigatório do Web Store)

### `storage`

```
Armazenar localmente o cache de contagem de inscritos por canal, com expiração de 24 horas. Isso evita que a extensão precise buscar a página do canal repetidamente a cada card de vídeo visível, reduzindo tráfego e acelerando a renderização do badge.
```

### `host_permissions` para `https://www.youtube.com/*`

```
Necessária para realizar fetch da página pública do canal (e do endpoint oEmbed do YouTube quando o link do canal não está disponível no DOM da sidebar de watch). Sem isso, não há como obter a contagem de inscritos para comparar com as visualizações exibidas. Nenhum outro host é acessado.
```

### Por que NÃO há justificativa de `remote code`

A extensão não executa código baixado remotamente. Todo o JavaScript é estático no pacote. Apenas dados (HTML do canal e JSON do oEmbed) são consumidos das requisições de rede.

---

## URL da política de privacidade

```
https://github.com/wellitonscheer/yt-video-viral/blob/main/docs/PRIVACY.md
```

*Alternativamente, ativar GitHub Pages no repo e usar `https://wellitonscheer.github.io/yt-video-viral/PRIVACY` — qualquer URL pública estável serve.*

---

## Assets visuais necessários

| Asset | Tamanho | Status |
|---|---|---|
| Ícone da loja | 128×128 PNG | ✓ Existe em `icons/128.png` |
| Screenshot 1 | 1280×800 ou 640×400 PNG/JPG | ✓ `docs/screenshot-busca.png` — busca "gatinho fofo" (badges 2,0x / 5,8x / 209x) |
| Screenshot 2 (opcional) | 1280×800 ou 640×400 | ✓ `docs/screenshot-busca-2.png` — busca "como fazer slime" (badges 1,7x / 204x / 22x) |
| Screenshot 3 (opcional) | 1280×800 ou 640×400 | ⬜ A produzir — sidebar de watch com badges |
| Tile promo pequeno (opcional) | 440×280 PNG | ⬜ A produzir, se quiser ranking melhor |
| Marquee promo (opcional) | 1400×560 PNG | ⬜ A produzir |
| Vídeo promo (opcional) | YouTube unlisted | ⬜ A produzir |

**Mínimo absoluto para submeter:** 1 screenshot. Os outros melhoram a apresentação mas não bloqueiam a submissão.

---

## Checklist de campos do formulário

- [ ] Nome da extensão
- [ ] Descrição curta
- [ ] Descrição detalhada
- [ ] Categoria
- [ ] Idioma
- [ ] Ícone 128×128 (vem do `manifest.json`)
- [ ] Pelo menos 1 screenshot
- [ ] Justificativa de cada permissão
- [ ] Justificativa de host permission
- [ ] Single purpose description
- [ ] Política de privacidade (URL)
- [ ] Declaração de uso de dados (selecionar "não coleta nenhum dado")
- [ ] Países de distribuição (sugestão: todos)
- [ ] Tipo de visibilidade: Público

---

## Notas para revisão futura

- Se traduzir para inglês: criar uma versão deste mesmo documento em `docs/STORE_LISTING_EN.md` e adicionar `English` como idioma adicional no dashboard.
- Se mudar de versão (v0.1.0 → v0.2.0+), atualizar `manifest.json:version` **antes** de gerar o ZIP. O Web Store rejeita pacotes com versão menor ou igual à publicada.
- Para releases-canário, marcar a release no GitHub como "pre-release" e **não** subir na Web Store até estabilizar.
