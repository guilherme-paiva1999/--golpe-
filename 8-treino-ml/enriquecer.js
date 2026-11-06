// Para cada página coletada: idade e responsável do domínio (RDAP) e situação dos CNPJs (BrasilAPI), devagar,
// respeitando o limite do registro.br. Guarda os dados brutos em extras.json (por domínio e por CNPJ). Retoma de onde parou.
// Uso: NODE_USE_ENV_PROXY=1 node enriquecer.js coleta.jsonl extras.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const EXT = '/home/user/--golpe-/1-extensao-codigo';
const noop = () => {}, ev = { addListener: noop };
const bctx = { console, URL, AbortSignal, TextDecoder, fetch: async () => { throw 0; },
  chrome: { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop }, alarms: { get: async () => ({}), create: noop, onAlarm: ev },
    webNavigation: { onBeforeNavigate: ev }, storage: { local: { get: async () => ({}), set: async () => {} }, session: { get: async () => ({}), set: async () => {} } }, action: {} } };
vm.createContext(bctx);
vm.runInContext(fs.readFileSync(path.join(EXT, 'background.js'), 'utf8') + ';this.B={lerRdap,dominioRaiz,ehIPv4,sufixo,HOSPEDAGEM};', bctx);
const B = bctx.B;
const [ent, sai] = process.argv.slice(2);
const E = fs.existsSync(sai) ? JSON.parse(fs.readFileSync(sai, 'utf8')) : { dominios: {}, cnpjs: {} };
const salvar = () => fs.writeFileSync(sai, JSON.stringify(E));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function cnpjOk(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n) => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += Number(d[i]) * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
async function rdap(dom) {
  const br = dom.endsWith('.br');
  for (let t = 0; t < 6; t++) {
    try {
      const r = await fetch((br ? 'https://rdap.registro.br/domain/' : 'https://rdap.org/domain/') + encodeURIComponent(dom), { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36' } });
      if (r.status === 403 || r.status === 429) { console.log('limite', r.status, dom, '- esperando'); await espera(60000 * (t + 1)); continue; }
      if (r.status === 404) return { dias: null, cnpj: null, pf: false, ok: true };
      if (r.ok) { const i = B.lerRdap(await r.json()); return { dias: i.r === null ? null : Math.round((Date.now() - i.r) / 86400000), cnpj: i.cnpj, pf: i.pf, ok: true }; }
      return { dias: null, cnpj: null, pf: false, ok: false, status: r.status };
    } catch (e) { await espera(3000); }
  }
  return { dias: null, cnpj: null, pf: false, ok: false };
}
async function receita(c) {
  for (let t = 0; t < 5; t++) {
    try {
      const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + c, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36' } });
      if (r.status === 404) return { existe: false };
      if (r.status === 429 || r.status >= 500) { await espera(5000 * (t + 1)); continue; }
      if (r.ok) { const j = await r.json(); return { existe: true, ativa: /^ATIVA$/i.test(String(j.descricao_situacao_cadastral || '').trim()),
        situacao: j.descricao_situacao_cadastral || '', razao: j.razao_social || '', fantasia: j.nome_fantasia || '', abertura: j.data_inicio_atividade || '',
        cnaes: [j.cnae_fiscal, ...(j.cnaes_secundarios || []).map((c) => c.codigo)].filter(Boolean).map(String), mei: j.opcao_pelo_mei === true }; }
    } catch (e) { await espera(3000); }
  }
  return null;
}
(async () => {
  const regs = fs.readFileSync(ent, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.pagina);
  const doms = new Set(), cnpjs = new Set();
  for (const r of regs) {
    const host = r.pagina.host.toLowerCase();
    const dom = B.dominioRaiz(host);
    if (!B.ehIPv4(dom) && !B.sufixo(host, B.HOSPEDAGEM)) doms.add(dom);
    for (const m of (r.pagina.texto || '').matchAll(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g)) { const d = m[0].replace(/\D/g, ''); if (cnpjOk(d)) { cnpjs.add(d); break; } }
  }
  const faltam = [...doms].filter((d) => !(E.dominios[d] && E.dominios[d].ok));
  console.log('domínios', doms.size, 'faltam', faltam.length);
  // registro.br: um por vez, com pausa. rdap.org (fora do .br): 4 por vez.
  const br = faltam.filter((d) => d.endsWith('.br')), fora = faltam.filter((d) => !d.endsWith('.br'));
  let n = 0;
  await Promise.all([
    (async () => { for (const d of br) { E.dominios[d] = await rdap(d); if (E.dominios[d].cnpj) cnpjs.add(E.dominios[d].cnpj); if (++n % 25 === 0) { salvar(); console.log(n, 'domínios'); } await espera(1500); } })(),
    ...Array.from({ length: 4 }, async () => { while (fora.length) { const d = fora.shift(); E.dominios[d] = await rdap(d); if (++n % 25 === 0) { salvar(); console.log(n, 'domínios'); } } })
  ]);
  for (const d of Object.values(E.dominios)) if (d.cnpj) cnpjs.add(d.cnpj);
  const cf = [...cnpjs].filter((c) => !E.cnpjs[c]);
  console.log('CNPJs', cnpjs.size, 'faltam', cf.length);
  let k = 0;
  await Promise.all(Array.from({ length: 3 }, async () => { while (cf.length) { const c = cf.shift(); E.cnpjs[c] = await receita(c); if (++k % 25 === 0) { salvar(); console.log(k, 'CNPJs'); } await espera(400); } }));
  salvar();
  console.log('fim', n, k);
})();
