// Testa só a lógica da regra "loja sem CNPJ ativo é bloqueada" (v3.6). As consultas (registro.br e BrasilAPI) são simuladas.
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {}, ev = { addListener: noop };
const chrome = { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop }, alarms: { get: async () => ({}), create: noop, onAlarm: ev },
  webNavigation: { onBeforeNavigate: ev }, storage: { local: { get: async () => ({}), set: async () => {} }, session: { get: async () => ({}), set: async () => {} } }, action: {} };
const ctx = { chrome, console, AbortSignal, URL, TextDecoder, fetch: async () => { throw 0; } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../alfabetos.js'),'utf8')+fs.readFileSync(path.join(__dirname,'../background.js'),'utf8') + ';this.T={avaliarPagina,situacaoCnpj};' +
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
  n++; const blog = await T.avaliarPagina('blog-qualquer.com', 'https:', { senha: true });
  const bomBlog = blog.nivel !== 'perigo' && blog.cnpj === undefined; ok += bomBlog;
  console.log((bomBlog ? 'OK  ' : 'ERRO'), 'página sem venda nem pagamento: a regra não vale'.padEnd(58), blog.nivel);
  console.log(ok + '/' + n + ' como esperado');
})();
