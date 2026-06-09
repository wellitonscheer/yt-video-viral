// Asserts mínimos, sem dependências. Cada suite acumula `cases` que o runner imprime.

function j(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

export function createSuite() {
  const cases = [];
  const t = {
    eq(actual, expected, label) {
      const ok = Object.is(actual, expected);
      cases.push({ ok, label, detail: ok ? '' : `esperado ${j(expected)}, obtido ${j(actual)}` });
    },
    ok(cond, label) {
      cases.push({ ok: !!cond, label, detail: cond ? '' : 'esperado truthy, obtido falsy' });
    },
  };
  return { t, cases };
}
