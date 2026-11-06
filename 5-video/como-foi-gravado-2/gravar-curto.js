// Vídeo curto: só a extensão funcionando, num site real (www.sppy.site), que promete espionar o Instagram de qualquer pessoa.
// Gravação real: a extensão decide sozinha; as legendas só explicam o que aparece.
// Uso: node gravar-curto.js PASTA_DE_SAIDA
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const EXT = path.resolve(__dirname, '../../1-extensao-codigo');
const SAIDA = path.resolve(process.argv[2] || path.join(__dirname, 'bruto-curto'));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const FONTES = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Open+Sans:wght@400;600;700&display=swap">';
const FUNDO = 'radial-gradient(ellipse at 70% 30%, #1f4d1d 0%, #0d260c 50%, #061506 100%)';
const SITE = 'https://www.sppy.site/';

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'eg-curto-' + Date.now()), {
    headless: false, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1280, height: 720 },
    recordVideo: { dir: SAIDA, size: { width: 1280, height: 720 } },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    args: ['--headless=new', '--enable-unsafe-extension-debugging', '--lang=pt-BR'] });
  if (!ctx.serviceWorkers().length) { const cdp = await ctx.browser().newBrowserCDPSession(); await cdp.send('Extensions.loadUnpacked', { path: EXT }); }
  await espera(3000);
  const sw = ctx.serviceWorkers()[0];
  await sw.evaluate(() => chrome.storage.local.set({ pessoaConfianca: { nome: 'Maria (filha)', telefone: '(11) 98765-4321' } }));
  const pg = await ctx.newPage();
  for (const p of ctx.pages()) if (p !== pg) await p.close().catch(() => {});

  const cartao = (topo, titulo, sub) => pg.setContent(`<html lang="pt-BR"><head>${FONTES}</head><body style="margin:0;height:100vh;background:${FUNDO};color:#e9f5e6;font-family:'Open Sans',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;text-align:center">
    <p style="font-family:Silkscreen,monospace;font-size:24px;color:#f2c230;margin:0">${topo}</p>
    <h1 style="font-family:Silkscreen,monospace;font-size:52px;color:#d9f5d4;margin:0;text-shadow:0 0 22px rgba(91,227,106,.7)">${titulo}</h1>
    <p style="font-size:30px;line-height:1.45;margin:0;max-width:1000px">${sub}</p></body></html>`, { waitUntil: 'networkidle' }).catch(() => {});
  const legenda = (texto) => pg.evaluate(({ endereco, texto }) => {
    for (const i of ['v-barra', 'v-legenda']) document.getElementById(i)?.remove();
    const b = document.createElement('div'); b.id = 'v-barra';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;height:44px;z-index:2147483647;background:#dee1e6;display:flex;align-items:center;padding:0 16px;font:16px Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.25)';
    b.innerHTML = '<div style="flex:1;background:#fff;border-radius:16px;padding:7px 16px;color:#202124"></div>';
    b.firstChild.textContent = endereco;
    const l = document.createElement('div'); l.id = 'v-legenda';
    l.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(6,21,6,.95);border-top:4px solid #5be36a;color:#f2f7ee;font:600 27px/1.4 Arial,sans-serif;padding:18px 40px;text-align:center';
    l.textContent = texto;
    document.documentElement.append(b, l);
  }, { endereco: 'www.sppy.site', texto }).catch(() => {});

  await cartao('Isso é golpe?', 'A extensão funcionando', 'Exemplo real: um site que promete espionar<br>o Instagram de qualquer pessoa.');
  await espera(6500);

  // Abre o site e mostra a legenda enquanto a extensão confere a página.
  await pg.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
  await legenda('A pessoa abre o site, que promete “clonar o perfil” de qualquer pessoa, 100% anônimo.');
  for (let i = 0; i < 40 && !pg.url().includes('bloqueado.html'); i++) await espera(500);
  console.log('bloqueou:', pg.url().includes('bloqueado.html'));
  await espera(2500);
  await legenda('A extensão percebe o golpe e bloqueia a página na hora.');
  await espera(7000);
  await legenda('Ela mostra a confiança em porcentagem e explica o motivo em palavras simples.');
  await espera(8000);
  await legenda('Motivos: promete espiar a conta de outra pessoa, terminação .site e site criado há poucas semanas.');
  await pg.mouse.wheel(0, 160); await espera(9000);
  await legenda('Na dúvida, um clique pergunta para alguém de confiança pelo WhatsApp, ou abre o Reclame Aqui com o site já preenchido.');
  await pg.locator('#perguntar').hover().catch(() => {}); await espera(9000);

  await cartao('Isso é golpe?', 'Pergunte antes de clicar', 'A extensão confere sozinha as páginas que pedem dinheiro ou prometem o impossível.');
  await espera(6000);
  const video = pg.video();
  await ctx.close();
  const arquivo = await video.path();
  fs.writeFileSync(path.join(SAIDA, 'marcas.json'), JSON.stringify({ arquivo }));
  console.log('vídeo bruto:', arquivo);
})();
