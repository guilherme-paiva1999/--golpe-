// Segunda coleta (v3.15): abre cada endereço num Chrome SEM a extensão (só queremos medir a página) e guarda as medidas
// que o content.js manda ao modelo (as mesmas de coletar.js). Para site real, visita também uma página de PRODUTO e o CARRINHO,
// que o modelo antigo nunca viu (só havia páginas iniciais). Não digita nada, não baixa arquivos e fecha as janelas que o site abrir.
// Uso: node coletar2.js lista.tsv saida.jsonl [trabalhadores]      (no Windows precisa do Google Chrome instalado)
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path'), os = require('os');
const [LISTA, SAIDA, NT] = process.argv.slice(2);
const CHROME = process.env.CHROME || { win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', linux: '/usr/bin/google-chrome' }[process.platform];
const feitos = new Set(fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).url) : []);
const itens = fs.readFileSync(LISTA, 'utf8').split('\n').filter(Boolean).map((l) => { const [rotulo, url] = l.split('\t'); return { rotulo, url }; }).filter((i) => !feitos.has(i.url));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function medir() {
  const t = document.body ? document.body.innerText : '';
  const a = [...document.querySelectorAll('a[href]')]; let ext = 0;
  for (const x of a) { try { if (new URL(x.href).hostname !== location.hostname) ext++; } catch (e) { /* */ } }
  const mesmo = a.map((x) => { try { const u = new URL(x.href); return u.hostname === location.hostname ? u : null; } catch (e) { return null; } }).filter(Boolean);
  const produto = mesmo.find((u) => /\/(p|produto|produtos|product|item|dp)\/|\/p\/|-p\d{3,}|\/produto-|\/[^/]+-\d{5,}\/?(\?|$)|\/[^/]+\/p(\?|$)/i.test(u.pathname) && u.pathname.length > 12);
  const carrinho = mesmo.find((u) => /carrinho|\/cart|sacola|\/bag/i.test(u.pathname));
  return { title: document.title, lang: document.documentElement.lang || '', texto: t.slice(0, 6000), nTexto: t.length,
    nLinks: a.length, extLinks: ext, nForms: document.forms.length, nInputs: document.querySelectorAll('input').length,
    senha: !!document.querySelector('input[type=password]'), nIframes: document.querySelectorAll('iframe').length,
    nImgs: document.images.length, nScripts: document.scripts.length, html: document.documentElement.outerHTML.length,
    host: location.hostname, href: location.href,
    compraUI: [...document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]')].slice(0, 4000)
      .some((e) => /^(comprar(\s+agora)?|compre(\s+j[áa]|\s+agora)?|adicionar(\s+(ao|à|a)\s+(carrinho|sacola|cesta))?|add\s+to\s+(cart|bag)|buy\s+now|finalizar\s+(a\s+)?compra|ir\s+para\s+o\s+carrinho|ver\s+carrinho)\b/i.test((e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 60))) ||
      !!document.querySelector('a[href*="carrinho" i], a[href*="sacola" i], a[href*="/cart" i], a[href*="/bag" i], a[href*="checkout" i], [class*="minicart" i], [id*="minicart" i]'),
    cartao: !!document.querySelector('input[autocomplete^="cc-"], input[name*="card" i], input[name*="cartao" i], input[name*="cvv" i]'),
    _produto: produto ? produto.href : null, _carrinho: carrinho ? carrinho.href : null };
}

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'eg-coleta2-' + Date.now()), {
    executablePath: CHROME, headless: false, acceptDownloads: false, viewport: { width: 1280, height: 900 }, locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    args: ['--headless=new', '--lang=pt-BR', '--mute-audio']
  });
  const out = fs.createWriteStream(SAIDA, { flags: 'a' });
  let n = 0;
  const visitar = async (rotulo, url, tipo, original) => {
    const p = await ctx.newPage(); p.on('popup', (j) => j.close().catch(() => {}));
    const reg = { rotulo, url, tipo, origem: original };
    try {
      await Promise.race([
        (async () => {
          await p.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' }).catch((e) => { reg.erro = e.message.split('\n')[0]; });
          await espera(4500);
          reg.final = p.url();
          reg.pagina = await p.evaluate(medir).catch(() => null);
        })(),
        espera(40000).then(() => { reg.erro = reg.erro || 'tempo esgotado'; })
      ]);
    } catch (e) { reg.erro = reg.erro || String(e.message || e).split('\n')[0]; }
    await p.close().catch(() => {});
    const extra = reg.pagina ? { produto: reg.pagina._produto, carrinho: reg.pagina._carrinho } : {};
    if (reg.pagina) { delete reg.pagina._produto; delete reg.pagina._carrinho; }
    out.write(JSON.stringify(reg) + '\n');
    if (++n % 50 === 0) console.log(new Date().toISOString().slice(11, 19), n, 'páginas, faltam', itens.length, 'endereços');
    return extra;
  };
  const trabalhador = async () => {
    while (itens.length) {
      const it = itens.shift();
      const extra = await visitar(it.rotulo, it.url, 'inicial', it.url);
      if (it.rotulo === 'real') {      // site real: também uma página de produto e o carrinho
        if (extra.produto) await visitar('real', extra.produto, 'produto', it.url);
        if (extra.carrinho) await visitar('real', extra.carrinho, 'carrinho', it.url);
      }
    }
  };
  await Promise.all(Array.from({ length: Number(NT || 10) }, trabalhador));
  out.end(); await ctx.close();
  console.log('fim', n);
})();
