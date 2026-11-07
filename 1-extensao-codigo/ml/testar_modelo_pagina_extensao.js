// Ponta a ponta: o background usa o modelo da página quando recebe as medidas, e o do nome quando não recebe.
// Também confere, nas páginas de exemplo (ml/amostras-paginas-reais.json), que as características do endereço
// calculadas aqui são as mesmas do treino. Uso: node ml/testar_modelo_pagina_extensao.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {}, ev = { addListener: noop };
const arq = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const chrome = { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop, getURL: (f) => f }, alarms: { get: async () => ({}), create: noop, onAlarm: ev },
  webNavigation: { onBeforeNavigate: ev }, storage: { local: { get: async () => ({}), set: async () => {} }, session: { get: async () => ({}), set: async () => {} } }, action: {} };
const fetch = async (f) => ({ json: async () => JSON.parse(arq(f)) });
const ctx = { chrome, console, AbortSignal, URL, TextDecoder, fetch }; vm.createContext(ctx);
vm.runInContext(arq('alfabetos.js') + ';' + arq('modelo.js') + ';' + arq('modelo-pagina.js') + ';' + arq('background.js') +
  ';this.T={avaliarPagina,sinalPagina,enderecoParaModelo,limparMedidas};estaNaLista=async()=>false;notaRA=async()=>null;buscarConsumidor=async()=>null;' +
  'consultarRdap=async()=>({dias:2000,cnpj:null,pf:false});consultarCnpj=async()=>null;', Object.assign(ctx, { self: ctx }));
const T = ctx.T;
const ex = JSON.parse(fs.readFileSync(path.join(__dirname, 'amostras-paginas-reais.json'), 'utf8'));
(async () => {
  let ok = 0, n = 0;
  const conf = (nome, cond) => { n++; if (cond) ok++; else console.log('FALHOU:', nome); };
  for (const e of ex) {
    const end = await T.enderecoParaModelo(e.host, e.protocolo);
    for (const k of Object.keys(end)) conf(e.host + ' ' + k, Math.abs(end[k] - e.x[k]) < 1e-12);
    const s = await T.sinalPagina(e.host, e.protocolo, T.limparMedidas(e.pagina));
    conf(e.host + ' probabilidade', Math.abs(s.p - e.p) < 1e-9);
  }
  const golpe = ex.find((e) => e.rotulo === 'golpe' && e.p >= 0.96);
  const res = await T.avaliarPagina(golpe.host, golpe.protocolo, { venda: true, pagamento: true }, T.limparMedidas(golpe.pagina));
  conf('motivo do modelo da página', res.motivos.some((m) => /leu esta página/.test(m)));
  const sem = await T.avaliarPagina(golpe.host, golpe.protocolo, { venda: true, pagamento: true });
  conf('sem medidas, não usa o modelo da página', !sem.motivos.some((m) => /leu esta página/.test(m)));
  // v3.13: disfarçar palavras com letras russas ("pіx", "sеnha") não engana o modelo da página.
  const PARA_CIR = { a: 'а', e: 'е', o: 'о', c: 'с', p: 'р', i: 'і' };
  const disf = (t) => t.replace(/[A-Za-z]{4,}/g, (w, i) => (i % 3 ? w : w.replace(/[aeocpi]/, (c) => PARA_CIR[c])));
  const med = T.limparMedidas(golpe.pagina), medD = T.limparMedidas({ ...golpe.pagina, texto: disf(golpe.pagina.texto) });
  const p0 = (await T.sinalPagina(golpe.host, golpe.protocolo, med)).p, p1 = (await T.sinalPagina(golpe.host, golpe.protocolo, medD)).p;
  conf('golpe com letras russas disfarçadas continua golpe (' + p0.toFixed(3) + ' -> ' + p1.toFixed(3) + ')', p1 >= p0 - 0.01 && medD.texto !== med.texto);
  const nf = ex.find((e) => e.host === 'ficos.com.br');
  conf('página real com "Nеtfliх" em letras russas', nf && nf.disfarce && (await T.sinalPagina(nf.host, nf.protocolo, T.limparMedidas(nf.pagina))).pontos === 25);
  conf('medidas inválidas são ignoradas', T.limparMedidas('x') === null && T.limparMedidas({ texto: 5, nLinks: -3 }).nLinks === 0);
  console.log(ok + '/' + n + ' como esperado');
  process.exit(ok === n ? 0 : 1);
})();
