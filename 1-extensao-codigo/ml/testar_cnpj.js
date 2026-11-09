// Testa só a lógica da regra "loja sem CNPJ ativo é bloqueada" (v3.6). As consultas (registro.br e BrasilAPI) são simuladas.
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {}, ev = { addListener: noop };
const chrome = { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop }, alarms: { get: async () => ({}), create: noop, onAlarm: ev },
  webNavigation: { onBeforeNavigate: ev }, storage: { local: { get: async () => ({}), set: async () => {} }, session: { get: async () => ({}), set: async () => {} } }, action: {} };
const ctx = { chrome, console, AbortSignal, URL, TextDecoder, fetch: async () => { throw 0; } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../alfabetos.js'),'utf8')+fs.readFileSync(path.join(__dirname,'../background.js'),'utf8') + ';this.T={avaliarPagina,situacaoCnpj,conferenciaCnpj,oficialDaMarca};' +
  'estaNaLista=async()=>false;' +
  'consultarRdap=async(d)=>(self.__rdap[d]||{dias:2000,cnpj:null,pf:false});' +
  'consultarCnpj=async(c)=>(c in self.__cnpj?self.__cnpj[c]:null);', Object.assign(ctx, { self: ctx }));
ctx.__cnpj = { '11222333000181': { existe: true, ativa: true, situacao: 'ATIVA', abertura: '2015-01-01' },
  '99888777000166': { existe: true, ativa: false, situacao: 'BAIXADA', abertura: '2010-01-01' } };   // '55444333000122': sem resposta
