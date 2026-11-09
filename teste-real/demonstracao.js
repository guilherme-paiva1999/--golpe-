// Demonstração: abre um Google Chrome VISÍVEL com a extensão carregada e deixa aberto para você mexer.
// Uso (dentro de teste-real/):  node demonstracao.js      (feche a janela do Chrome para encerrar)
// Usa um perfil temporário: não mexe no seu Chrome. Precisa de internet para as listas de golpes e consultas.
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const EXT = path.resolve(path.join(__dirname, '..', '1-extensao-codigo'));
const CHROME = process.env.CHROME || {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: '/usr/bin/google-chrome'
}[process.platform];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const TESTE = path.join(EXT, 'teste');
  http.createServer((q, r) => {
    const f = path.join(TESTE, path.basename(q.url.split('?')[0]) || 'index.html');
    if (fs.existsSync(f)) { r.setHeader('content-type', 'text/html;charset=utf-8'); r.end(fs.readFileSync(f)); } else { r.statusCode = 404; r.end('404'); }
  }).listen(18766, '127.0.0.1');

  const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'egolpe-demo-' + Date.now()), {
    executablePath: CHROME, headless: false, ignoreDefaultArgs: ['--disable-extensions'], viewport: null,
    args: ['--enable-unsafe-extension-debugging', '--start-maximized']
  });
  const cdp = await ctx.browser().newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: EXT });
  console.log('Extensão carregada:', id);
  await espera(3000);

  // Abas da demonstração (a de boas-vindas abre sozinha na instalação)
  const abre = async (url) => { const p = await ctx.newPage(); await p.goto(url).catch(() => {}); return p; };
  await abre('http://127.0.0.1:18766/golpe-loja.html');
  await abre('http://127.0.0.1:18766/index.html');
  await abre('http://nubank-atualizar-cadastro.xyz/login');
  console.log('Pronto. Feche a janela do Chrome para encerrar.');
  await new Promise((r) => ctx.on('close', r));
  process.exit(0);
})();
