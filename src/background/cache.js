// Cache em chrome.storage.local com TTL + dedup de promessas em vôo.
// Schema: { [channelKey]: { subs: number|null, fetchedAt: epoch_ms } }

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// TTL curto para respostas null (canal sem contagem OU falha de parse). Mantê-las só 24h
// causaria "blackout" de badges quando o YouTube muda o formato do HTML (ou, antes do fix de
// i18n, em páginas em inglês): a extração falha, grava null e some o badge por 24h. Com 1h, isso
// auto-cura rápido. Também migra usuários que já têm null em cache de páginas inglesas pré-fix.
const NULL_TTL_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'ytvv_channel_cache';

const inFlight = new Map(); // channelKey -> Promise<subs|null>

// Serializa todas as escritas em chrome.storage.local para evitar
// race read-modify-write quando duas chaves diferentes são gravadas em paralelo.
let writeChain = Promise.resolve();

async function readAll() {
  const obj = await chrome.storage.local.get(STORAGE_KEY);
  return obj[STORAGE_KEY] || {};
}

async function writeAll(data) {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

export async function getCached(channelKey) {
  const all = await readAll();
  const entry = all[channelKey];
  if (!entry) return undefined;
  const ttl = entry.subs === null ? NULL_TTL_MS : CACHE_TTL_MS;
  if (Date.now() - entry.fetchedAt > ttl) return undefined;
  return entry.subs; // number ou null
}

export function setCached(channelKey, subs) {
  writeChain = writeChain.then(async () => {
    const all = await readAll();
    all[channelKey] = { subs: subs, fetchedAt: Date.now() };
    await writeAll(all);
  });
  return writeChain;
}

// Garante uma única operação simultânea por channelKey.
export function dedupe(channelKey, factory) {
  if (inFlight.has(channelKey)) return inFlight.get(channelKey);
  const p = factory().finally(() => inFlight.delete(channelKey));
  inFlight.set(channelKey, p);
  return p;
}

export async function clearCache() {
  await chrome.storage.local.remove(STORAGE_KEY);
}