ctx.__rdap = { 'empresa.com.br': { dias: 2000, cnpj: '11222333000181', pf: false }, 'pessoa.com.br': { dias: 2500, cnpj: null, pf: true } };
const T = ctx.T;
const loja = (o) => Object.assign({ venda: true, pagamento: true, contato: true, politicas: true, cnpjValido: false, cnpj: '' }, o);
let ok = 0, n = 0;
const t = async (nome, host, sinais, espNivel, espCnpj) => {
  n++; const r = await T.avaliarPagina(host, 'https:', sinais);
  const bom = r.nivel === espNivel && r.cnpj === espCnpj; ok += bom;
  console.log((bom ? 'OK  ' : 'ERRO'), nome.padEnd(58), r.nivel.padEnd(8), String(r.cnpj).padEnd(13), r.confianca + '%');
};
(async () => {
  await t('loja com CNPJ ativo na página', 'loja.com.br', loja({ cnpjValido: true, cnpj: '11222333000181', gateway: true }), 'ok', 'ativo');
  await t('loja sem CNPJ na página, registro.br em nome de empresa', 'empresa.com.br', loja({ gateway: true }), 'ok', 'ativo');
  await t('loja sem CNPJ, site em nome de pessoa física', 'pessoa.com.br', loja({ gateway: true, brasil: true }), 'perigo', 'nenhum');
  await t('loja .com sem CNPJ, com preços em R$ (voltada ao Brasil)', 'lojinha.com', loja({ gateway: true, brasil: true }), 'perigo', 'nenhum');
  await t('loja estrangeira: .com, sem CNPJ, sem R$ nem português', 'shop-abroad.com', loja({ gateway: true }), 'perigo', 'estrangeira');
  await t('loja .com.br sem CNPJ e sem R$ não é "estrangeira"', 'pessoa.com.br', loja({ gateway: true }), 'perigo', 'nenhum');
  await t('loja com CNPJ baixado na Receita', 'loja2.com.br', loja({ cnpjValido: true, cnpj: '99888777000166', gateway: true }), 'perigo', 'irregular');
  await t('BrasilAPI sem resposta: a regra não bloqueia', 'loja3.com.br', loja({ cnpjValido: true, cnpj: '55444333000122', gateway: true }), 'ok', 'sem-resposta');
  // v3.15: conferência automática do CNPJ, CNPJ da página x dono do domínio, site oficial e site internacional
  const chk = (nome, cond) => { n++; ok += !!cond; console.log((cond ? 'OK  ' : 'ERRO'), nome); };
  const r1 = await T.avaliarPagina('loja.com.br', 'https:', loja({ cnpjValido: true, cnpj: '11222333000181', gateway: true }));
  chk('aviso traz a conferência do CNPJ feita pela extensão', r1.conferencia && /conferido na Receita Federal/.test(r1.conferencia[0]));
  chk('conferência mostra o CNPJ com pontos e barra', /11\.222\.333\/0001-81/.test(r1.conferencia[0]));
  const r2 = await T.avaliarPagina('empresa.com.br', 'https:', loja({ cnpjValido: true, cnpj: '99888777000166', gateway: true }));
  chk('CNPJ da página diferente do dono do domínio: avisa', r2.conferencia.some((l) => /não é o da empresa dona do endereço/.test(l)) && r2.motivos.some((m) => /não é o da empresa dona/.test(m)));
  const r3 = await T.avaliarPagina('empresa.com.br', 'https:', loja({ gateway: true }));
  chk('sem CNPJ na página, usa o do registro.br sem acusar diferença', !r3.conferencia.some((l) => /não é o da empresa/.test(l)));
  const r4 = await T.avaliarPagina('shop-abroad.com', 'https:', loja({ gateway: true, brasil: true, cnpjValido: true, cnpj: '11222333000181' }));
  chk('site .com com CNPJ e R$: não bloqueia, mas avisa que é internacional (atenção)', r4.nivel === 'atencao' && r4.internacional && r4.motivos.some((m) => /site internacional/.test(m)));
  chk('loja .com.br não recebe o aviso de internacional', !r1.internacional && !r1.motivos.some((m) => /site internacional/.test(m)));
  // rodapé com vários CNPJs: vale o do dono do domínio (ex.: loja + financeira do cartão da loja)
  ctx.__cnpj['44555666000133'] = { existe: true, ativa: true, situacao: 'ATIVA', abertura: '2000-01-01', atividade: 'Comércio varejista', cnaes: ['4753900'] };
  ctx.__cnpj['11222333000181'].cnaes = ['6491300']; ctx.__cnpj['11222333000181'].atividade = 'Sociedades de crédito, financiamento e investimento';
  ctx.__rdap['loja-grande.com.br'] = { dias: 6000, cnpj: '44555666000133', pf: false };
  const r5 = await T.avaliarPagina('loja-grande.com.br', 'https:', loja({ cnpjValido: true, cnpj: '11222333000181', cnpjs: ['11222333000181', '44555666000133'], gateway: true }));
  chk('rodapé com CNPJ da financeira e da loja: usa o do dono do domínio', r5.conferencia[0].includes('44.555.666/0001-33') && !r5.motivos.some((m) => /atividade de comércio/.test(m)));
  chk('mesmo caso: não acusa diferença de CNPJ', !r5.conferencia.some((l) => /não é o da empresa/.test(l)));
  const o = T.oficialDaMarca('nubank-atualizar.xyz', [], 'nubank-atualizar.xyz');
  chk('marca imitada pelo endereço: oferece o site oficial', o && o.host === 'nubank.com.br');
  const o2 = T.oficialDaMarca('login-qualquer.com', ['itau'], 'login-qualquer.com');
  chk('marca citada na página de senha: oferece o site oficial', o2 && o2.host === 'itau.com.br');
  chk('site da própria marca não recebe botão de site oficial', T.oficialDaMarca('www.itau.com.br', ['itau'], 'itau.com.br') === null);
  n++; const blog = await T.avaliarPagina('blog-qualquer.com', 'https:', { senha: true });
  const bomBlog = blog.nivel !== 'perigo' && blog.cnpj === undefined; ok += bomBlog;
  console.log((bomBlog ? 'OK  ' : 'ERRO'), 'página sem venda nem pagamento: a regra não vale'.padEnd(58), blog.nivel);
  console.log(ok + '/' + n + ' como esperado');
})();
