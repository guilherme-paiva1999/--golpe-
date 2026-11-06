// Abre cada site da lista no Chromium com a extensão É Golpe? de verdade e guarda:
// - o que a extensão decidiu (antes de abrir e na página), sem as listas de golpes (mede o golpe "desconhecido");
// - os sinais que a extensão leu da página e dados extras da página, para treinar um modelo.
// Uso: node coletar.js EXTENSAO lista.tsv saida.jsonl [trabalhadores]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const [EXT, LISTA, SAIDA, NT] = process.argv.slice(2);
const feitos = new Set(fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).url) : []);
const itens = fs.readFileSync(LISTA, 'utf8').split('\n').filter(Boolean).map((l) => { const [rotulo, url] = l.split('\t'); return { rotulo, url }; })
  .filter((i) => !feitos.has(i.url));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hostDe = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; } };

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'eg-coleta-' + Date.now()), {
    headless: false, acceptDownloads: false, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    args: ['--headless=new', '--enable-unsafe-extension-debugging', '--lang=pt-BR']
  });
  if (!ctx.serviceWorkers().length) { const cdp = await ctx.browser().newBrowserCDPSession(); await cdp.send('Extensions.loadUnpacked', { path: EXT }); }
  await espera(3000);
  const sw = ctx.serviceWorkers()[0];
  const preparar = () => sw.evaluate(() => {
    if (self.__pronto) return;
    self.__pronto = true; self.__pre = {}; self.__pag = {}; self.__blk = {};
    estaNaLista = async () => false;                       // sem listas: mede o golpe que as listas ainda não conhecem
    const a = analisar; analisar = async (h, p, o) => { const r = await a(h, p, o); if (!o || !o.rapido) self.__pre[h] = { nivel: r.nivel, pontos: r.pontos, motivos: r.motivos, conhecido: r.conhecido }; return r; };
    const av = avaliarPagina; avaliarPagina = async (h, p, s) => { const r = await av(h, p, s); (self.__pag[h] = self.__pag[h] || []).push({ sinais: s, res: r }); return r; };
    bloquear = async (tabId, url, motivos) => { self.__blk[hostOf(url)] = motivos; };
    function hostOf(u) { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; } }
  });
  await preparar();
  const out = fs.createWriteStream(SAIDA, { flags: 'a' });
  let n = 0;
  const trabalhador = async () => {
    while (itens.length) {
      const it = itens.shift();
      const p = await ctx.newPage(); p.on('popup', (j) => j.close().catch(() => {}));   // fecha janelas abertas pelos sites
      const reg = { rotulo: it.rotulo, url: it.url };
      try {
        await Promise.race([
          (async () => {
            await p.goto(it.url, { timeout: 25000, waitUntil: 'domcontentloaded' }).catch((e) => { reg.erro = e.message.split('\n')[0]; });
            await espera(8000);
            reg.final = p.url();
            reg.pagina = await p.evaluate(() => {
              const t = document.body ? document.body.innerText : '';
              const a = [...document.querySelectorAll('a[href]')]; let ext = 0;
              for (const x of a) { try { if (new URL(x.href).hostname !== location.hostname) ext++; } catch (e) { /* */ } }
              return { title: document.title, lang: document.documentElement.lang || '', texto: t.slice(0, 6000), nTexto: t.length,
                nLinks: a.length, extLinks: ext, nForms: document.forms.length, nInputs: document.querySelectorAll('input').length,
                senha: !!document.querySelector('input[type=password]'), nIframes: document.querySelectorAll('iframe').length,
                nImgs: document.images.length, nScripts: document.scripts.length, html: document.documentElement.outerHTML.length,
                host: location.hostname, href: location.href,
                compraUI: [...document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]')].slice(0, 4000)
                  .some((e) => /^(comprar(\s+agora)?|compre(\s+j[áa]|\s+agora)?|adicionar(\s+(ao|à|a)\s+(carrinho|sacola|cesta))?|add\s+to\s+(cart|bag)|buy\s+now|finalizar\s+(a\s+)?compra|ir\s+para\s+o\s+carrinho|ver\s+carrinho)\b/i.test((e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 60))) ||
                  !!document.querySelector('a[href*="carrinho" i], a[href*="sacola" i], a[href*="/cart" i], a[href*="/bag" i], a[href*="checkout" i], [class*="minicart" i], [id*="minicart" i]'),
                cartao: !!document.querySelector('input[autocomplete^="cc-"], input[name*="card" i], input[name*="cartao" i], input[name*="cvv" i]') };
            }).catch(() => null);
          })(),
          espera(45000).then(() => { reg.erro = reg.erro || 'tempo esgotado'; })
        ]);
        const hs = [...new Set([hostDe(it.url), hostDe(reg.final || ''), reg.pagina && reg.pagina.host].filter(Boolean))];
        const log = await sw.evaluate((hs) => ({ pre: hs.map((h) => self.__pre[h]).find(Boolean) || null,
          pag: hs.map((h) => self.__pag[h]).find(Boolean) || null, blk: hs.map((h) => self.__blk[h]).find(Boolean) || null }), hs);
        Object.assign(reg, log);
      } catch (e) { reg.erro = reg.erro || String(e.message || e).split('\n')[0]; }
      await p.close().catch(() => {});
      out.write(JSON.stringify(reg) + '\n');
      if (++n % 50 === 0) console.log(new Date().toISOString().slice(11, 19), n, 'feitos, faltam', itens.length);
    }
  };
  await Promise.all(Array.from({ length: Number(NT || 10) }, trabalhador));
  out.end(); await ctx.close();
  console.log('fim', n);
})();
