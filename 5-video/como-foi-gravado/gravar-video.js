// Gravação SEM injetar nada: a extensão consulta listas, Receita e regras sozinha.
// As legendas são montadas a partir do resultado real que ela produziu.
const { chromium } = require('playwright'); const https=require('https'); const fs=require('fs'); const path=require('path');
const V=__dirname, EXT='/home/user/--golpe-', S=path.join(V,'sites');
const MAPA={'ateliedaluma.example':'original.html','ateliedaluma-promocao.example':'copia.html','ceramicasdamar.example':'ceramica.html','festival-verao-ingressos.example':'ingressos.html'};
const espera=(ms)=>new Promise(r=>setTimeout(r,ms));
const marcas=[]; const t0=Date.now(); const marca=(n)=>marcas.push([n,(Date.now()-t0)/1000]);
(async()=>{
  const srv=https.createServer({key:fs.readFileSync(path.join(V,'k.pem')),cert:fs.readFileSync(path.join(V,'c.pem'))},(q,r)=>{
    const host=(q.headers.host||'').split(':')[0]; const f=MAPA[host]; r.setHeader('content-type','text/html;charset=utf-8');
    if(f) r.end(fs.readFileSync(path.join(S,f))); else {r.statusCode=404;r.end('404');}
  }).listen(443,'127.0.0.1'); await new Promise(r=>srv.on('listening',r));
  const ctx=await chromium.launchPersistentContext('/tmp/pg-video2-'+Date.now(),{headless:false,ignoreHTTPSErrors:true,
    viewport:{width:1280,height:900},recordVideo:{dir:path.join(V,'bruto2'),size:{width:1280,height:900}},
    args:['--headless=new','--no-sandbox','--ignore-certificate-errors',`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=*.example','--host-resolver-rules=MAP *.example 127.0.0.1',
      `--disable-extensions-except=${EXT}`,`--load-extension=${EXT}`]});
  let sw=ctx.serviceWorkers()[0]; if(!sw) sw=await ctx.waitForEvent('serviceworker');
  const pg=ctx.pages()[0]||await ctx.newPage();
  const logo='data:image/svg+xml;base64,'+fs.readFileSync(path.join(S,'logo.svg')).toString('base64');
  const cartao=async(titulo,sub,nota)=>pg.setContent(`<body style="margin:0;height:100vh;display:grid;place-items:center;background:#10201C;color:#fff;font-family:Arial,sans-serif;text-align:center"><div style="max-width:1000px"><img src="${logo}" style="width:500px"><h2 style="font-size:38px;margin:24px 0 8px">${titulo}</h2><p style="font-size:23px;margin:0;opacity:.9">${sub}</p><p style="font-size:17px;margin-top:28px;opacity:.7;line-height:1.5">${nota}</p></div></body>`);
  // espera a extensão baixar as listas sozinha (enquanto isso fica o cartão de abertura; o trecho é cortado depois)
  await cartao('Gravação real da extensão','A extensão decide sozinha: listas de golpes, Receita Federal e regras.','Nada foi injetado. Lojas e festival são sites fictícios (.example); os golpes do OpenPhish são reais<br>e foram bloqueados antes de carregar. As legendas mostram o resultado que a extensão produziu.');
  for(let i=0;i<60;i++){await espera(3000); const ok=await sw.evaluate(async()=>{const l=await chrome.storage.local.get('atualizadoEm');const db=await abrirDB();const n=await new Promise(r=>{const q=db.transaction('openphish').objectStore('openphish').count();q.onsuccess=()=>r(q.result)});return !!l.atualizadoEm&&n>0;}); if(ok)break;}
  marca('inicio'); await espera(6000);

  const legenda=async(url,texto,estado)=>pg.evaluate(({url,texto,estado})=>{
    for(const id of ['demo-barra','demo-legenda']) document.getElementById(id)?.remove();
    const cores={ok:['✓','#17803f'],verificar:['?','#6b6b6b'],atencao:['!','#c77700'],perigo:['X','#c62828'],bloq:['X','#c62828']};const c=cores[estado]||cores.verificar;
    const b=document.createElement('div');b.id='demo-barra';
    b.style.cssText='position:fixed;top:0;left:0;right:0;height:46px;z-index:2147483647;background:#dee1e6;display:flex;align-items:center;gap:12px;padding:0 14px;font:15px Arial,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.25)';
    b.innerHTML=`<div style="flex:1;background:#fff;border-radius:16px;padding:7px 14px;color:#202124;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${url}</div><div style="display:flex;align-items:center;gap:6px;font-weight:bold;color:#202124">É Golpe? <span style="background:${c[1]};color:#fff;border-radius:9px;padding:1px 8px">${c[0]}</span></div>`;
    const l=document.createElement('div');l.id='demo-legenda';
    l.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(16,32,28,.95);color:#fff;font:bold 20px/1.35 Arial,sans-serif;padding:13px 26px;text-align:center';
    l.textContent=texto; document.documentElement.append(b,l);},{url,texto,estado});
  const aba=async()=>sw.evaluate(async()=>{const [t]=await chrome.tabs.query({active:true,lastFocusedWindow:true});return {id:t.id,selo:await chrome.action.getBadgeText({tabId:t.id})};});
  const seloNome=(s)=>({'✓':'ok','?':'verificar','!':'atencao','X':'perigo'}[s]||'verificar');
  // lê o resultado que a extensão produziu nesta página
  const resultado=async(urlTxt)=>{
    await espera(4500);
    if(pg.url().startsWith('chrome-extension://')){await espera(1500);
      const m=await pg.locator('#motivos li').allInnerTexts().catch(()=>[]);
      return {bloqueado:true,motivos:m};}
    const avisos=await pg.evaluate(()=>document.querySelectorAll('[data-pg]').length).catch(()=>0);
    const {selo}=await aba();
    const host=new URL(pg.url()).hostname;
    const r=await sw.evaluate(async(h)=>{const [t]=await chrome.tabs.query({active:true,lastFocusedWindow:true});let x=null;try{x=await chrome.tabs.sendMessage(t.id,{tipo:'sinais'});}catch(e){}
      if(!x) return null; const y=await avaliarPagina(h,'https:',x.sinais); return {nivel:y.nivel,confianca:y.confianca,limite:y.limite,comercio:!!y.comercio,motivos:y.motivos};},host).catch(()=>null);
    return {bloqueado:false,avisos,selo,r};};
  const frase=(res)=>{
    if(res.bloqueado) return 'Resultado: BLOQUEADO antes de abrir. Motivo: '+(res.motivos[0]||'sem motivo listado');
    const r=res.r||{};
    if(r.comercio){const base=`Confiança ${r.confianca} de 100 (lojas precisam de mais de ${r.limite}). `;
      if(r.nivel==='ok') return 'Resultado: '+base+'Compra liberada, sem aviso.';
      return 'Resultado: '+base+'Aviso na tela. Motivo: '+(r.motivos[0]||'');}
    if(res.avisos>0) return 'Resultado: aviso na tela. Motivo: '+((r.motivos||[])[0]||'');
    return 'Resultado: nenhum sinal de golpe, navegação livre (selo "?" = ainda não verificado).';};
  const cena=async(n,url,mostrar,desc)=>{marca('cena'+n);await pg.goto(url).catch(()=>{});const res=await resultado(url);
    await legenda(mostrar,`${n} · ${desc} ${frase(res)}`,res.bloqueado?'bloq':seloNome(res.selo));console.log(n,JSON.stringify(res).slice(0,300));await espera(7500);};

  await cena(1,'https://www.cnnbrasil.com.br/economia/money/macroeconomia/metade-dos-brasileiros-abandona-compra-on-line-por-inseguranca-diz-serasa/','www.cnnbrasil.com.br/economia/...','Site de notícias real.');
  await cena(2,'https://ateliedaluma.example/','ateliedaluma.example','Loja fictícia de moda (o CNPJ dela não existe de verdade).');
  await cena(3,'https://ateliedaluma-promocao.example/','ateliedaluma-promocao.example','Cópia da loja com as mesmas fotos e "70% OFF".');
  await cena(4,'https://festival-verao-ingressos.example/','festival-verao-ingressos.example','Venda de ingressos de festival.');
  await cena(5,'https://resgate-valores-gov.example/','resgate-valores-gov.example','Endereço com "gov" fora do .gov.br.');
  const feed=fs.readFileSync(path.join(V,'feed_hoje.txt'),'utf8').split('\n').filter(Boolean).slice(0,2);
  await cena(6,feed[0],feed[0].replace(/^https?:\/\//,''),'Golpe real do feed público do OpenPhish.');
  await cena(7,feed[1],feed[1].replace(/^https?:\/\//,''),'Outro golpe real do OpenPhish.');
  await sw.evaluate(async()=>chrome.storage.local.set({config:{modoSimples:true}}));
  await cena(8,'https://ceramicasdamar.example/','ceramicasdamar.example','Modo simples ligado (letras grandes, botão de ouvir), numa loja fictícia nova.');
  marca('fim'); await cartao('Todo site precisa provar que é confiável','Protege quem compra e quem cria.','É Golpe? · protótipo · Hackathon Negócios em Transformação'); await espera(5000);
  const vid=pg.video(); await pg.close(); const p=await vid.path(); await ctx.close(); srv.close();
  fs.writeFileSync(path.join(V,'marcas.json'),JSON.stringify(marcas)); console.log('VIDEO',p, JSON.stringify(marcas));
})().catch(e=>{console.error('FALHA',e.stack||e.message);process.exit(1)});
