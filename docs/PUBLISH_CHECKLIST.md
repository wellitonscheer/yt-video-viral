# Checklist de publicação — YT Video Viral

Roteiro dos passos manuais para publicar a primeira versão (v0.1.0) no GitHub e na Chrome Web Store. Cada item é uma ação concreta com o comando ou URL exato.

---

## Parte 1 — Inicializar o repositório Git

```bash
cd /home/caie/projects/yt-video-viral
git init
git add -A
git status   # revisar o que vai entrar — deve excluir logs/* exceto .gitkeep
git commit -m "feat: initial public release v0.1.0"
```

Verificar que `.git/` foi criado e o commit existe:

```bash
git log --oneline
```

---

## Parte 2 — Criar o repositório público no GitHub

Pré-requisito: ter o CLI `gh` autenticado (`gh auth status`).

```bash
cd /home/caie/projects/yt-video-viral
gh repo create yt-video-viral \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "Destaca vídeos do YouTube com mais visualizações do que inscritos do canal"
```

Após o push, abrir o repositório no browser:

```bash
gh repo view --web
```

Atualizar os placeholders `SEU-USUARIO` nos seguintes arquivos:

- [ ] `README.md` — links de Releases e Issues
- [ ] `docs/PRIVACY.md` — URL do GitHub Issues
- [ ] `docs/STORE_LISTING.md` — URL do GitHub e do PRIVACY.md

```bash
git add README.md docs/
git commit -m "docs: replace SEU-USUARIO placeholders"
git push
```

---

## Parte 3 — Tirar screenshots

1. Carregar a extensão em modo dev (`chrome://extensions/` → "Carregar sem compactação").
2. Abrir `https://www.youtube.com/` com a sessão logada.
3. Aguardar carregamento e tirar 1–3 screenshots em **1280×800** (proporção esperada pela Web Store) usando uma ferramenta como `gnome-screenshot -a` no Linux ou `flameshot gui`.
4. Salvar em `docs/screenshot-home.png`, `docs/screenshot-busca.png`, `docs/screenshot-watch.png`.
5. Atualizar `README.md` para apontar para a screenshot real:

   ```markdown
   ![Badges em ação na homepage do YouTube](docs/screenshot-home.png)
   ```

6. Commit + push:

   ```bash
   git add docs/screenshot-*.png README.md
   git commit -m "docs: add real screenshots"
   git push
   ```

---

## Parte 4 — Política de privacidade publicamente acessível

A Chrome Web Store exige uma URL pública. Duas opções:

### Opção A — usar o blob do GitHub direto (mais simples)

URL final será:

```
https://github.com/SEU-USUARIO/yt-video-viral/blob/main/docs/PRIVACY.md
```

Funciona, é estável, **basta o repo ser público**.

### Opção B — GitHub Pages (mais profissional)

```bash
# Em GitHub Settings → Pages → Source: Deploy from branch → main / docs / Save
```

URL final:

```
https://SEU-USUARIO.github.io/yt-video-viral/PRIVACY
```

---

## Parte 5 — Conta de desenvolvedor da Chrome Web Store

1. Acessar https://chrome.google.com/webstore/devconsole/.
2. Aceitar termos de desenvolvedor.
3. Pagar a taxa única de **USD 5,00** (cartão internacional necessário).
4. Configurar o e-mail de contato para revisão.

---

## Parte 6 — Gerar o ZIP de submissão

```bash
cd /home/caie/projects/yt-video-viral
zip -r yt-video-viral-v0.1.0.zip src icons manifest.json
```

Conferir o conteúdo:

```bash
unzip -l yt-video-viral-v0.1.0.zip
```

**O ZIP deve conter exatamente:** `src/`, `icons/`, `manifest.json`. Nada mais. Não incluir `docs/`, `CLAUDE.md`, `README.md`, `LICENSE`, `.gitignore`, `.git/`, `logs/`.

---

## Parte 7 — Submeter à Chrome Web Store

1. No Developer Dashboard, clicar em **"New item"** e fazer upload de `yt-video-viral-v0.1.0.zip`.
2. Preencher o formulário usando os textos prontos em `docs/STORE_LISTING.md`:
   - Nome, descrição curta, descrição detalhada
   - Categoria: Productivity
   - Idioma: Português (Brasil)
   - Subir os screenshots de `docs/screenshot-*.png`
   - Política de privacidade: URL gerada na Parte 4
   - Justificativas de permissões (storage + host)
   - Single purpose description
3. **Visibility**: Public.
4. **Distribution**: All regions (ou seleção específica).
5. Clicar em **"Submit for review"**.

Tempo médio de revisão: 1 a 7 dias úteis. A primeira submissão de uma conta nova pode demorar mais.

---

## Parte 8 — Após aprovação na Chrome Web Store

1. Anotar o **Item ID** (na URL `chrome.google.com/webstore/detail/<NOME>/<ITEM_ID>`).
2. Atualizar o `README.md` substituindo `[Chrome Web Store — link em breve](#)` pela URL real.
3. Criar GitHub Release `v0.1.0`:

   ```bash
   cd /home/caie/projects/yt-video-viral
   git tag v0.1.0
   git push --tags
   gh release create v0.1.0 \
     --title "v0.1.0 — primeira release pública" \
     --notes "Primeira release pública. Disponível também na Chrome Web Store: <URL>." \
     yt-video-viral-v0.1.0.zip
   ```

4. Commit do README atualizado:

   ```bash
   git add README.md
   git commit -m "docs: link to Chrome Web Store"
   git push
   ```

---

## Releases subsequentes (v0.2.0+, depois desta primeira)

1. Aplicar mudanças.
2. Bumpar `manifest.json:version` (o Web Store rejeita versão menor ou igual à publicada).
3. Commit + tag:

   ```bash
   git commit -am "feat: ..."
   git tag v0.2.0
   git push && git push --tags
   ```

4. Gerar ZIP novo:

   ```bash
   zip -r yt-video-viral-v0.2.0.zip src icons manifest.json
   ```

5. Subir o ZIP no Web Store Dashboard (item existente → "Package" → upload novo) → Submit for review.
6. Criar GitHub Release com `gh release create v0.2.0 ... yt-video-viral-v0.2.0.zip`.
