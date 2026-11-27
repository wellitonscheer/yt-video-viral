// Prova: cache.js serve da memória, respeita TTL (24 h / 1 h p/ null), poda e limita no flush,
// e uma falha de escrita no storage não quebra o cache (antes, envenenava todas as escritas seguintes).

import { loadCache } from './load.mjs';

function makeStorage(initial) {
  const data = initial ? JSON.parse(JSON.stringify(initial)) : {};
  const calls = { get: 0, set: 0 };
  let failNextSet = false;
  return {
    data,
    calls,
    failNextSet() { failNextSet = true; },
    chrome: {
      storage: {
        local: {
          async get(k) { calls.get++; return { [k]: data[k] && JSON.parse(JSON.stringify(data[k])) }; },
          async set(o) {
            calls.set++;
            if (failNextSet) { failNextSet = false; throw new Error('QUOTA_BYTES quota exceeded'); }
            Object.assign(data, JSON.parse(JSON.stringify(o)));
          },
          async remove(k) { delete data[k]; },
        },
      },
    },
  };
}

export default async function (t) {
  const HOUR = 60 * 60 * 1000;
  const now = Date.now();
  const origWarn = console.warn;
  console.warn = () => {}; // flush com falha loga warn de propósito

  try {
    // vazio
    {
      const s = makeStorage();
      const c = loadCache(s.chrome);
      t.eq(await c.getCached('@x'), undefined, 'get em cache vazio → undefined');
    }

    // set/get número e null; lookups não releem o storage
    {
      const s = makeStorage();
      const c = loadCache(s.chrome);
      await c.setCached('@a', 1234);
      await c.setCached('@b', null);
      t.eq(await c.getCached('@a'), 1234, 'set/get número');
      t.eq(await c.getCached('@b'), null, 'set/get null (canal sem contagem)');
      await c.getCached('@a');
      await c.getCached('@zzz');
      t.eq(s.calls.get, 1, 'storage.local.get chamado 1x por ativação (lookups vêm da memória)');
      t.eq(s.calls.set, 0, 'set não grava na hora (flush com debounce)');
    }

    // load de storage existente (schema da v0.1.0) + TTL
    {
      const s = makeStorage({ ytvv_channel_cache: {
        '@fresh': { subs: 500, fetchedAt: now - HOUR },
        '@stale': { subs: 500, fetchedAt: now - 25 * HOUR },
        '@nullOld': { subs: null, fetchedAt: now - 2 * HOUR },
        '@nullNew': { subs: null, fetchedAt: now - 30 * 60 * 1000 },
        'video:abc': { subs: 'https://www.youtube.com/@a', fetchedAt: now - HOUR },
      } });
      const c = loadCache(s.chrome);
      t.eq(await c.getCached('@fresh'), 500, 'entrada da v0.1.0 com 1 h → válida');
      t.eq(await c.getCached('@stale'), undefined, 'número com 25 h → expirado');
      t.eq(await c.getCached('@nullOld'), undefined, 'null com 2 h → expirado (TTL curto de 1 h)');
      t.eq(await c.getCached('@nullNew'), null, 'null com 30 min → ainda válido');
      t.eq(await c.getCached('video:abc'), 'https://www.youtube.com/@a', 'video→canal (string) preservado');

      await c.flush();
      const saved = s.data.ytvv_channel_cache;
      t.ok(saved && !('@stale' in saved) && !('@nullOld' in saved), 'flush poda as entradas expiradas');
      t.ok(saved && '@fresh' in saved && '@nullNew' in saved && 'video:abc' in saved, 'flush mantém as válidas');
    }

    // teto de entradas: mantém as mais novas
    {
      const initial = {};
      const N = 5010;
      for (let i = 0; i < N; i++) initial['@c' + i] = { subs: i, fetchedAt: now - (N - i) * 1000 }; // @c0 = mais antiga
      const s = makeStorage({ ytvv_channel_cache: initial });
      const c = loadCache(s.chrome);
      await c.flush();
      const saved = s.data.ytvv_channel_cache;
      t.eq(Object.keys(saved).length, c.MAX_ENTRIES, 'flush limita a MAX_ENTRIES');
      t.ok(!('@c0' in saved) && !('@c9' in saved) && '@c10' in saved && ('@c' + (N - 1)) in saved,
        'teto remove as de fetchedAt mais antigo');
    }

    // falha de escrita não envenena o cache
    {
      const s = makeStorage();
      const c = loadCache(s.chrome);
      await c.setCached('@a', 10);
      s.failNextSet();
      let threw = false;
      try { await c.flush(); } catch { threw = true; }
      t.ok(!threw, 'flush com storage.set falhando não lança');
      t.eq(await c.getCached('@a'), 10, 'após falha de escrita, a memória segue servindo');
      await c.setCached('@b', 20);
      await c.flush();
      t.eq(s.data.ytvv_channel_cache && s.data.ytvv_channel_cache['@b'] && s.data.ytvv_channel_cache['@b'].subs, 20,
        'flush seguinte grava normalmente (sem cadeia envenenada)');
      t.ok(s.data.ytvv_channel_cache && '@a' in s.data.ytvv_channel_cache, 'entrada da tentativa que falhou também é gravada depois');
    }

    // debounce: setCached agenda 1 flush
    {
      const s = makeStorage();
      const timers = [];
      const c = loadCache(s.chrome, (fn) => { timers.push(fn); return timers.length; });
      await c.setCached('@a', 1);
      await c.setCached('@b', 2);
      t.eq(timers.length, 1, 'vários setCached agendam um único flush');
      timers[0]();
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      t.eq(s.calls.set, 1, 'timer do debounce grava uma vez');
    }

    // clearCache limpa memória e storage
    {
      const s = makeStorage({ ytvv_channel_cache: { '@a': { subs: 1, fetchedAt: now } } });
      const c = loadCache(s.chrome);
      t.eq(await c.getCached('@a'), 1, 'pré-condição: entrada carregada');
      await c.clearCache();
      t.eq(await c.getCached('@a'), undefined, 'clearCache limpa a memória');
      t.ok(!('ytvv_channel_cache' in s.data), 'clearCache remove do storage');
    }

    // dedupe
    {
      const s = makeStorage();
      const c = loadCache(s.chrome);
      let calls = 0;
      let release;
      const gate = new Promise((r) => { release = r; });
      const factory = () => { calls++; return gate.then(() => 42); };
      const p1 = c.dedupe('@x', factory);
      const p2 = c.dedupe('@x', factory);
      release();
      const [r1, r2] = await Promise.all([p1, p2]);
      t.eq(calls, 1, 'dedupe: factory chamada 1x para requests simultâneos da mesma chave');
      t.ok(r1 === 42 && r2 === 42, 'dedupe: ambos recebem o mesmo resultado');
      await c.dedupe('@x', factory);
      t.eq(calls, 2, 'dedupe: depois de resolvido, nova chamada roda a factory de novo');
    }
  } finally {
    console.warn = origWarn;
  }
}
