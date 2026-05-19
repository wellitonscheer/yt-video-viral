import { getCached, setCached, dedupe } from './cache.js';
import { fetchSubscribers } from './channel-fetcher.js';

const MSG_GET_SUBS = 'YTVV_GET_SUBS';
const LOG_PREFIX = '[YTVV/bg]';

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

// Sidebar do watch não expõe anchor de canal. oEmbed devolve author_url
// (https://www.youtube.com/@handle), que então passamos pro fetchSubscribers.
async function resolveChannelHrefViaOembed(videoHref) {
  const watchUrl = new URL(videoHref, 'https://www.youtube.com').toString();
  const url = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(watchUrl) + '&format=json';
  const res = await fetch(url);
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
      const resolved = await resolveChannelHrefViaOembed(videoHref);
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
      const subs = await fetchSubscribers(resolvedHref);
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
