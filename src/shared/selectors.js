// Apenas o seletor de raiz do card por contexto.
// Os sub-campos (videoAnchor, channelAnchor, viewsEl) são localizados em scanner.js
// via busca por conteúdo (prefixo de URL + regex de texto), não por nome de classe.

var YTVV = (typeof YTVV !== 'undefined') ? YTVV : {};

// Sidebar (página de watch) usa <yt-lockup-view-model> direto, sem wrapper.
// Cuidado: na home, lockups aparecem ANINHADOS em ytd-rich-item-renderer; o
// scanner descarta esses casos em matchContext para não duplicar o badge.
// grid e playlist são renderers LEGADOS que o YouTube ainda serve em alguns lugares:
// ytd-grid-video-renderer em /gaming; ytd-playlist-video-renderer em "Assistir mais tarde" (WL) e
// playlists próprias editáveis (as demais playlists já usam yt-lockup-view-model).
YTVV.SELECTORS = {
  home:     { card: 'ytd-rich-item-renderer' },
  sidebar:  { card: 'yt-lockup-view-model' },
  search:   { card: 'ytd-video-renderer' },
  grid:     { card: 'ytd-grid-video-renderer' },
  playlist: { card: 'ytd-playlist-video-renderer' }
};

YTVV.CARD_SELECTORS = Object.values(YTVV.SELECTORS).map(function (ctx) { return ctx.card; });
YTVV.CARD_SELECTORS_JOINED = YTVV.CARD_SELECTORS.join(',');
// Todos os cards que podem EMBRULHAR um yt-lockup-view-model (todos menos o próprio lockup).
YTVV.WRAPPER_SELECTORS_JOINED = YTVV.CARD_SELECTORS.filter(function (s) {
  return s !== YTVV.SELECTORS.sidebar.card;
}).join(',');
