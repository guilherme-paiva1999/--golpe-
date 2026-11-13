// Testa a atualização das listas de golpes (v3.20): só baixa quando a lista mudou (ETag), grava só a diferença
// e nunca deixa um golpe que continua na lista sem bloqueio no meio da atualização. Usa um banco simulado (fake-indexeddb).
// Uso: cd teste-real && npm install && node testar_listas.js
require('fake-indexeddb/auto');
const fs = require('fs'), vm = require('vm'), path = require('path');
const pasta = path.join(__dirname, '../1-extensao-codigo');

const guardado = {};                                    // chrome.storage.local simulado
const area = { get: async (k) => { const r = {}; for (const c of [].concat(k)) if (c in guardado) r[c] = JSON.parse(JSON.stringify(guardado[c])); return r; },
  set: async (o) => { Object.assign(guardado, JSON.parse(JSON.stringify(o))); } };
const noop = () => {}, ev = { addListener: noop };
const chrome = { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop, getManifest: () => ({ update_url: 'x' }) },
  alarms: { get: async () => ({}), create: noop, onAlarm: ev }, webNavigation: { onBeforeNavigate: ev },
  storage: { local: area, session: { get: async () => ({}), set: async () => {} } }, action: {} };

// servidor simulado: cada fonte tem um texto e um ETag; registra o que foi pedido
const servidor = { phishing: { texto: '', etag: '"v1"' } };
const pedidos = [];
async function fetchFalso(url, op = {}) {
  const nome = url.includes('Phishing.Database') ? 'phishing' : null;
  const enviada = op.headers && op.headers['If-None-Match'];
  pedidos.push({ nome, etag: enviada || null });
  if (!nome) return { status: 410, ok: false, headers: { get: () => null }, text: async () => '' };
  const s = servidor[nome];
  if (enviada && enviada === s.etag) return { status: 304, ok: false, headers: { get: () => null }, text: async () => '' };
  return { status: 200, ok: true, headers: { get: (h) => (h.toLowerCase() === 'etag' ? s.etag : null) }, text: async () => s.texto };
}

const ctx = { chrome, console: { ...console, warn: noop }, AbortSignal, URL, TextDecoder, fetch: fetchFalso, indexedDB, setInterval, clearInterval, setTimeout, Date, Math };
ctx.self = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(pasta, 'alfabetos.js'), 'utf8') + fs.readFileSync(path.join(pasta, 'background.js'), 'utf8') +
  ';this.T={atualizarListas,estaNaLista,abrirDB,aparar,chavesDaFonte}', ctx);
const T = ctx.T;

// espiona as gravações e remoções no banco
const gravados = [], removidos = [];
const IDBObjectStoreProto = globalThis.IDBObjectStore.prototype;
const putOriginal = IDBObjectStoreProto.put, delOriginal = IDBObjectStoreProto.delete;
IDBObjectStoreProto.put = function (v, k) { gravados.push(k); return putOriginal.call(this, v, k); };
IDBObjectStoreProto.delete = function (k) { removidos.push(k); return delOriginal.call(this, k); };

let ok = 0, n = 0;
const t = (nome, v, e) => { n++; const b = JSON.stringify(v) === JSON.stringify(e); ok += b; console.log((b ? 'OK  ' : 'ERRO'), nome.padEnd(66), JSON.stringify(v)); };
const lista = (k) => Array.from({ length: k }, (_, i) => 'golpe' + i + '.example');

(async () => {
  // 1) primeira vez: baixa tudo
  servidor.phishing = { texto: lista(300).join('\n'), etag: '"v1"' };
  await T.atualizarListas(['phishing']);
  const db = await T.abrirDB();
  t('1ª atualização: grava os 300 sites', (await T.chavesDaFonte(db, 'phishing')).length, 300);
  t('1ª atualização: pede sem ETag (ainda não tinha)', pedidos.at(-1).etag, null);
  t('guarda o ETag da lista', guardado.listasEtag && guardado.listasEtag.phishing, '"v1"');
  t('golpe da lista é encontrado', await T.estaNaLista('golpe7.example'), 'phishing');
  t('subdomínio de golpe da lista é encontrado', await T.estaNaLista('www.golpe7.example'), 'phishing');

  // 2) lista não mudou: servidor responde 304, nada é gravado
  gravados.length = 0; removidos.length = 0;
  await T.atualizarListas(['phishing']);
  t('2ª atualização: pergunta "mudou?" com o ETag', pedidos.at(-1).etag, '"v1"');
  t('lista igual: nada gravado nem removido', [gravados.length, removidos.length], [0, 0]);
  t('lista igual: os 300 continuam', (await T.chavesDaFonte(db, 'phishing')).length, 300);

  // 3) lista mudou: entram 2, sai 1; só a diferença é gravada
  gravados.length = 0; removidos.length = 0;
  servidor.phishing = { texto: [...lista(300).filter((d) => d !== 'golpe5.example'), 'novo1.example', 'novo2.example'].join('\n'), etag: '"v2"' };
  await T.atualizarListas(['phishing']);
  t('lista mudou: grava só os 2 novos', gravados.sort(), ['novo1.example', 'novo2.example']);
  t('lista mudou: remove só o que saiu', removidos, ['golpe5.example']);
  t('o que saiu deixa de ser encontrado', await T.estaNaLista('golpe5.example'), false);
  t('o que entrou passa a ser encontrado', await T.estaNaLista('novo2.example'), 'phishing');
  t('golpe que continuou nunca foi removido (sem buraco)', removidos.includes('golpe7.example'), false);
  t('ETag novo guardado', guardado.listasEtag.phishing, '"v2"');

  // 4) banco apagado, mas o ETag ficou guardado: baixa de novo inteiro (não confia no 304)
  await new Promise((r) => { const tx = db.transaction('phishing', 'readwrite'); tx.objectStore('phishing').clear(); tx.oncomplete = r; });
  await T.atualizarListas(['phishing']);
  t('banco vazio: pede sem ETag', pedidos.at(-1).etag, null);
  t('banco vazio: lista refeita (301 sites)', (await T.chavesDaFonte(db, 'phishing')).length, 301);

  // 5) lista que veio quebrada (muito pequena) não apaga a lista boa
  servidor.phishing = { texto: 'so-um.example', etag: '"v3"' };
  await T.atualizarListas(['phishing']);
  t('lista suspeita (muito pequena) não substitui a boa', (await T.chavesDaFonte(db, 'phishing')).length, 301);
  t('e o ETag dela não é guardado', guardado.listasEtag.phishing, '"v2"');

  // 6) aparar: tira só os mais antigos
  const c = {}; for (let i = 0; i < 12; i++) c['k' + i] = { t: i };
  T.aparar(c, 10);
  t('aparar: passou de 10, fica com 8 (os mais novos)', Object.keys(c).sort(), ['k10', 'k11', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9']);
  const d = { a: { t: 1 } }; T.aparar(d, 10);
  t('aparar: abaixo do limite não mexe', Object.keys(d), ['a']);

  console.log(ok + '/' + n + ' como esperado');
  process.exit(ok === n ? 0 : 1);
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
