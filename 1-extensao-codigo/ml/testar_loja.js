// v3.16: a confiança da loja parte da empresa (CNPJ): pouca abaixo de 5 anos, média de 5 a 10, alta com 10 ou mais (70%). A pressão deixa de pesar;
// sem CNPJ ativo a confiança cai muito (parte de 20% e só cai). As consultas (registro.br e BrasilAPI) são simuladas.
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {}, ev = { addListener: noop };
const memoria = {};            // chrome.storage.session de mentira (para o teste da memória de CNPJ por site)
const chrome = { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop }, alarms: { get: async () => ({}), create: noop, onAlarm: ev },
  webNavigation: { onBeforeNavigate: ev }, storage: { local: { get: async () => ({}), set: async () => {} }, session: { get: async (k) => (typeof k === 'string' && k in memoria ? { [k]: memoria[k] } : {}), set: async (o) => { Object.assign(memoria, o); } } }, action: {} };
const ctx = { chrome, console, AbortSignal, URL, TextDecoder, fetch: async () => { throw 0; } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../alfabetos.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8') + ';this.T={avaliarPagina};' +
  'estaNaLista=async()=>false;notaRA=async()=>null;buscarConsumidor=async()=>null;' +
  'consultarRdap=async(d)=>(self.__rdap[d]||{dias:4000,cnpj:null,pf:false});consultarCnpj=async(c)=>(c in self.__cnpj?self.__cnpj[c]:null);', Object.assign(ctx, { self: ctx }));
const anos = (a) => new Date(Date.now() - a * 365.25 * 86400000).toISOString().slice(0, 10);
const emp = (a, extra) => Object.assign({ existe: true, ativa: true, situacao: 'ATIVA', fantasia: 'LOJA', abertura: anos(a), cnaes: ['4751201'], atividade: 'Comércio varejista', socios: [] }, extra);
ctx.__cnpj = { '11000000000191': emp(29, { socios: ['pf:1', 'pf:2', 'pf:3'] }), '22000000000100': emp(7, { socios: ['pf:1', 'pf:2'] }), '33000000000100': emp(2), '44000000000100': emp(0.3),
  '99888777000166': { existe: true, ativa: false, situacao: 'BAIXADA', abertura: anos(10), socios: [] } };
