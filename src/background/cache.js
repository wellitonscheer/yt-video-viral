// Cache de inscritos (e de video→canal via oEmbed) com TTL + dedup de promessas em vôo.
// Schema persistido: chrome.storage.local[STORAGE_KEY] = { [key]: { subs: number|string|null, fetchedAt: epoch_ms } }
//
// Desenho (performance): o objeto é carregado UMA vez por ativação do service worker para um Map em
// memória; lookups não tocam o storage. Escritas atualizam a memória e agendam um flush com debounce,
// que poda entradas expiradas, limita o total a MAX_ENTRIES e grava o objeto uma única vez.
// Antes, cada get lia o objeto inteiro e cada set o regravava — custo que crescia sem limite, porque
// nada era podado (cada `video:<id>` ficava para sempre).

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// TTL curto para respostas null (canal sem contagem OU falha de parse). Mantê-las só 24h
// causaria "blackout" de badges quando o YouTube muda o formato do HTML (ou, antes do fix de
// i18n, em páginas em inglês): a extração falha, grava null e some o badge por 24h. Com 1h, isso
// auto-cura rápido. Também migra usuários que já têm null em cache de páginas inglesas pré-fix.
const NULL_TTL_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'ytvv_channel_cache';
// Teto de entradas persistidas (~100 B cada → ~500 KB, bem abaixo da quota de 10 MB do storage.local).
const MAX_ENTRIES = 5000;
// SW MV3 só é encerrado após ~30 s ocioso, então 1 s de debounce não perde escritas na prática;
// se perder, o custo é só refazer o fetch.
const FLUSH_DELAY_MS = 1000;

const inFlight = new Map(); // key -> Promise<subs|null>

let mem = null;        // Map<key, {subs, fetchedAt}> — fonte da verdade durante a ativação do SW
let loading = null;    // Promise<Map> do load inicial
let flushTimer = null;

function isFresh(entry, now) {
  if (!entry || typeof entry.fetchedAt !== 'number') return false;
  const ttl = entry.subs === null ? NULL_TTL_MS : CACHE_TTL_MS;
  return now - entry.fetchedAt <= ttl;
}

function load() {
  if (mem) return Promise.resolve(mem);
  if (!loading) {
    loading = chrome.storage.local.get(STORAGE_KEY)
      .then((obj) => new Map(Object.entries((obj && obj[STORAGE_KEY]) || {})))
      .catch((e) => {
        console.warn('[YTVV/bg] cache load failed', e);
        return new Map();
      })
      .then((m) => {
        mem = m;
        return m;
      });
  }
  return loading;
}

function prune(m, now) {
  for (const [k, e] of m) {
    if (!isFresh(e, now)) m.delete(k);
  }
  const excess = m.size - MAX_ENTRIES;
  if (excess > 0) {
    const oldest = [...m].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt).slice(0, excess);
    for (const [k] of oldest) m.delete(k);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY_MS);
}

// Poda + grava. Nunca rejeita: falha de escrita (ex.: quota) só gera warn e a memória continua
// servindo; o próximo flush tenta de novo. (O desenho anterior encadeava escritas numa promise que,
// após UMA falha, ficava rejeitada para sempre e fazia todo canal novo voltar sem badge.)
export async function flush() {
  const m = await load();
  prune(m, Date.now());
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: Object.fromEntries(m) });
  } catch (e) {
    console.warn('[YTVV/bg] cache flush failed', e);
  }
}

export async function getCached(key) {
  const m = await load();
  const entry = m.get(key);
  if (!isFresh(entry, Date.now())) return undefined;
  return entry.subs; // number, string (href resolvido) ou null
}

export async function setCached(key, subs) {
  const m = await load();
  m.set(key, { subs: subs, fetchedAt: Date.now() });
  scheduleFlush();
}

// Garante uma única operação simultânea por key.
export function dedupe(key, factory) {
  if (inFlight.has(key)) return inFlight.get(key);
  const p = factory().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

export async function clearCache() {
  if (mem) mem.clear();
  await chrome.storage.local.remove(STORAGE_KEY);
}
