// Vídeo "Isso é golpe?" funcionando: aplicativo (celular) e extensão (Chrome), em ritmo calmo, com legendas.
// Gravação real: nada é injetado na decisão. A extensão e o aplicativo decidem sozinhos; as legendas só explicam.
// Os sites são fictícios (.example) e o link de banco falso não existe.
// Uso: node gravar.js PASTA_DE_SAIDA   (depois o ffmpeg converte para MP4; veja o README da pasta 5-video)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const EXT = path.resolve(__dirname, '../../1-extensao-codigo'), SITES = path.join(__dirname, 'sites');
const SAIDA = path.resolve(process.argv[2] || path.join(__dirname, 'bruto'));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const FONTES = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Open+Sans:wght@400;600;700&display=swap">';
const FUNDO = 'radial-gradient(ellipse at 70% 30%, #1f4d1d 0%, #0d260c 50%, #061506 100%)';
const tipos = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const SITE = { 'jornal-da-cidade.example': 'noticias.html', 'tenis-turbo-oferta.example': 'loja.html', 'global-gadgets.example': 'estrangeira.html' };

const PALCO = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Isso é golpe? · aplicativo</title>${FONTES}</head>
<body style="margin:0;height:100vh;background:${FUNDO};color:#e9f5e6;font-family:'Open Sans',Arial,sans-serif;display:flex;align-items:center;justify-content:center;gap:70px">
<div style="width:600px"><p style="font-family:Silkscreen,monospace;font-size:22px;color:#f2c230;margin:0 0 12px">1 · No celular</p>
<h1 style="font-family:Silkscreen,monospace;font-size:44px;color:#b1e4ab;margin:0 0 28px;text-shadow:0 0 16px rgba(91,227,106,.55)">O aplicativo</h1>
<p id="passo" style="font-size:30px;line-height:1.45;margin:0;min-height:180px"></p></div>
<div style="width:390px;height:660px;border-radius:38px;border:10px solid #1b1b1b;box-shadow:0 0 0 3px #5be36a,0 0 40px rgba(91,227,106,.4);overflow:hidden;background:#fff">
<iframe id="app" src="/app/verificar.html" style="width:100%;height:100%;border:0"></iframe></div>
<script>window.passo=(t)=>{document.getElementById('passo').innerHTML=t}</script></body></html>`;

const srv = http.createServer((q, r) => {
  const host = (q.headers.host || '').split(':')[0];
  const url = decodeURIComponent(q.url.split('?')[0]);
  let f = null;
  if (host === 'palco.example' && url === '/') { r.setHeader('content-type', tipos['.html']); return r.end(PALCO); }
  if (url.startsWith('/app/')) f = path.join(EXT, url.slice(5));
  else if (SITE[host]) f = path.join(SITES, SITE[host]);
  if (f && f.startsWith(EXT) || f && f.startsWith(SITES)) {
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { r.setHeader('content-type', tipos[path.extname(f)] || 'application/octet-stream'); return r.end(fs.readFileSync(f)); }
  }
  r.statusCode = 404; r.end('404');
}).listen(18790, '127.0.0.1');

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'eg-video-' + Date.now()), {
    headless: false, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1280, height: 720 },
    recordVideo: { dir: SAIDA, size: { width: 1280, height: 720 } },
    args: ['--headless=new', '--enable-unsafe-extension-debugging', '--lang=pt-BR', '--host-resolver-rules=MAP *.example 127.0.0.1:18790'] });
  if (!ctx.serviceWorkers().length) { const cdp = await ctx.browser().newBrowserCDPSession(); await cdp.send('Extensions.loadUnpacked', { path: EXT }); }
  await espera(3000);
  const sw = ctx.serviceWorkers()[0]; const id = sw.url().split('/')[2];
  await sw.evaluate(() => chrome.storage.local.set({ pessoaConfianca: { nome: 'Maria (filha)', telefone: '(11) 98765-4321' } }));
  const pg = await ctx.newPage();
  for (const p of ctx.pages()) if (p !== pg) await p.close().catch(() => {});   // fecha a aba de boas-vindas aberta na instalação
  const inicio = Date.now(); const marcas = {};
  const marca = (n) => { marcas[n] = (Date.now() - inicio) / 1000; };

  const cartao = (topo, titulo, sub) => pg.setContent(`<html lang="pt-BR"><head>${FONTES}</head><body style="margin:0;height:100vh;background:${FUNDO};color:#e9f5e6;font-family:'Open Sans',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center">
    <p style="font-family:Silkscreen,monospace;font-size:24px;color:#f2c230;margin:0">${topo}</p>
    <h1 style="font-family:Silkscreen,monospace;font-size:72px;color:#d9f5d4;margin:0;text-shadow:0 0 22px rgba(91,227,106,.7)">${titulo}</h1>
    <p style="font-size:30px;line-height:1.45;margin:0;max-width:980px">${sub}</p></body></html>`, { waitUntil: 'networkidle' }).catch(() => {});

  // Barra de endereço (a gravação não mostra a do navegador) e legenda grande embaixo.
  const legenda = (endereco, texto) => pg.evaluate(({ endereco, texto }) => {
    for (const i of ['v-barra', 'v-legenda']) document.getElementById(i)?.remove();
    const b = document.createElement('div'); b.id = 'v-barra';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;height:44px;z-index:2147483647;background:#dee1e6;display:flex;align-items:center;padding:0 16px;font:16px Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.25)';
    b.innerHTML = '<div style="flex:1;background:#fff;border-radius:16px;padding:7px 16px;color:#202124"></div>';
    b.firstChild.textContent = endereco;
    const l = document.createElement('div'); l.id = 'v-legenda';
    l.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(6,21,6,.95);border-top:4px solid #5be36a;color:#f2f7ee;font:600 27px/1.4 "Open Sans",Arial,sans-serif;padding:18px 40px;text-align:center';
    l.textContent = texto;
    document.documentElement.append(b, l);
  }, { endereco, texto }).catch(() => {});

  // ---------- Abertura ----------
  marca('inicio');
  await cartao('Feira do Empreendedor', 'Isso é golpe?', 'Veja o aplicativo e a extensão funcionando.<br>Tudo o que aparece é real; os sites são fictícios.');
  await espera(7000);
  await cartao('Parte 1', 'No celular', 'O aplicativo confere o link <b>antes</b> de você abrir.');
  await espera(5500);

  // ---------- Aplicativo ----------
  await pg.goto('http://palco.example/'); await espera(2500);
  const app = pg.frameLocator('#app');
  await pg.evaluate(() => passo('Chegou um link estranho por mensagem, dizendo para “atualizar o cadastro” do banco?<br><br>Antes de abrir, cole o link no aplicativo.'));
  await espera(6500);
  await app.locator('#link').click();
  await app.locator('#link').pressSequentially('http://nubank-atualizar-cadastro.xyz/login', { delay: 70 });
  await espera(1500);
  await pg.evaluate(() => passo('Agora é só tocar em <b>Verificar</b>.'));
  await espera(3000);
  await app.locator('#verificar').click();
  await app.locator('#telaResultado:not([hidden])').waitFor({ timeout: 30000 });
  await pg.evaluate(() => passo('Resultado: <b style="color:#ff8a7a">PERIGO</b>, 0% de confiança.<br><br>Para ser confiável, um site precisa de 90% ou mais.'));
  await espera(8000);
  await pg.evaluate(() => passo('Logo abaixo, o aplicativo diz <b>o que fazer</b>, em palavras simples: não abrir o link e não digitar senha nem cartão.'));
  await app.locator('#oQueFazer').scrollIntoViewIfNeeded(); await espera(8000);
  await pg.evaluate(() => passo('E explica <b>por quê</b>: o endereço imita o banco, mas o site oficial é outro.'));
  await app.locator('#motivos').scrollIntoViewIfNeeded(); await espera(8000);

  // ---------- Extensão ----------
  await cartao('Parte 2', 'No computador', 'A extensão do Chrome confere sozinha as páginas que pedem dinheiro: loja, Pix e pagamento.');
  await espera(6000);
  await pg.goto(`chrome-extension://${id}/boas-vindas.html`); await espera(1500);
  await legenda('Extensão Isso é golpe? · boas-vindas', 'Na instalação, a pessoa escolhe como prefere usar a extensão.');
  await espera(6000);
  await pg.locator('input[value=idoso]').check(); await espera(1200);
  await legenda('Extensão Isso é golpe? · boas-vindas', 'Para quem tem dificuldade com a internet: letras grandes, aviso em voz alta e uma pessoa de confiança.');
  await espera(7500);

  await pg.goto('http://jornal-da-cidade.example/'); await espera(5000);
  await legenda('jornal-da-cidade.example', 'Num site de notícia, a extensão fica quieta, mesmo com preços em R$ no texto. Ela só age onde tem compra ou pagamento.');
  await espera(9000);

  await pg.goto('http://tenis-turbo-oferta.example/').catch(() => {});
  await espera(9000);
  const bloqueou = pg.url().includes('bloqueado.html');
  console.log('loja ->', bloqueou ? 'bloqueada' : 'abriu');
  await legenda('tenis-turbo-oferta.example', 'Uma loja com 80% de desconto, “últimas unidades” e pedindo cartão, mas sem CNPJ: bloqueada antes de a pessoa digitar o cartão.');
  await espera(9000);
  await legenda('tenis-turbo-oferta.example', 'A confiança aparece em porcentagem, e os motivos, em palavras simples.');
  await pg.mouse.wheel(0, 200); await espera(8000);
  await legenda('tenis-turbo-oferta.example', 'Na dúvida, um clique pergunta para a pessoa de confiança pelo WhatsApp. Outro abre o Reclame Aqui com o site já preenchido.');
  await pg.locator('#perguntar').hover().catch(() => {}); await espera(9000);

  await pg.goto('http://global-gadgets.example/').catch(() => {});
  await espera(9000);
  console.log('estrangeira ->', pg.url().includes('bloqueado.html') ? 'bloqueada' : 'abriu');
  await legenda('global-gadgets.example', 'Loja estrangeira, sem CNPJ: aviso próprio. Ela está fora dos nossos cuidados, mas mostramos o que conseguimos ver.');
  await espera(10000);

  // ---------- Fechamento ----------
  await cartao('Isso é golpe?', 'Pergunte antes de clicar', 'Aplicativo no celular e extensão no computador, trabalhando juntos.');
  await espera(7000);
  marca('fim');
  const video = pg.video();
  await ctx.close(); srv.close();
  const arquivo = await video.path();
  fs.writeFileSync(path.join(SAIDA, 'marcas.json'), JSON.stringify({ arquivo, marcas }));
  console.log('vídeo bruto:', arquivo, JSON.stringify(marcas));
})();