ctx.__rdap = {};
const T = ctx.T;
const CNPJ_OK = (c) => c;   // os números acima são só chaves de teste (o content.js é quem valida o dígito)
const pouco = { venda: true, pagamento: true, contato: false, politicas: false, gateway: false };
const tudo = { venda: true, pagamento: true, contato: true, politicas: true, gateway: true, emailMesmoDominio: true, cnpjValido: true };
let ok = 0, n = 0;
const chk = (nome, cond, extra) => { n++; ok += !!cond; console.log((cond ? 'OK  ' : 'ERRO'), nome.padEnd(78), extra === undefined ? '' : extra); };
(async () => {
  const av = (host, sinais, cnpj, dono, diasSite = 4000) => { ctx.__rdap[host] = { dias: diasSite, cnpj: dono || null, pf: false }; return T.avaliarPagina(host, 'https:', { ...sinais, cnpj: cnpj || '', cnpjs: cnpj ? [cnpj] : [], cnpjValido: !!cnpj }); };
  const A = await av('antiga.com.br', { ...tudo, pressao: true, desconto: true }, '11000000000191', '11000000000191');
  chk('empresa de 29 anos + pressão + desconto + todas as provas: confiável (80% ou mais)', A.confianca >= 80 && A.nivel === 'ok', A.confianca + '%');
  chk('a pressão não aparece como motivo contra para empresa de 29 anos', !A.motivos.some((m) => /mensagens de pressão|descontos/.test(m)));
  const B = await av('antiga2.com.br', { ...pouco, pressao: true }, '11000000000191', '11000000000191');
  chk('empresa de 29 anos com poucas provas e pressão: parte de 70% (entre 70 e 89)', B.confianca >= 70 && B.confianca < 90, B.confianca + '%');
  const C0 = await av('media0.com.br', { ...pouco }, '22000000000100', '22000000000100');
  const C1 = await av('media1.com.br', { ...pouco, pressao: true }, '22000000000100', '22000000000100');
  chk('empresa de 7 anos: a pressão pesa só uma parte (perde entre 1 e 14 pontos)', C0.confianca - C1.confianca > 0 && C0.confianca - C1.confianca < 15, C0.confianca + '% -> ' + C1.confianca + '%');
  const D0 = await av('nova0.com.br', { ...pouco }, '33000000000100', '33000000000100');
  const D1 = await av('nova1.com.br', { ...pouco, pressao: true }, '33000000000100', '33000000000100');
  chk('empresa de 2 anos: a pressão pesa por inteiro (perde 15)', D0.confianca - D1.confianca === 15, D0.confianca + '% -> ' + D1.confianca + '%');
  const E0 = await av('semcnpj0.com.br', { ...pouco }, '', null);
  const E1 = await av('semcnpj1.com.br', { ...pouco, pressao: true }, '', null);
  chk('sem CNPJ: a confiança cai muito (no máximo 20%)', E0.confianca <= 20, E0.confianca + '%');
  chk('sem CNPJ: a pressão faz cair mais', E1.confianca < E0.confianca, E0.confianca + '% -> ' + E1.confianca + '%');
  chk('sem CNPJ: não é confiável (perigo, sem CNPJ registrado)', E0.nivel === 'perigo' && E0.cnpj === 'nenhum');
  const F = await av('baixada.com.br', { ...tudo }, '99888777000166', '99888777000166');
  chk('CNPJ baixado: confiança de no máximo 20% e perigo, mesmo com todas as provas', F.confianca <= 20 && F.nivel === 'perigo', F.confianca + '%');
  const G = await av('golpe-copiou.com.br', { ...tudo, pressao: true }, '11000000000191', '33000000000100', 100);   // site com 100 dias
  chk('CNPJ de empresa antiga na página, dono do endereço sem relação e site NOVO (100 dias): não ganha os 70% e avisa', G.confianca < 50 && G.contra.some((l) => /não parecem ser do mesmo grupo/.test(l)), G.confianca + '%');
  const G2 = await av('golpe-copiou2.com.br', { ...tudo, pressao: true }, '11000000000191', '99888777000166');
  chk('CNPJ de empresa antiga na página e dono do endereço com CNPJ baixado: cai (copiado?)', G2.confianca < 45 && G2.contra.some((l) => /^Atenção: o CNPJ da página/.test(l)), G2.confianca + '%');
  const G3 = await av('grupo-grande.com.br', { ...tudo, pressao: true }, '22000000000100', '11000000000191');
  chk('estilo C&A: CNPJ da página de uma empresa do grupo e dono do endereço ativo há 29 anos: confiável, com pressão', G3.confianca >= 80 && G3.nivel === 'ok' && G3.favor.some((l) => /faz parte do mesmo grupo/.test(l)), G3.confianca + '%');
  const H = await av('novissima.com.br', { ...tudo }, '44000000000100', '44000000000100');
  chk('empresa aberta há 4 meses: confiança baixa e perde pontos por ser nova', H.confianca < 85 && H.motivos.some((m) => /menos de 6 meses/.test(m)), H.confianca + '%');
  chk('mais anos de empresa, mais confiança (29 anos > 7 anos > 2 anos), com as mesmas provas', B.confianca > C0.confianca && C0.confianca > D0.confianca, B.confianca + ' > ' + C0.confianca + ' > ' + D0.confianca);
  // v3.18.5: caso H&M. Endereço registrado por uma empresa de proteção de domínios (sem relação com a loja), site com 8 anos.
  const Hm1 = await av('hm-teste.com.br', { ...tudo, pressao: true }, '22000000000100', '33000000000100', 3000);
  chk('estilo H&M: site de 8 anos, CNPJ da loja sem relação com quem registrou o endereço: só atenção leve, sem derrubar a nota', Hm1.confianca >= 70 && Hm1.contra.some((l) => /sem relação societária/.test(l)) && !Hm1.contra.some((l) => /^Atenção:/.test(l)), Hm1.confianca + '%');
  // a mesma loja numa página SEM o CNPJ no rodapé: com a memória do site, dá o mesmo resultado
  const Hm2 = await av('hm-teste.com.br', { ...tudo, cnpjValido: false, pressao: true }, '', '33000000000100', 3000);
  chk('estilo H&M: página sem CNPJ usa o CNPJ visto em outra página do mesmo site (mesma nota)', Hm2.confianca >= Hm1.confianca - 4 && Hm2.confianca <= Hm1.confianca + 4 && Hm2.conferencia.some((l) => /22\.000\.000\/0001-00|sem relação societária/.test(l)), Hm1.confianca + '% e ' + Hm2.confianca + '%');
  // site novo (30 dias) com o mesmo CNPJ de outra empresa: continua em atenção forte
  const Hm3 = await av('hm-falsa.com.br', { ...tudo, pressao: true }, '22000000000100', '33000000000100', 30);
  chk('mesmo caso, mas site com 30 dias (CNPJ copiado?): atenção forte e nota baixa', Hm3.confianca < 50 && Hm3.contra.some((l) => /^Atenção:/.test(l)), Hm3.confianca + '%');
  // v3.18: escudos do Reclame Aqui entram na conta, da menor forma possível (5: +10, 4: +5, 3: neutro, 2: -5, 1: -10)
  vm.runInContext('consultarReclameAqui = async () => ({ ok: true, nota: self.__nota });', ctx);
  const nota = async (v, host) => { ctx.__nota = v; return (await av(host, { ...pouco }, '22000000000100', '22000000000100')).confianca; };
  const sem = await (async () => { ctx.__nota = undefined; return (await av('ra-sem.com.br', { ...pouco }, '22000000000100', '22000000000100')).confianca; })();
  const n5 = await nota(5, 'ra5.com.br'), n4 = await nota(4, 'ra4.com.br'), n3 = await nota(3, 'ra3.com.br'), n2 = await nota(2, 'ra2.com.br'), n1 = await nota(1, 'ra1.com.br');
  chk('Reclame Aqui 5 escudos: +10 pontos', n5 - sem === 10, sem + '% -> ' + n5 + '%');
  chk('Reclame Aqui 4 escudos: +5 pontos', n4 - sem === 5, n4 + '%');
  chk('Reclame Aqui 3 escudos: neutro (nem ganha nem perde)', n3 === sem, n3 + '%');
  chk('Reclame Aqui 2 escudos: -5 pontos', n2 - sem === -5, n2 + '%');
  chk('Reclame Aqui 1 escudo: -10 pontos', n1 - sem === -10, n1 + '%');
  ctx.__nota = 1; const r1ra = await av('ra1b.com.br', { ...pouco }, '22000000000100', '22000000000100');
  chk('nota baixa entra na lista vermelha', r1ra.contra.some((l) => /^Reclame Aqui: 1 escudo \(-10 pontos/.test(l)), r1ra.contra.find((l) => /Reclame/.test(l)));
  console.log(ok + '/' + n + ' como esperado');
  process.exitCode = ok === n ? 0 : 1;
})();
