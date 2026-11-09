// v3.16: leitura do veredito público do Reclame Aqui (dados estruturados da página do Detector). Só testa a leitura, sem rede.
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {}, ev = { addListener: noop };
const chrome = { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop }, alarms: { get: async () => ({}), create: noop, onAlarm: ev },
  webNavigation: { onBeforeNavigate: ev }, storage: { local: { get: async () => ({}), set: async () => {} }, session: { get: async () => ({}), set: async () => {} } }, action: {} };
const ctx = { chrome, console, AbortSignal, URL, TextDecoder, fetch: async () => { throw 0; } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../alfabetos.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8') + ';this.T={lerVereditoRA};', ctx);
const T = ctx.T;
const pagina = (host, nota, autor = 'Reclame AQUI') => '<html><head><script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'Organization', name: 'Empresa' },
  { '@type': 'Review', itemReviewed: { '@type': 'WebSite', url: 'https://' + host }, reviewRating: { '@type': 'Rating', ratingValue: nota, bestRating: 5, worstRating: 0, alternateName: 'x' },
    author: { '@type': 'Organization', name: autor }, datePublished: '2026-11-05T03:37:21Z' }] }) + '</script></head><body>Ainda faltam dados</body></html>';
let ok = 0, n = 0;
const t = (nome, obtido, esperado) => { n++; const b = JSON.stringify(obtido) === JSON.stringify(esperado); ok += b; console.log((b ? 'OK  ' : 'ERRO'), nome.padEnd(60), JSON.stringify(obtido)); };
t('Magazine Luiza: 5 escudos, Confiável', T.lerVereditoRA(pagina('magazineluiza.com.br', 5), 'magazineluiza.com.br'), { nota: 5, rotulo: 'Confiável', data: '2026-11-05' });
t('KaBuM: 4 escudos, Provavelmente confiável', T.lerVereditoRA(pagina('kabum.com.br', 4), 'kabum.com.br').rotulo, 'Provavelmente confiável');
t('nota baixa (1)', T.lerVereditoRA(pagina('golpe.shop', 1), 'golpe.shop').rotulo, 'Não confiável');
t('www. no endereço do veredito é aceito', T.lerVereditoRA(pagina('www.loja.com.br', 5), 'loja.com.br').nota, 5);
t('veredito de OUTRO site é ignorado', T.lerVereditoRA(pagina('outro.com.br', 5), 'loja.com.br'), null);
t('veredito que não é do Reclame Aqui é ignorado', T.lerVereditoRA(pagina('loja.com.br', 5, 'Site qualquer'), 'loja.com.br'), null);
t('nota fora de 0 a 5 é ignorada', T.lerVereditoRA(pagina('loja.com.br', 9), 'loja.com.br'), null);
t('página de "analisando" (sem veredito)', T.lerVereditoRA('<html><body>Analisando o site... Etapa 1 de 5</body></html>', 'loja.com.br'), null);
t('JSON quebrado não derruba', T.lerVereditoRA('<script type="application/ld+json">{quebrado</script>', 'loja.com.br'), null);
console.log(ok + '/' + n + ' como esperado');
process.exitCode = ok === n ? 0 : 1;
