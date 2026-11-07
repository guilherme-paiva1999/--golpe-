// Letras cirílicas: alfabetos.js e modelo.js dão o mesmo resultado que o Python (alfabetos.py, recursos.py)?
// Antes: python gerar_alfabetos.py
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console }; vm.createContext(ctx);
const arq = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
vm.runInContext(arq('alfabetos.js') + arq('modelo.js') + ';this.T={alfHost,alfTexto,mlRecursos};', ctx);
const am = JSON.parse(fs.readFileSync(path.join(__dirname, 'amostra_alfabetos.json'), 'utf8'));
let ok = 0, n = 0;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b) ||
  (Array.isArray(a) && a.length === b.length && a.every((v, i) => typeof v === 'number' ? Math.abs(v - b[i]) < 1e-9 : v === b[i]));
const conf = (nome, a, b) => { n++; const s = igual(a, b); ok += s; if (!s) console.log('ERRO', nome, JSON.stringify(a), '!=', JSON.stringify(b)); };
for (const c of am.hosts) {
  const a = ctx.T.alfHost(c.host);
  conf(c.host + ' alfabeto', [a.unicode, a.mistura, a.tudoParecido, a.esqueleto], [c.alf.unicode, c.alf.mistura, c.alf.tudoParecido, c.alf.esqueleto]);
  conf(c.host + ' cirilico', [a.cirilico], [c.alf.cirilico]);
  const tl = { ...am.tld }; delete tl.__padrao__;
  conf(c.host + ' características', ctx.T.mlRecursos(c.host, tl, am.tld.__padrao__).map(Number), c.x.map(Number));
}
for (const c of am.textos) {
  const a = ctx.T.alfTexto(c.t);
  conf(JSON.stringify(c.t.slice(0, 30)) + ' texto', [a.texto, a.mistas], [c.alf.texto, c.alf.mistas]);
  conf(JSON.stringify(c.t.slice(0, 30)) + ' cirilico', [a.cirilico], [c.alf.cirilico]);
}
// Casos que precisam dar certo, não só igual ao Python
const h = (x) => ctx.T.alfHost(x);
const esperado = [
  ['xn--80ak6aa92e.com vira apple.com', h('xn--80ak6aa92e.com').esqueleto === 'apple.com'],
  ['мвд.рф (russo de verdade) não é disfarce', h('xn--b1aew.xn--p1ai').mistura === 0 && h('xn--b1aew.xn--p1ai').tudoParecido === 0],
  ['Nеtfliх vira Netflix', ctx.T.alfTexto('Nеtfliх').texto === 'Netflix'],
  ['russo de verdade fica igual', ctx.T.alfTexto('Личный кабинет').texto === 'Личный кабинет'],
];
for (const [nome, b] of esperado) { n++; ok += b; if (!b) console.log('ERRO', nome); }
console.log(ok + '/' + n + ' iguais');
process.exitCode = ok === n ? 0 : 1;
