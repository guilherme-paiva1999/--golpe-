// Refaz a decisão da extensão para cada página coletada, com o código de verdade (background.js),
// mas com a idade e o CNPJ corretos (extras.json), sem as listas de golpes (golpe "desconhecido").
// Uso: node refazer.js PASTA_DA_EXTENSAO coleta.jsonl extras.json saida.jsonl
const fs = require('fs'), vm = require('vm'), path = require('path');
const [EXT, ent, extrasArq, sai] = process.argv.slice(2);
const E = JSON.parse(fs.readFileSync(extrasArq, 'utf8'));
const noop = () => {}, ev = { addListener: noop };
const ctx = { console, URL, AbortSignal, TextDecoder, Date, setTimeout,
  fetch: async (u) => ({ json: async () => JSON.parse(fs.readFileSync(path.join(EXT, u), 'utf8')) }),
  chrome: { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop, getURL: (p) => p },
    alarms: { get: async () => ({}), create: noop, onAlarm: ev }, webNavigation: { onBeforeNavigate: ev },
    storage: { local: { get: async () => ({}), set: async () => {} }, session: { get: async () => ({}), set: async () => {} } }, action: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(EXT, 'modelo.js'), 'utf8') + '\n' + fs.readFileSync(path.join(EXT, 'background.js'), 'utf8') +
  ';estaNaLista=async()=>false;' +
  'consultarRdap=async(d)=>{const x=self.E.dominios[d];return x?{dias:x.dias,cnpj:x.cnpj,pf:x.pf}:{dias:null,cnpj:null,pf:false}};' +
  'consultarCnpj=async(c)=>{const x=self.E.cnpjs[c];return x?JSON.parse(JSON.stringify(x)):null};' +
  'this.T={avaliarPagina,analisar};', Object.assign(ctx, { self: ctx, E }));
(async () => {
  const out = [];
  for (const l of fs.readFileSync(ent, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(l);
    const reg = { rotulo: r.rotulo, url: r.url, host: r.pagina && r.pagina.host, dinheiro: !!(r.pag && r.pag.length), erro: r.erro || null, title: r.pagina && r.pagina.title };
    let host = '', proto = 'https:';
    try { const u = new URL(r.final || r.url); host = u.hostname.toLowerCase(); proto = u.protocol; } catch (e) { /* */ }
    if (host) {
      const pre = await ctx.T.analisar(host, proto, { rapido: true });
      reg.preNivel = pre.nivel;
      if (r.pag && r.pag.length) {
        const s = r.pag[r.pag.length - 1].sinais;
        const res = await ctx.T.avaliarPagina(host, proto, s);
        reg.pagNivel = res.nivel; reg.confianca = res.confianca; reg.cnpj = res.cnpj; reg.comercio = !!res.comercio; reg.motivos = res.motivos.slice(0, 4);
      }
    }
    // O que a pessoa vê: bloqueio antes de abrir, bloqueio/aviso na página de dinheiro, ou nada.
    reg.decisao = reg.preNivel === 'perigo' || reg.pagNivel === 'perigo' ? 'bloqueia' : reg.pagNivel === 'atencao' ? 'avisa' : 'nada';
    out.push(JSON.stringify(reg));
  }
  fs.writeFileSync(sai, out.join('\n') + '\n');
  console.log(out.length, 'páginas');
})();
