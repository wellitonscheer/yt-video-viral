import { getCached, setCached, dedupe } from './cache.js';
import { fetchSubscribers } from './channel-fetcher.js';

const MSG_GET_SUBS = 'YTVV_GET_SUBS';
const LOG_PREFIX = '[YTVV/bg]';

// Limita quantos requests de rede rodam ao mesmo tempo (fila FIFO). Sem isso, uma página com cache
// frio dispara 20-40 downloads simultâneos (página do canal: ~64 KB comprimidos / 1-2 MB de HTML cada)
// no mesmo instante em que o YouTube carrega thumbs e player. Como o content script só pede cards
// perto da tela, FIFO ≈ prioridade para o que o usuário está vendo.
function createLimiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

const channelLimit = createLimiter(6);
const oembedLimit = createLimiter(8);

function channelKeyFromHref(channelHref) {
  if (!channelHref) return null;
  try {
    const url = new URL(channelHref, 'https://www.youtube.com');
    const path = url.pathname.replace(/^\/+|\/+$/g, '');
    const parts = path.split('/');
    if (parts[0]?.startsWith('@')) return parts[0];
    if (parts[0] === 'channel' && parts[1]) return 'channel/' + parts[1];
    if (parts[0] === 'user' && parts[1]) return 'user/' + parts[1];
    if (parts[0] === 'c' && parts[1]) return 'c/' + parts[1];
    return path || null;
  } catch {
    return null;
  }
}

function videoIdFromHref(videoHref) {
  if (!videoHref) return null;
  try {
    const url = new URL(videoHref, 'https://www.youtube.com');
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

// fetch com timeout via AbortController. Em timeout, lança AbortError — os callers (getChannelHref/
// getSubs) capturam e devolvem null SEM cachear, evitando pendurar o handler e evitando cache 24h de
// uma falha transitória. O timer começa quando o request sai da fila do limiter, não ao entrar nela.
async function fetchWithTimeout(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options, { signal: ctrl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

// Sidebar do watch não expõe anchor de canal. oEmbed devolve author_url
// (https://www.youtube.com/@handle), que então passamos pro fetchSubscribers.
async function resolveChannelHrefViaOembed(videoHref) {
  const watchUrl = new URL(videoHref, 'https://www.youtube.com').toString();
  const url = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(watchUrl) + '&format=json';
  const res = await fetchWithTimeout(url, {}, 6000);
  if (!res.ok) return null;
  const j = await res.json();
  return j.author_url || null;
}

async function getChannelHref({ channelHref, videoHref }) {
  if (channelHref) return channelHref;
  const videoId = videoIdFromHref(videoHref);
  if (!videoId) return null;

  const cacheKey = 'video:' + videoId;
  const cached = await getCached(cacheKey);
  if (cached !== undefined) return cached;

  return dedupe(cacheKey, async () => {
    try {
      const resolved = await oembedLimit(() => resolveChannelHrefViaOembed(videoHref));
      // Só cacheia em resposta efetiva (mesmo que null): erro transitório fica fora do cache
      await setCached(cacheKey, resolved);
      return resolved;
    } catch (e) {
      console.warn(LOG_PREFIX, 'oembed failed for', videoHref, e);
      return null;
    }
  });
}

async function getSubs({ channelHref, videoHref }) {
  const resolvedHref = await getChannelHref({ channelHref, videoHref });
  const key = channelKeyFromHref(resolvedHref);
  if (!key) return null;

  const cached = await getCached(key);
  if (cached !== undefined) return cached;

  return dedupe(key, async () => {
    try {
      const subs = await channelLimit(() => fetchSubscribers(resolvedHref));
      // Só cacheia em resposta efetiva: erro transitório de rede fica fora do cache
      await setCached(key, subs);
      return subs;
    } catch (e) {
      console.warn(LOG_PREFIX, 'fetch failed for', resolvedHref, e);
      return null;
    }
  });
}

// console.log(LOG_PREFIX, 'service worker iniciado');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // console.log(LOG_PREFIX, 'mensagem recebida', msg, 'de tab', sender?.tab?.id);
  if (!msg || msg.type !== MSG_GET_SUBS) return false;

  getSubs({ channelHref: msg.channelHref, videoHref: msg.videoHref })
    .then((subs) => {
      // console.log(LOG_PREFIX, 'resposta', msg.channelHref || msg.videoHref, '->', subs);
      sendResponse({ ok: true, subs });
    })
    .catch((err) => {
      console.warn(LOG_PREFIX, 'getSubs error', err);
      sendResponse({ ok: false, error: String(err) });
    });

  return true; // resposta assíncrona
});
