// Teste real: carrega a extensão no Google Chrome e percorre boas-vindas, bloqueio, aviso na página e popup.
// Uso (dentro de teste-real/):  npm install   e depois   node testar.js
// Opcional: node testar.js CAMINHO_DA_EXTENSAO PASTA_DAS_CAPTURAS   e a variável CHROME com o caminho do Chrome.
// Precisa de internet (RDAP, BrasilAPI e listas de golpes). Usa um perfil temporário: não mexe no seu Chrome.
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const EXT = path.resolve(process.argv[2] || path.join(__dirname, '..', '1-extensao-codigo'));
const SAIDA = path.resolve(process.argv[3] || path.join(__dirname, 'capturas'));
const CHROME = process.env.CHROME || {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: '/usr/bin/google-chrome'
}[process.platform];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(SAIDA, { recursive: true });
const foto = (pg, n) => pg.screenshot({ path: path.join(SAIDA, n + '.png'), fullPage: true });
let falhas = 0;
const conferir = (nome, cond, extra) => { console.log((cond ? 'OK   ' : 'FALHA ') + nome + (extra ? ' -> ' + extra : '')); if (!cond) falhas++; };

(async () => {
  const TESTE = path.join(EXT, 'teste');
  const srv = http.createServer((q, r) => {
    const f = path.join(TESTE, path.basename(q.url.split('?')[0]) || 'index.html');
    if (fs.existsSync(f)) { r.setHeader('content-type', 'text/html;charset=utf-8'); r.end(fs.readFileSync(f)); } else { r.statusCode = 404; r.end('404'); }
  }).listen(18765, '127.0.0.1');

  const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'egolpe-e2e-' + Date.now()), {
    executablePath: CHROME, headless: false, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1100, height: 900 },
    args: ['--headless=new', '--enable-unsafe-extension-debugging',
      '--host-resolver-rules=MAP *.example 127.0.0.1:18765']
  });
  let id = null;
  if (!ctx.serviceWorkers().length) {
    const cdp = await ctx.browser().newBrowserCDPSession();
    id = (await cdp.send('Extensions.loadUnpacked', { path: EXT })).id;
  }
  await espera(3000);
  if (ctx.serviceWorkers()[0]) id = ctx.serviceWorkers()[0].url().split('/')[2];
  console.log('extensão', id);

  // 1) Boas-vindas abre sozinha na instalação
  let bv = null;
  for (let i = 0; i < 20 && !bv; i++) { bv = ctx.pages().find((p) => p.url().includes('boas-vindas.html')); if (!bv) await espera(300); }
  conferir('boas-vindas abre na instalação', !!bv);
  if (!bv) { bv = await ctx.newPage(); await bv.goto(`chrome-extension://${id}/boas-vindas.html`); }
  await bv.waitForLoadState('domcontentloaded');
  await foto(bv, '1-boas-vindas');
  await bv.check('input[value=idoso]');
  await bv.check('input[value=daltonico]');
  await bv.click('#ir2');
  conferir('idoso liga letras grandes e voz', await bv.isChecked('#modoSimples') && await bv.isChecked('#vozAutomatica'));
  conferir('daltônico liga cores', await bv.isChecked('#daltonico'));
  await bv.uncheck('#vozAutomatica');               // sem voz no teste
  await foto(bv, '2-ajustes');
  await bv.click('#ir3');
  conferir('aviso "recomendado" para idoso', await bv.isVisible('#avisoIdoso'));
  await bv.click('#salvar');
  conferir('não salva sem nome', (await bv.textContent('#erro3')).includes('nome'));
  await bv.fill('#nome', 'Maria (filha)');
  await bv.fill('#telefone', '(11) 98765-4321');
  await foto(bv, '3-pessoa');
  await bv.click('#salvar');
  await bv.waitForSelector('#passo4:not([hidden])');
  await foto(bv, '4-pronto');
  const guardado = await bv.evaluate(() => chrome.storage.local.get(['config', 'pessoaConfianca']));
  conferir('config salva', guardado.config.modoSimples === true && guardado.config.daltonico === true && guardado.config.perfis.join() === 'idoso,daltonico', JSON.stringify(guardado.config));
  conferir('pessoa salva', guardado.pessoaConfianca.nome === 'Maria (filha)', JSON.stringify(guardado.pessoaConfianca));

  // 2) Bloqueio real antes de abrir
  const pg = await ctx.newPage();
  await pg.goto('http://nubank-atualizar-cadastro.xyz/login').catch(() => {});
  await pg.waitForURL(/bloqueado\.html/, { timeout: 15000 }).catch(() => {});
  conferir('bloqueia antes de abrir', pg.url().includes('bloqueado.html'), pg.url());
  await pg.waitForSelector('#confNum');
  const t0 = Date.now();
  await pg.waitForFunction(() => /^\d+%$/.test(document.getElementById('confNum').textContent), null, { timeout: 30000 }).catch(() => {});
  conferir('porcentagem aparece na hora (< 1,5 s)', Date.now() - t0 < 1500, (Date.now() - t0) + ' ms');
  conferir('sem texto de "verificando/carregando"', !/verificando|carregando|conferindo/i.test(await pg.textContent('main')));
  conferir('frase "acima de 80%"', (await pg.textContent('#resumo')).includes('acima de 80%'), await pg.textContent('#resumo'));
  await espera(6000);
  const conf = await pg.textContent('#confNum');
  conferir('mostra confiança em %', /^\d+%$/.test(conf), conf);
  conferir('botão perguntar para Maria', (await pg.isVisible('#perguntar')) && (await pg.textContent('#perguntarTxt')).includes('Maria'));
  const ra = await pg.$eval('#ra', (b) => b.getBoundingClientRect().height);
  conferir('botão do Reclame Aqui com altura boa (>= 56px)', ra >= 56, Math.round(ra) + 'px');
  const itens = await pg.$$eval('#verif li', (l) => l.map((x) => x.textContent));
  conferir('verificação completa com 7 itens', itens.length === 7, '\n      ' + itens.join('\n      '));
  conferir('modo daltônico na tela', await pg.$eval('body', (b) => b.classList.contains('daltonico')));
  const motivos = await pg.$$eval('#motivos li', (l) => l.map((x) => x.textContent));
  console.log('      motivos:', motivos.join(' | '));
  await foto(pg, '5-bloqueio');
  await pg.evaluate(async () => { const { config } = await chrome.storage.local.get('config'); await chrome.storage.local.set({ config: { ...config, daltonico: false, modoSimples: false } }); });
  await pg.reload(); await espera(5000);
  await pg.setViewportSize({ width: 1100, height: 900 });
  await foto(pg, '5b-bloqueio-vermelho');
  await pg.screenshot({ path: path.join(SAIDA, '5c-bloqueio-tela.png') });
  await pg.setViewportSize({ width: 390, height: 844 });
  await foto(pg, '5d-bloqueio-celular');
  await pg.setViewportSize({ width: 1100, height: 900 });
  // o link do WhatsApp sai certo
  const urlsAbertas = [];
  ctx.on('request', (q) => { if (/wa\.me|whatsapp/.test(q.url())) urlsAbertas.push(q.url()); });
  await pg.click('#perguntar');
  await espera(4000);
  const nova = ctx.pages().find((p) => /wa\.me|whatsapp/.test(p.url()));
  const linkWhats = urlsAbertas[0] || (nova ? nova.url() : '');
  conferir('WhatsApp com número e link do site', linkWhats.includes('5511987654321') && decodeURIComponent(linkWhats).includes('nubank-atualizar-cadastro.xyz'), linkWhats.slice(0, 120));
  if (nova) await nova.close();

  // 3) Aviso dentro de uma página (loja golpista de teste)
  const loja = await ctx.newPage();
  await loja.goto('http://loja-teste.example/loja-sem-provas.html');
  await espera(6000);
  const temAviso = loja.url().includes('bloqueado.html') || await loja.evaluate(() => !!document.querySelector('[data-pg]'));
  conferir('aviso aparece na loja de teste', temAviso);
  await foto(loja, '6-aviso-loja');
  if (loja.url().includes('bloqueado.html')) console.log('      (a loja foi bloqueada direto)');

  // 4) Verificação completa com dados reais (RDAP + BrasilAPI + consumidor.gov.br)
  for (const u of ['https://www.kabum.com.br/', 'https://www.magazineluiza.com.br/']) {
    const v = await bv.evaluate((u) => chrome.runtime.sendMessage({ tipo: 'investigar', url: u }), u);
    console.log('      ' + u + ' confiança ' + (v && v.confianca) + '%\n        ' + (v ? v.itens.map((i) => i.efeito + ': ' + i.titulo + ' - ' + i.texto).join('\n        ') : 'sem resposta'));
  }

  // 4b) Aviso de perigo dentro de uma página comum (modo de teste) com a logo do Reclame Aqui
  const normal = await ctx.newPage();
  await normal.goto('http://loja-teste.example/blog.html');
  await espera(2500);
  await normal.bringToFront();
  await bv.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); await chrome.tabs.sendMessage(t.id, { tipo: 'demo', nivel: 'perigo' }); });
  await espera(1500);
  await normal.bringToFront();
  await foto(normal, '8-aviso-pagina');
  const logoOk = await normal.evaluate(() => new Promise((r) => setTimeout(() => r(performance.getEntriesByType('resource').some((e) => e.name.includes('reclameaqui.png'))), 500)));
  console.log('      logo pedida na página:', logoOk);
  const logoBloq = await pg.$eval('#ra img', (i) => i.complete && i.naturalWidth > 0);
  conferir('logo do Reclame Aqui carregou na tela de bloqueio', logoBloq);
  const corRA = await pg.$eval('#ra', (b) => getComputedStyle(b).backgroundColor);
  conferir('botão do Reclame Aqui verde', corRA === 'rgb(5, 103, 52)', corRA);

  // 5) Popup (como página) no modo simples
  const pop = await ctx.newPage();
  await pop.setViewportSize({ width: 420, height: 900 });
  await pop.goto(`chrome-extension://${id}/popup.html`);
  await espera(1500);
  conferir('popup tem botão de acessibilidade', await pop.isVisible('#btnAcess'));
  await foto(pop, '7-popup');

  // 6) Fonte retirada: OpenPhish não existe mais no banco
  const lojas = await bv.evaluate(() => new Promise((r) => { const q = indexedDB.open('protetor'); q.onsuccess = () => r([...q.result.objectStoreNames]); }));
  conferir('OpenPhish retirado das listas', !lojas.includes('openphish'), lojas.join(','));
  const ia = (await bv.evaluate(() => chrome.runtime.sendMessage({ tipo: 'investigar', url: 'https://nubank-atualizar-cadastro.xyz/' }))).itens.find((i) => i.titulo === 'Inteligência artificial');
  conferir('modelo de ML ligado na extensão', ia && ia.efeito === 'contra', ia && ia.texto);

  console.log(falhas ? falhas + ' FALHA(S)' : 'tudo certo');
  await ctx.close(); srv.close();
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
