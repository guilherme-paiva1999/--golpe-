'use strict';

/* =====================================================================
   Protetor Anti-Golpe - service worker
   - Listas de golpes ficam no IndexedDB (não na memória)
   - Nota de risco por pontos (vários sinais fracos somam)
   - Consulta de idade do domínio só quando já existe suspeita local
   ===================================================================== */

// Modelos de aprendizado de máquina: nome do site (modelo.js) e página (modelo-pagina.js, v3.12).
// alfabetos.js (v3.13): lê letras cirílicas disfarçadas ("аррӏе.com", "Nеtfliх"). Nos testes em Node, são carregados à parte.
if (typeof importScripts === 'function') importScripts('alfabetos.js', 'modelo.js', 'modelo-pagina.js');

// ---------- Configuração ----------
const CONFIG_PADRAO = { limite: 3, consultaIdade: false, imagens: false, modoSimples: false, rigor: 'alto',
  perfis: [], vozAutomatica: false, daltonico: false, raAuto: false };
const TTL_CACHE_MS = 6 * 3600 * 1000;
const LIMITE_PERIGO = 70;
const LIMITE_ATENCAO = 30;

const CONHECIDOS = [
  'google.com', 'youtube.com', 'facebook.com', 'instagram.com',
  'whatsapp.com', 'wikipedia.org', 'gov.br', 'reclameaqui.com.br',
  'mercadolivre.com.br', 'amazon.com.br', 'globo.com', 'uol.com.br'
];

// Serviços onde qualquer pessoa publica páginas: nunca tratar como "conhecido".
const HOSPEDAGEM = [
  'sites.google.com', 'docs.google.com', 'drive.google.com', 'forms.gle',
  'storage.googleapis.com', 'blogspot.com', 'github.io', 'netlify.app',
  'vercel.app', 'pages.dev', 'web.app', 'firebaseapp.com', 'herokuapp.com',
  'wixsite.com', 'weebly.com', '000webhostapp.com', 'glitch.me', 'onrender.com',
  'repl.co', 'replit.app', 'myshopify.com', 'webflow.io', 'godaddysites.com',
  'carrd.co', 'workers.dev', 'trycloudflare.com', 'infinityfreeapp.com', 'rf.gd'
];

// marca -> domínios oficiais
const MARCAS = {
  nubank: ['nubank.com.br'],
  itau: ['itau.com.br', 'itau.com'],
  bradesco: ['bradesco.com.br'],
  caixa: ['caixa.gov.br'],
  santander: ['santander.com.br'],
  correios: ['correios.com.br'],
  mercadolivre: ['mercadolivre.com.br', 'mercadolivre.com'],
  mercadopago: ['mercadopago.com.br', 'mercadopago.com'],
  magalu: ['magazineluiza.com.br', 'magalu.com'],
  magazineluiza: ['magazineluiza.com.br'],
  americanas: ['americanas.com.br', 'americanas.com'],
  casasbahia: ['casasbahia.com.br'],
  shopee: ['shopee.com.br'],
  netflix: ['netflix.com'],
  picpay: ['picpay.com']
};

// Sites que prometem espionar redes sociais/celular de outras pessoas (golpe ou programa-espião).
const ESPIONAGEM = /(social|phone|mobile|cell|whats?app|insta(gram)?|face(book)?|tele(gram)?|tiktok|chat|follow|wech|msg|sms|track)\w*spy|spy\w*(app|phone|chat|social)|espion(ar|agem)\w*|(whats|zap|insta|celular|face)\w*espi[aã]o|espi[aã]o\w*(whats|zap|insta|celular|face)|spyware|stalker/i;

const MOTIVO_ESPIAO = 'O site promete espiar ou clonar a conta de outra pessoa. Isso é crime e quase sempre é golpe: cobram e não entregam, ou roubam os seus dados.';
const MOTIVO_PROCON = 'O Procon-SP recomenda evitar este site: ele teve reclamações de consumidores, não respondeu ou não foi encontrado.';

// Sites do governo brasileiro terminam em .gov.br. Nomes que imitam o governo fora disso são suspeitos.
const GOV_FORTE = ['gov', 'govbr', 'governo', 'governofederal', 'receitafederal', 'inss', 'meuinss', 'detran',
  'cadunico', 'valoresareceber', 'sefaz', 'serpro', 'denatran', 'sisbr'];
const GOV_FRACO = ['restituicao', 'irpf', 'fgts', 'beneficio', 'beneficios', 'auxilio', 'bolsafamilia', 'seguro-desemprego'];
const GOV_ISCA = ['resgate', 'resgatar', 'valores', 'consulta', 'consultar', 'liberado', 'liberacao', 'saque', 'receber', 'regularizar', 'pendente'];

function imitaGoverno(host) {
  if (host === 'gov.br' || host.endsWith('.gov.br')) return 0;
  if (/(^|\.)gov(\.[a-z]{2})?$/.test(host) || /\.(gob|gouv)\.[a-z]{2}$/.test(host)) return 0;   // governo de outro país
  const plano = host.replace(/[.-]/g, ' ');
  const tokens = host.split(/[.-]/).filter(Boolean);
  const forte = tokens.some((t) => GOV_FORTE.includes(t) || /gov(br)?$/.test(t) || /^govbr/.test(t)) || /receita ?federal/.test(plano);
  if (forte) return 60;
  const fraco = tokens.some((t) => GOV_FRACO.includes(t));
  const isca = tokens.some((t) => GOV_ISCA.includes(t));
  return fraco ? (isca ? 60 : 20) : 0;
}

const ENCURTADORES = ['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'is.gd', 'rb.gy'];
const TLDS_RISCO = ['xyz', 'top', 'click', 'shop', 'site', 'online', 'icu', 'buzz', 'live', 'cfd'];
const PALAVRAS_HOST = ['seguranca', 'atualizar', 'cadastro', 'login', 'acesso', 'verificar',
  'boleto', '2via', 'segundavia', 'promo', 'oferta', 'relampago', 'liberacao'];
const SUFIXOS_COMPOSTOS = ['com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'mil.br',
  'co.uk', 'org.uk', 'com.au', 'com.ar', 'com.pt', 'com.mx', 'co.za'];

// Só fontes abertas, que permitem uso comercial. O feed público do OpenPhish foi retirado na v3.0:
// os termos dele não permitem uso comercial (só o feed pago).
const FONTES_LISTAS = [
  // Phishing.Database (código aberto, licença MIT)
  { nome: 'phishing', url: 'https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt' },
  // URLhaus, abuse.ch (dados CC0, domínio público)
  { nome: 'urlhaus', url: 'https://urlhaus.abuse.ch/downloads/hostfile/' },
  // Procon-SP, "Evite esses sites": reclamações de consumidores, notificados que não responderam ou não encontrados.
  { nome: 'procon', url: 'https://sistemas.procon.sp.gov.br/evitesite/list/evitesite.php?action=list&jtStartIndex=0&jtPageSize=1000&jtSorting=strSite%20ASC', tipo: 'procon', minimo: 20 }
];

const MARCAS_IA = ['trainedalgorithmicmedia', 'midjourney', 'dall-e', 'dall·e',
  'stable diffusion', 'adobe firefly', 'made with google ai'];

// ---------- Utilidades ----------
function sufixo(host, lista) {
  return lista.some((d) => host === d || host.endsWith('.' + d));
}

function ehIPv4(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function dominioRaiz(host) {
  if (ehIPv4(host) || host.includes(':')) return host;
  const p = host.split('.');
  if (p.length < 2) return host;
  const dois = p.slice(-2).join('.');
  if (p.length >= 3 && SUFIXOS_COMPOSTOS.includes(dois)) return p.slice(-3).join('.');
  return dois;
}

function ehConhecido(host) {
  return sufixo(host, CONHECIDOS) && !sufixo(host, HOSPEDAGEM);
}

function lev(a, b) {
  const m = [];
  for (let i = 0; i <= a.length; i++) m[i] = [i];
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length][b.length];
}

function nivelDe(pontos) {
  if (pontos >= LIMITE_PERIGO) return 'perigo';
  if (pontos >= LIMITE_ATENCAO) return 'atencao';
  return 'ok';
}

async function lerConfig() {
  const { config } = await chrome.storage.local.get('config');
  return { ...CONFIG_PADRAO, ...(config || {}) };
}

// ---------- Listas de sites perigosos (IndexedDB) ----------
let dbPromise = null;
function abrirDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const rq = indexedDB.open('protetor', 4);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        for (const f of FONTES_LISTAS) if (!db.objectStoreNames.contains(f.nome)) db.createObjectStore(f.nome);
        if (db.objectStoreNames.contains('openphish')) db.deleteObjectStore('openphish');   // fonte retirada (licença)
      };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => { dbPromise = null; reject(rq.error); };
    });
  }
  return dbPromise;
}

function transacao(db, nome, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nome, 'readwrite');
    fn(tx.objectStore(nome));
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

// Grava em blocos pequenos: uma transação longa travaria as consultas por vários segundos.
async function substituirFonte(nome, dominios) {
  const db = await abrirDB();
  await transacao(db, nome, (st) => st.clear());
  const BLOCO = 5000;
  for (let i = 0; i < dominios.length; i += BLOCO) {
    const parte = dominios.slice(i, i + BLOCO);
    await transacao(db, nome, (st) => { for (const d of parte) st.put(1, d); });
  }
}

async function estaNaLista(host) {
  try {
    const db = await abrirDB();
    const partes = host.split('.');
    const candidatos = [];
    if (ehIPv4(host)) candidatos.push(host);
    else for (let i = 0; i < partes.length - 1; i++) candidatos.push(partes.slice(i).join('.'));
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(FONTES_LISTAS.map((f) => f.nome), 'readonly');
      let achou = false;
      for (const f of FONTES_LISTAS) {
        const st = tx.objectStore(f.nome);
        for (const c of candidatos) {
          const rq = st.count(c);
          rq.onsuccess = () => { if (rq.result > 0 && achou !== 'procon') achou = f.nome; };
        }
      }
      tx.oncomplete = () => resolve(achou);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    return false;
  }
}

function lerLista(texto) {
  const dominios = [];
  for (let linha of texto.split('\n')) {
    linha = linha.split('#')[0].trim().toLowerCase();
    if (!linha) continue;
    const partes = linha.split(/\s+/);
    let d = partes[partes.length - 1];
    if (/^https?:\/\//.test(d)) { try { d = new URL(d).hostname; } catch (e) { continue; } }
    if (d === 'localhost' || !d.includes('.')) continue;
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(d)) continue;
    dominios.push(d);
  }
  return dominios;
}

function lerProcon(texto) {
  const dominios = [];
  for (const r of (JSON.parse(texto).Records || [])) {
    const h = String(r.strSite || '').trim().toLowerCase().replace(/^https?:\/\//, '').split(/[\/?#\s]/)[0].replace(/^www\./, '');
    if (h.includes('.') && /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(h)) dominios.push(h);
  }
  return dominios;
}

async function baixar(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(90000), credentials: 'omit' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

let atualizando = null;
function atualizarListas(so) {
  if (atualizando) return atualizando;
  atualizando = (async () => {
    // Evita o service worker dormir durante o download longo.
    const ping = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
    try {
      let ok = 0;
      for (const fonte of FONTES_LISTAS.filter((f) => !so || so.includes(f.nome))) {
        try {
          const texto = await baixar(fonte.url);
          const dominios = fonte.tipo === 'procon' ? lerProcon(texto) : lerLista(texto);
          if (dominios.length < (fonte.minimo || 100)) throw new Error('lista suspeita (muito pequena)');
          await substituirFonte(fonte.nome, dominios); // só troca se esta fonte deu certo
          ok++;
        } catch (e) {
          console.warn('Falha ao atualizar', fonte.nome, e.message);
        }
      }
      if (ok && !so) await chrome.storage.local.set({ atualizadoEm: Date.now() });
    } finally {
      clearInterval(ping);
      atualizando = null;
    }
  })();
  return atualizando;
}

async function garantirAlarme() {
  const a = await chrome.alarms.get('atualizar');
  if (!a) chrome.alarms.create('atualizar', { periodInMinutes: 1440, delayInMinutes: 1440 });
  const f = await chrome.alarms.get('feed');
  if (!f) chrome.alarms.create('feed', { periodInMinutes: 360, delayInMinutes: 360 });
}
chrome.runtime.onInstalled.addListener((d) => {
  garantirAlarme(); atualizarListas();
  // Primeira instalação: a pessoa escolhe a acessibilidade e (se quiser) uma pessoa de confiança.
  if (d && d.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('boas-vindas.html') }).catch(() => {});
});
chrome.runtime.onStartup.addListener(garantirAlarme);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'atualizar') atualizarListas();
  if (a.name === 'feed') atualizarListas(['phishing', 'urlhaus']);   // golpes novos entram em horas, não em dias
});
garantirAlarme();

// ---------- Sinais do endereço (sem rede) ----------
function detectarMarca(host, dominio) {
  const tokens = host.split(/[.\-]/).filter(Boolean);
  const extras = host.split('.').length > dominio.split('.').length;
  const comPalavra = PALAVRAS_HOST.some((p) => host.includes(p));
  for (const [marca, oficiais] of Object.entries(MARCAS)) {
    if (oficiais.includes(dominio)) continue;
    for (const t of tokens) {
      const exato = t === marca && (marca.length >= 6 || comPalavra || extras);
      const contem = marca.length >= 6 && t.length > marca.length && t.includes(marca);
      const parecido = marca.length >= 6 && t.length >= 5 &&
        Math.abs(t.length - marca.length) <= 1 && lev(t, marca) === 1;
      if (exato || contem || parecido) return { marca, oficial: oficiais[0] };
    }
  }
  return null;
}

// Letra que não é latina nem cirílica (grega, por exemplo): tratada como disfarce, como antes da v3.13.
function outroAlfabeto(s) { return [...s].some((c) => { const n = c.codePointAt(0); return n > 0x24f && (n < 0x400 || n > 0x52f) && c !== '.' ; }); }

// v3.13: o endereço lido em letras latinas ("аррӏе.com" -> "apple.com") é uma marca conhecida?
// Além das marcas brasileiras, as globais mais imitadas com letras russas (as mesmas do modelo, modelo.js).
const MARCAS_DISFARCE = { ...MARCAS, apple: ['apple.com', 'icloud.com'], google: ['google.com', 'google.com.br'], microsoft: ['microsoft.com', 'live.com', 'office.com'],
  paypal: ['paypal.com'], amazon: ['amazon.com.br', 'amazon.com'], facebook: ['facebook.com'], instagram: ['instagram.com'], whatsapp: ['whatsapp.com'],
  linkedin: ['linkedin.com'], dropbox: ['dropbox.com'], binance: ['binance.com'], coinbase: ['coinbase.com'], steam: ['steampowered.com', 'steamcommunity.com'],
  santander: ['santander.com.br', 'santander.com'], shopee: ['shopee.com.br', 'shopee.com'] };
function marcaNoEsqueleto(esqueleto) {
  const dom = dominioRaiz(esqueleto);
  for (const [marca, oficiais] of Object.entries(MARCAS_DISFARCE)) if (oficiais.includes(dom)) return { marca, oficial: oficiais[0] };
  const tokens = esqueleto.split(/[.\-]/).filter(Boolean);
  for (const [marca, oficiais] of Object.entries(MARCAS_DISFARCE)) {
    for (const t of tokens) {
      if (t === marca || (marca.length >= 6 && (t.includes(marca) || (Math.abs(t.length - marca.length) <= 1 && lev(t, marca) === 1)))) return { marca, oficial: oficiais[0] };
    }
  }
  return null;
}

function avaliarHost(host) {
  const dominio = dominioRaiz(host);
  const motivos = [];
  let pontos = 0;
  const somar = (p, m) => { pontos += p; motivos.push(m); };

  if (ehIPv4(host)) somar(40, 'O endereço é um número (IP) em vez de um nome de site.');
  if (host.includes('xn--')) {
    // v3.13: lê o endereço como a pessoa vê. Letras russas iguais às latinas imitando uma marca = golpe quase certo.
    const a = typeof alfHost === 'function' ? alfHost(host) : null;
    const disfarce = a && a.esqueleto !== a.unicode ? marcaNoEsqueleto(a.esqueleto) : null;
    if (disfarce) somar(70, 'O endereço imita "' + disfarce.marca + '" trocando letras por letras russas iguais. O site oficial é ' + disfarce.oficial + '.');
    else if (!a || a.mistura || a.tudoParecido || outroAlfabeto(a.unicode)) somar(30, 'O endereço usa letras disfarçadas para parecer outro site.');
    else if (a.cirilico > 0) somar(10, 'O endereço está escrito em outro alfabeto (russo). Confira se é mesmo o site que você queria.');
  }

  const marca = ehIPv4(host) ? null : detectarMarca(host, dominio);
  if (marca) somar(50, 'O endereço parece imitar "' + marca.marca + '", mas o site oficial é ' + marca.oficial + '.');

  const tld = host.split('.').pop();
  if (TLDS_RISCO.includes(tld)) somar(15, 'A terminação .' + tld + ' é muito usada em golpes.');
  // v3.13: conta os hífens do nome como a pessoa vê (o "xn--" do endereço em outro alfabeto não conta).
  const nomeVisto = typeof alfDecodificarHost === 'function' ? alfDecodificarHost(dominio) : dominio;
  if ((nomeVisto.match(/-/g) || []).length >= 2) somar(10, 'O nome do site tem vários hífens, comum em endereços falsos.');
  if (host.split('.').length - dominio.split('.').length >= 3) somar(10, 'O endereço tem muitos subdomínios, o que pode esconder o site real.');
  if (ENCURTADORES.includes(dominio)) somar(20, 'Link encurtado esconde o destino real.');
  if (PALAVRAS_HOST.some((p) => host.includes(p))) somar(10, 'O endereço tem palavras de pressão ou de acesso a conta.');
  const gov = ehIPv4(host) ? 0 : imitaGoverno(host);
  if (gov) somar(gov, gov >= 60
    ? 'O endereço imita um site do governo, mas os sites do governo terminam em .gov.br.'
    : 'O endereço usa termos de serviços do governo (restituição, FGTS...), mas não termina em .gov.br.');
  if (ESPIONAGEM.test(host)) somar(30, 'O nome do site promete espiar contas ou mensagens de outras pessoas. Esse tipo de serviço costuma ser golpe ou instalar programas que roubam dados.');
  if (sufixo(host, HOSPEDAGEM)) somar(10, 'O site está em hospedagem gratuita, que golpistas também usam.');

  return { pontos, motivos, dominio };
}

// ---------- Idade e responsável pelo domínio (RDAP, protocolo aberto dos registros de domínio) ----------
// Para sites .br, o registro.br informa se o dono é empresa (CNPJ) ou pessoa física. O número de CPF
// nunca é guardado: só a informação "pessoa física".
function lerRdap(j) {
  const ev = (j.events || []).find((e) => e.eventAction === 'registration');
  const t = ev ? new Date(ev.eventDate).getTime() : NaN;
  let cnpj = null, pf = false;
  for (const ent of j.entities || []) {
    if (!(ent.roles || []).includes('registrant')) continue;
    for (const id of ent.publicIds || []) {
      const tipo = String(id.type || '').toLowerCase();
      const num = String(id.identifier || '').replace(/\D/g, '');
      if (tipo === 'cnpj' && num.length === 14) cnpj = num;
      if (tipo === 'cpf') pf = true;
    }
  }
  return { r: isNaN(t) ? null : t, cnpj, pf };
}

async function consultarRdap(dominio) {
  const { idades = {} } = await chrome.storage.local.get('idades');
  const c = idades[dominio];
  if (c && (c.r !== null || Date.now() - c.t < 86400000)) {
    return { dias: c.r === null ? null : (Date.now() - c.r) / 86400000, cnpj: c.cnpj || null, pf: !!c.pf };
  }
  let info = { r: null, cnpj: null, pf: false };
  try {
    const base = dominio.endsWith('.br') ? 'https://rdap.registro.br/domain/' : 'https://rdap.org/domain/';
    const r = await fetch(base + encodeURIComponent(dominio), { signal: AbortSignal.timeout(4000), credentials: 'omit' });
    if (r.ok) info = lerRdap(await r.json());
  } catch (e) { /* sem rede ou lento: segue sem a idade */ }
  if (Object.keys(idades).length > 1500) for (const k of Object.keys(idades)) delete idades[k];
  idades[dominio] = { r: info.r, t: Date.now(), cnpj: info.cnpj, pf: info.pf };
  await chrome.storage.local.set({ idades });
  return { dias: info.r === null ? null : (Date.now() - info.r) / 86400000, cnpj: info.cnpj, pf: info.pf };
}

async function idadeEmDias(dominio) {
  return (await consultarRdap(dominio)).dias;
}

// ---------- Aprendizado de máquina (nome do site) ----------
// Medido em 40 mil sites do ranking Tranco e 40 mil golpes do Phishing.Database (aplicado ao domínio principal):
// a partir de 0,876 pega ~10% dos golpes com ~1% de falsos alertas (0% nos .br); a partir de 0,95, ~6% com 0,2%.
// v3.13 (retreinado com nomes em cirílico): limiares refeitos para dar a MESMA taxa de falsos alertas do modelo
// anterior em 15 mil sites do Tranco que ficaram fora do treino (0,881 e 0,949). Endereços com letras russas
// disfarçadas: pega 99% dos gerados no teste; sites russos de verdade (.рф): 0% de falsos alertas.
// Por isso o modelo SOMA pontos e nunca decide sozinho. Ele olha só o domínio principal: subdomínios
// (www., g1.) confundem o modelo, porque os sites normais do treino quase não tinham subdomínio.
const ML_LIMIAR = 0.881, ML_LIMIAR_FORTE = 0.949;
let modeloCarregando = null;
function garantirModelo() {
  if (typeof carregarModelo !== 'function') return Promise.resolve(false);
  if (modeloPronto()) return Promise.resolve(true);
  if (!modeloCarregando) {
    modeloCarregando = fetch(chrome.runtime.getURL('ml/modelo.json')).then((r) => r.json())
      .then((j) => { carregarModelo(j); return true; })
      .catch(() => { modeloCarregando = null; return false; });
  }
  return modeloCarregando;
}

async function sinalML(dominio) {
  if (ehIPv4(dominio) || !(await garantirModelo())) return null;
  const p = probGolpe(dominio);
  if (p === null) return null;
  const pct = Math.round(p * 100);
  if (p >= ML_LIMIAR_FORTE) return { p, pontos: 25, motivo: 'Nossa inteligência artificial (aprendizado de máquina) achou o nome deste site muito parecido com nomes de golpes conhecidos (' + pct + '%).' };
  if (p >= ML_LIMIAR) return { p, pontos: 15, motivo: 'Nossa inteligência artificial (aprendizado de máquina) achou o nome deste site parecido com nomes de golpes (' + pct + '%).' };
  return { p, pontos: 0, motivo: null };
}

// ---------- Aprendizado de máquina (página inteira), v3.12 ----------
// Regressão logística que lê o texto e 41 características da página (8-treino-ml/; 41 desde a v3.13, com o alfabeto cirílico). Foi o modelo com mais acerto
// no teste honesto (sites que ele nunca viu): AUC 0,92, contra 0,87 da rede neural. Limiares do teste:
// a partir de limiar2 pega ~51% dos golpes com 2% de falsos alertas; a partir de limiar1, ~30% com 1%.
// Ele SOMA pontos e nunca decide sozinho. Onde não há página para ler (aplicativo, antes de abrir), vale o modelo do nome.
let modeloPaginaCarregando = null;
function garantirModeloPagina() {
  if (typeof carregarModeloPagina !== 'function') return Promise.resolve(false);
  if (modeloPaginaPronto()) return Promise.resolve(true);
  if (!modeloPaginaCarregando) {
    modeloPaginaCarregando = fetch(chrome.runtime.getURL('ml/modelo-pagina.json')).then((r) => r.json())
      .then((j) => { carregarModeloPagina(j); return true; })
      .catch(() => { modeloPaginaCarregando = null; return false; });
  }
  return modeloPaginaCarregando;
}

// As medidas vêm da página (content.js): só aceita números e textos do tamanho esperado.
function limparMedidas(m) {
  if (!m || typeof m !== 'object') return null;
  const n = (k) => (Number.isFinite(m[k]) && m[k] >= 0 ? Math.min(m[k], 1e9) : 0);
  const t = (k, max) => (typeof m[k] === 'string' ? m[k].slice(0, max) : '');
  return { title: t('title', 500), lang: t('lang', 20), texto: t('texto', 6000), nTexto: n('nTexto'), nLinks: n('nLinks'),
    extLinks: Math.min(n('extLinks'), n('nLinks')), nForms: n('nForms'), nInputs: n('nInputs'), senha: m.senha === true,
    nIframes: n('nIframes'), nImgs: n('nImgs'), nScripts: n('nScripts'), html: n('html'), compraUI: m.compraUI === true, cartao: m.cartao === true };
}

// Características do endereço, iguais às do treino (8-treino-ml/caracteristicas.js).
async function enderecoParaModelo(host, protocolo) {
  host = host.replace(/^www\./, '');
  const dom = dominioRaiz(host);
  const ip = ehIPv4(dom);
  const pNome = ip || !(await garantirModelo()) ? 0.5 : (probGolpe(dom) ?? 0.5);
  const end = { https: protocolo === 'https:' ? 1 : 0, br: dom.endsWith('.br') ? 1 : 0, pontosHost: Math.min(avaliarHost(host).pontos, 100) / 100,
    ml: pNome, gratis: sufixo(host, HOSPEDAGEM) ? 1 : 0, subdominios: Math.min(host.split('.').length - dom.split('.').length, 4), ip: ip ? 1 : 0 };
  return end;
}

async function sinalPagina(host, protocolo, medidas) {
  if (!medidas || !(await garantirModeloPagina())) return null;
  const p = probGolpePagina(medidas, await enderecoParaModelo(host, protocolo));
  if (p === null || !Number.isFinite(p)) return null;
  const pct = Math.round(p * 100);
  const { limiar1, limiar2 } = { limiar1: 0.959, limiar2: 0.853, ...modeloPaginaLimiares() };
  if (p >= limiar1) return { p, pontos: 25, pagina: true, motivo: 'Nossa inteligência artificial (aprendizado de máquina) leu esta página e achou muito parecida com páginas de golpe (' + pct + '%).' };
  if (p >= limiar2) return { p, pontos: 15, pagina: true, motivo: 'Nossa inteligência artificial (aprendizado de máquina) leu esta página e achou parecida com páginas de golpe (' + pct + '%).' };
  return { p, pontos: 0, pagina: true, motivo: null };
}

// ---------- Análise completa ----------
async function estaPermitido(host) {
  const { permitidos = [] } = await chrome.storage.session.get('permitidos');
  return permitidos.includes(host);
}
async function permitir(host) {
  const { permitidos = [] } = await chrome.storage.session.get('permitidos');
  if (!permitidos.includes(host)) permitidos.push(host);
  await chrome.storage.session.set({ permitidos });
}

async function calcularBase(host, rapido) {
  const r = avaliarHost(host);
  const lista = await estaNaLista(host);
  if (lista === 'procon') {
    return { pontos: 50, dominio: r.dominio, motivos: [MOTIVO_PROCON, ...r.motivos] };
  }
  if (lista) {
    return {
      pontos: 100, dominio: r.dominio,
      motivos: ['Este site consta em listas públicas de golpes e vírus.', ...r.motivos]
    };
  }
  let { pontos, motivos } = r;
  if (!sufixo(host, HOSPEDAGEM)) {
    const ml = await sinalML(r.dominio);
    if (ml && ml.pontos) { pontos += ml.pontos; motivos = [...motivos, ml.motivo]; }
  }
  if (!rapido) {
    const cfg = await lerConfig();
    // Privacidade: só pergunta ao RDAP quando já há suspeita (ou se o usuário ativou).
    if ((pontos >= 15 || cfg.consultaIdade) && !ehIPv4(r.dominio) && !sufixo(host, HOSPEDAGEM)) {
      const dias = await idadeEmDias(r.dominio);
      if (dias !== null && dias < 30) {
        pontos += 30; motivos = [...motivos, 'Este site foi criado há apenas ' + Math.max(1, Math.round(dias)) + ' dias.'];
      } else if (dias !== null && dias < 90) {
        pontos += 15; motivos = [...motivos, 'Este site foi criado há cerca de ' + Math.round(dias) + ' dias.'];
      }
    }
  }
  return { pontos, motivos, dominio: r.dominio };
}

function montar(base, protocolo, extra) {
  let pontos = base.pontos;
  const motivos = [...base.motivos];
  if (protocolo === 'http:') {
    pontos += 10;
    motivos.push('O site não usa conexão segura (sem cadeado).');
  }
  return { nivel: nivelDe(pontos), pontos, motivos, dominio: base.dominio, conhecido: false, ...extra };
}

async function analisar(host, protocolo, { rapido = false } = {}) {
  const dominio = dominioRaiz(host);
  if (await estaPermitido(host)) return { nivel: 'ok', pontos: 0, motivos: [], dominio, conhecido: false, permitido: true };
  const { confiaveis = [], meusGolpes = [] } = await chrome.storage.local.get(['confiaveis', 'meusGolpes']);
  if (confiaveis.includes(host)) return { nivel: 'ok', pontos: 0, motivos: [], dominio, conhecido: true, usuario: true };
  if (meusGolpes.includes(host)) return { nivel: 'perigo', pontos: 100, motivos: ['Você marcou este site como golpe.'], dominio, conhecido: false };
  if (ehConhecido(host)) return { nivel: 'ok', pontos: 0, motivos: [], dominio, conhecido: true };

  const chave = 'res:' + host;
  let base = null;
  const salvo = (await chrome.storage.session.get(chave))[chave];
  if (salvo && Date.now() - salvo.t < TTL_CACHE_MS) base = salvo.base;
  if (!base) {
    base = await calcularBase(host, rapido);
    if (!rapido) await chrome.storage.session.set({ [chave]: { t: Date.now(), base } });
  }
  return montar(base, protocolo);
}

// ---------- Presunção de golpe: todo site é suspeito até provar o contrário ----------
// Sinais da página chegam só como verdadeiro/falso (o texto da página nunca sai do computador).
function pontuarPagina(basePontos, baseMotivos, sinais, dias, rigor) {
  let pontos = basePontos;
  const motivos = [...baseMotivos];
  const alto = rigor !== 'normal';
  const somar = (p, m) => { pontos += p; motivos.push(m); };
  if (sinais.pagamento) somar(15, 'A página pede pagamento ou dados do cartão.');
  if (sinais.pressao) somar(15, 'A página usa mensagens de pressão (tempo curto, poucas unidades).');
  if (sinais.desconto) somar(15, 'A página promete descontos exagerados.');
  if (sinais.formExterno) somar(25, 'O formulário envia os seus dados para outro site.');
  if (sinais.senha) somar(10, 'A página pede senha e o site não é conhecido.');
  if (sinais.semContato && sinais.pagamento) somar(10, 'Não achamos CNPJ nem contato claro na página.');
  if (dias === null || dias === undefined) {
    if (alto && (sinais.pagamento || sinais.senha)) somar(10, 'Não conseguimos confirmar há quanto tempo este site existe.');
  } else if (dias < 30) {
    somar(35, 'Este site foi criado há apenas ' + Math.max(1, Math.round(dias)) + ' dias.');
  } else if (dias < 90) {
    somar(20, 'Este site tem só ' + Math.round(dias) + ' dias de vida.');
  } else if (dias < 180) {
    somar(10, 'Este site tem menos de 6 meses.');
  } else if (dias >= 1095) {
    pontos -= 30;                     // prova: existe há mais de 3 anos
  } else if (dias >= 365) {
    pontos -= 20;                     // prova: existe há mais de 1 ano
  }
  return { pontos: Math.max(0, pontos), motivos };
}

function nivelPorRigor(pontos, rigor) {
  const [atencao, perigo] = rigor === 'normal' ? [30, 70] : [25, 60];
  return pontos >= perigo ? 'perigo' : pontos >= atencao ? 'atencao' : 'ok';
}

// Selo no ícone da extensão: ✓ provado, ? não verificado, ! atenção, X perigo.
// Daltonismo: azul (seguro), laranja (atenção) e preto (perigo), sempre com símbolo, em vez de verde e vermelho.
async function selo(tabId, estado) {
  const cfg = await lerConfig();
  const cores = cfg.daltonico
    ? { ok: '#0072b2', verificar: '#6b6b6b', atencao: '#e69f00', perigo: '#000000' }
    : { ok: '#17803f', verificar: '#6b6b6b', atencao: '#c77700', perigo: '#c62828' };
  const m = { ok: '✓', verificar: '?', atencao: '!', perigo: 'X', nenhum: '' }[estado];
  if (tabId == null || m === undefined) return;
  chrome.action.setBadgeText({ tabId, text: m }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: cores[estado] }).catch(() => {});
}
function estadoSelo(res) {
  if (res.conhecido || res.permitido) return 'ok';
  return res.nivel === 'ok' ? 'verificar' : res.nivel;
}

const SINAIS_CHAVES = ['pagamento', 'pressao', 'desconto', 'formExterno', 'senha', 'semContato', 'brasil', 'espionagem',
  'venda', 'cnpjValido', 'cnpjInvalido', 'contato', 'emailMesmoDominio', 'politicas', 'gateway'];

// Loja (venda ou pedido de pagamento): começa com 0 e precisa PROVAR confiança: só é confiável com 90% ou mais.
// Provas somam; sinais ruins tiram. O que faltou vira o aviso.
// opcoes.pesoPressao (0 a 1): quanto as palavras de pressão e o desconto exagerado pesam. Vale 1 por padrão; para empresa com
// CNPJ ativo há muito tempo diminui (v3.16). Devolve também o que somou (positivos) e o que tirou (negativos), sem limite de 0 a 100.
function pontuarConfianca(sinais, dias, protocolo, pontosDoEndereco, gratuito, opcoes = {}) {
  const alertas = [], faltou = [];
  const pesoPressao = opcoes.pesoPressao === undefined ? 1 : opcoes.pesoPressao;
  let positivos = 0, negativos = 0;
  const add = (d) => { if (d >= 0) positivos += d; else negativos -= d; };
  if (gratuito) { add(-15); faltou.push('A loja está em hospedagem gratuita, onde qualquer pessoa cria páginas. A idade do serviço não prova a idade da loja.'); }
  else if (dias === null || dias === undefined) faltou.push('Não conseguimos provar há quanto tempo esta loja existe.');
  else if (dias >= 1095) add(35);
  else if (dias >= 365) add(25);
  else if (dias >= 180) { add(10); faltou.push('Esta loja tem menos de 1 ano de vida.'); }
  else if (dias >= 90) faltou.push('Esta loja tem menos de 6 meses de vida.');
  else if (dias >= 30) { add(-25); faltou.push('Esta loja tem só ' + Math.round(dias) + ' dias de vida.'); }
  else { add(-40); faltou.push('Esta loja foi criada há apenas ' + Math.max(1, Math.round(dias)) + ' dias.'); }
  if (protocolo === 'https:') add(10); else faltou.push('O site não usa conexão segura (sem cadeado).');
  if (sinais.cnpjValido) add(10); else faltou.push(sinais.cnpjInvalido ? 'O CNPJ que aparece na página é inválido.' : 'Não achamos CNPJ na página.');
  if (sinais.contato) add(10); else faltou.push('Não achamos contato claro (e-mail, telefone ou endereço).');
  if (sinais.emailMesmoDominio) add(5);
  if (sinais.politicas) add(15); else faltou.push('Não achamos política de trocas, privacidade ou entrega.');
  if (sinais.gateway) add(10);
  if (sinais.formExterno) { add(-20); alertas.push('O formulário envia os seus dados para outro site.'); }
  if (sinais.pressao && pesoPressao > 0) {
    add(-15 * pesoPressao);
    alertas.push(pesoPressao < 1 ? 'A página usa mensagens de pressão (tempo curto, poucas unidades), mas a empresa é antiga e ativa, então isso pesa menos.'
      : 'A página usa mensagens de pressão (tempo curto, poucas unidades).');
  }
  if (sinais.desconto && pesoPressao > 0) {
    add(-15 * pesoPressao);
    alertas.push(pesoPressao < 1 ? 'A página promete descontos grandes, mas a empresa é antiga e ativa, então isso pesa menos.' : 'A página promete descontos exagerados.');
  }
  if (pontosDoEndereco > 0) add(-Math.min(pontosDoEndereco, 40));
  const bruto = positivos - negativos;
  return { confianca: Math.max(0, Math.min(100, bruto)), bruto, positivos, negativos, motivos: [...alertas, ...faltou] };
}

// v3.16: a confiança de uma LOJA parte da empresa (CNPJ na Receita Federal).
//  - CNPJ ativo: parte de 50% e sobe aos poucos com os anos de empresa, até 70% com 10 anos ou mais. As provas da página
//    (cadeado, contato, políticas, idade do site...) somam por cima, com peso menor.
//  - Sem CNPJ ativo (não existe, baixado, inapto ou nenhum): já não é confiável. Parte de 50% e só cai (pressão, endereço suspeito...).
//  - Palavras de pressão e descontos grandes pesam 100% quando a empresa não tem CNPJ ativo ou é nova (até 5 anos) e vão perdendo o
//    peso até 10 anos; de 10 anos em diante deixam de pesar ("promoção com prazo" é normal em empresa antiga).
function pesoDaPressao(empresa) {
  if (!empresa || !empresa.existe || !empresa.ativa) return 1;
  const anos = (diasDeEmpresa(empresa) || 0) / 365;
  return Math.max(0, Math.min(1, (10 - anos) / 5));
}
function confiancaDaLoja(c, empresa, motivos) {
  const ativa = !!(empresa && empresa.existe && empresa.ativa);
  if (!ativa) {
    if (empresa) motivos.push('Contra: sem CNPJ ativo na Receita Federal a loja não é confiável: a confiança parte de 50% e só cai.');
    return Math.max(0, Math.min(50, 50 - c.negativos));
  }
  const dias = diasDeEmpresa(empresa);
  const anos = (dias || 0) / 365;
  const base = Math.round(50 + 2 * Math.min(anos, 10));
  let conf = base + 0.3 * c.positivos - c.negativos;
  motivos.push('A favor: empresa ativa na Receita Federal (' + (empresa.fantasia || empresa.razao || 'sem nome') +
    (dias !== null ? ', ' + textoIdadeEmpresa(dias) : '') + '): a confiança parte de ' + base + '%.');
  if (dias !== null && dias >= 0 && dias < 180) { conf -= 15; motivos.push('A empresa foi aberta há menos de 6 meses.'); }
  else if (dias !== null && dias < 365) { conf -= 5; motivos.push('A empresa tem menos de 1 ano.'); }
  return Math.max(0, Math.min(100, conf));
}

const OFICIAIS_PAGINA = {
  microsoft: ['Microsoft', ['microsoft.com', 'live.com', 'office.com', 'microsoftonline.com', 'outlook.com', 'office365.com', 'microsoft365.com', 'sharepoint.com', 'onedrive.com']],
  google: ['Google', ['google.com', 'google.com.br', 'gmail.com', 'youtube.com']],
  govbr: ['Gov.br', ['gov.br']],
  nubank: ['Nubank', ['nubank.com.br']], itau: ['Itaú', ['itau.com.br', 'itau.com']], bradesco: ['Bradesco', ['bradesco.com.br']],
  caixa: ['Caixa', ['caixa.gov.br']], santander: ['Santander', ['santander.com.br']], bb: ['Banco do Brasil', ['bb.com.br']],
  correios: ['Correios', ['correios.com.br']], mercadolivre: ['Mercado Livre', ['mercadolivre.com.br', 'mercadolivre.com', 'mercadopago.com.br']],
  paypal: ['PayPal', ['paypal.com']], apple: ['Apple', ['apple.com', 'icloud.com']], netflix: ['Netflix', ['netflix.com']],
  instagram: ['Instagram', ['instagram.com']], facebook: ['Facebook', ['facebook.com']], whatsapp: ['WhatsApp', ['whatsapp.com']]
};

// Pega o ataque "no meio do caminho" (AiTM): a página se apresenta como a marca e pede senha ou pagamento,
// mas o endereço não é o da marca.
function marcaFalsaNaPagina(host, marcas, sinais) {
  if (!(sinais.senha || sinais.pagamento)) return null;
  for (const k of marcas) {
    const [nome, oficiais] = OFICIAIS_PAGINA[k];
    if (!oficiais.some((d) => host === d || host.endsWith('.' + d))) {
      const oque = sinais.senha ? 'pede a sua senha' : 'pede pagamento';
      if (k === 'govbr') return 'A página diz ser do governo (gov.br) e ' + oque + ', mas os sites do governo terminam em .gov.br.';
      return 'A página diz ser ' + nome + ' e ' + oque + ', mas o endereço oficial de ' + nome + ' é ' + oficiais[0] + '.';
    }
  }
  return null;
}

// Reclame Aqui: não há API pública e o site bloqueia consultas automáticas. A pessoa verifica no
// Detector oficial e registra o resultado no popup; ele entra na pontuação (só soma, não troca nada).
const NOTAS_RA = {
  verificado: ['RA Verificado / Confiável', 20, -20], otimo: ['Ótimo / RA1000', 15, -15], bom: ['Bom', 10, -10],
  regular: ['Regular', 0, 0], ruim: ['Ruim', -20, 20], nao_recomendado: ['Não recomendado', -40, 40],
  sem_cadastro: ['Sem cadastro', -5, 5]
};
async function notaRA(dominio) {
  const { reclameAqui = {} } = await chrome.storage.local.get('reclameAqui');
  return reclameAqui[dominio] || null;
}
// comercio: soma na confiança (0 a 100). Senão: soma nos pontos de risco.
function aplicarRA(registro, comercio, valor, motivos) {
  if (!registro || !NOTAS_RA[registro.nota]) return valor;
  const [nome, deltaConfianca, deltaRisco] = NOTAS_RA[registro.nota];
  motivos.push('Reclame Aqui: ' + nome + ' (registrado por você).');
  return comercio ? Math.max(0, Math.min(100, valor + deltaConfianca)) : Math.max(0, valor + deltaRisco);
}

// ---------- Receita Federal (BrasilAPI) e consumidor.gov.br ----------
function normalizarNome(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function consultarCnpj(cnpj) {
  const { cnpjs = {} } = await chrome.storage.local.get('cnpjs');
  const c = cnpjs[cnpj];
  if (c && Date.now() - c.t < 7 * 86400000) return c.info;
  let info = null;
  try {
    const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + cnpj, { signal: AbortSignal.timeout(6000), credentials: 'omit' });
    if (r.status === 404) info = { existe: false };
    else if (r.ok) {
      const j = await r.json();
      info = { existe: true, ativa: /^ATIVA$/i.test(String(j.descricao_situacao_cadastral || '').trim()),
        situacao: j.descricao_situacao_cadastral || '', razao: j.razao_social || '', fantasia: j.nome_fantasia || '',
        abertura: j.data_inicio_atividade || '',
        // v3.9: atividades econômicas (CNAE principal e secundárias) e MEI
        cnaes: [j.cnae_fiscal, ...(Array.isArray(j.cnaes_secundarios) ? j.cnaes_secundarios.map((c) => c && c.codigo) : [])]
          .filter(Boolean).map(String).slice(0, 60),
        atividade: String(j.cnae_fiscal_descricao || '').slice(0, 160), mei: j.opcao_pelo_mei === true };
    }
  } catch (e) { /* sem resposta: não conta nem a favor nem contra */ }
  if (info) {
    if (Object.keys(cnpjs).length > 500) for (const k of Object.keys(cnpjs)) delete cnpjs[k];
    cnpjs[cnpj] = { t: Date.now(), info };
    await chrome.storage.local.set({ cnpjs });
  }
  return info;
}

// comercio: soma na confiança (0 a 100). Senão: o contrário nos pontos de risco.
function aplicarDelta(delta, comercio, valor) {
  return comercio ? Math.max(0, Math.min(100, valor + delta)) : Math.max(0, valor - delta);
}

// Atividade econômica (CNAE) que permite vender produtos: indústria (divisões 10 a 33), comércio de veículos (45),
// atacado (46), varejo (47, inclui o comércio pela internet), intermediação de negócios (7490-1/04) e portais (6319).
function cnaeVende(c) {
  const s = String(c || '').replace(/\D/g, '');
  const div = Number(s.slice(0, 2));
  return (div >= 10 && div <= 33) || div === 45 || div === 46 || div === 47 || s.startsWith('7490104') || s.startsWith('6319');
}
// Tempo de empresa em dias (null se a Receita não informou).
function diasDeEmpresa(info) {
  const t = new Date(info && info.abertura).getTime();
  return isNaN(t) ? null : (Date.now() - t) / 86400000;
}
function textoIdadeEmpresa(dias) {
  if (dias === null) return '';
  if (dias < 365) return 'aberta há ' + Math.max(1, Math.round(dias / 30)) + ' meses';
  const anos = Math.floor(dias / 365);
  return 'aberta há ' + anos + (anos === 1 ? ' ano' : ' anos');
}
// Peso da empresa (BrasilAPI): situação na Receita, tempo de empresa e, se a página vende produtos, as atividades registradas.
function aplicarEmpresa(info, comercio, valor, motivos, vendeProdutos) {
  if (!info) return valor;
  let d;
  const origem = info.doRegistro ? 'do responsável pelo domínio (registro.br)' : 'mostrado na página';
  if (info.existe === false) { d = -25; motivos.push('O CNPJ ' + origem + ' não existe na Receita Federal.'); }
  else if (!info.ativa) { d = -25; motivos.push('O CNPJ ' + origem + ' está com situação "' + (info.situacao || 'irregular') + '" na Receita Federal.'); }
  else {
    d = 10;
    const dias = diasDeEmpresa(info);
    const idade = textoIdadeEmpresa(dias);
    motivos.push('A favor: empresa ativa na Receita Federal (' + (info.fantasia || info.razao || 'sem nome') + (idade ? ', ' + idade : '') + ').');
    // Empresas novas são usadas em golpes: menos de 6 meses pesa muito, menos de 1 ano pesa um pouco; 5 anos ou mais ajuda.
    if (dias !== null && dias >= 0 && dias < 180) { d -= 15; motivos.push('A empresa foi aberta há menos de 6 meses.'); }
    else if (dias !== null && dias < 365) { d -= 5; motivos.push('A empresa tem menos de 1 ano.'); }
    // Empresa antiga ajuda. Se o CNPJ é o do dono do domínio (confirmado no registro.br), ajuda muito mais: qualquer um
    // pode escrever um CNPJ de outra empresa na página, mas não consegue registrar o domínio em nome dela.
    else if (dias !== null && dias >= 10 * 365) d += info.confirmado ? 20 : 8;
    else if (dias !== null && dias >= 5 * 365) d += info.confirmado ? 12 : 5;
    // A página vende produtos, mas a empresa não tem nenhuma atividade de comércio ou indústria registrada.
    if (vendeProdutos && Array.isArray(info.cnaes) && info.cnaes.length && !info.cnaes.some(cnaeVende)) {
      d -= 10;
      motivos.push('A empresa não tem atividade de comércio registrada na Receita' +
        (info.atividade ? ' (atividade principal: ' + info.atividade + ')' : '') + ', mas a página vende produtos.');
    }
  }
  return aplicarDelta(d, comercio, valor);
}

let consumidorCache = null;
async function buscarConsumidor(nomes) {
  if (!consumidorCache) {
    try { consumidorCache = await (await fetch(chrome.runtime.getURL('dados/consumidor.json'))).json(); }
    catch (e) { consumidorCache = { empresas: {} }; }
  }
  for (const n of nomes) {
    const k = normalizarNome(n);
    if (k.length >= 3 && consumidorCache.empresas[k]) return { periodo: consumidorCache.periodo, dados: consumidorCache.empresas[k] };
  }
  return null;
}

function aplicarConsumidor(reg, comercio, valor, motivos) {
  if (!reg) return valor;
  const [nome, total, resp, resol, nota] = reg.dados;
  let d = 5;                                  // está cadastrada (com CNPJ) e recebe reclamações pela plataforma oficial
  if (resp >= 95) d += 5;
  if (resol !== null && resol >= 60) d += 5; else if (resol !== null && resol < 30) d -= 10;
  if (nota !== null && nota < 2) d -= 5;
  motivos.push((d > 0 ? 'A favor: ' : d < 0 ? 'Contra: ' : '') + 'consumidor.gov.br (' + reg.periodo + '): ' + nome + ', ' +
    total.toLocaleString('pt-BR') + ' reclamações, ' + resp + '% respondidas, ' + (resol === null ? '?' : resol) +
    '% resolvidas, nota ' + (nota === null ? '?' : String(nota).replace('.', ',')) + ' de 5.');
  return aplicarDelta(d, comercio, valor);
}

// Só é confiável quem CHEGA ao limite: 90% ou mais (rigor alto, o padrão) ou 60% ou mais (rigor normal).
function limiteConfianca(rigor) { return rigor === 'normal' ? 60 : 90; }

// Situação do CNPJ de uma loja: 'ativo', 'irregular' (não existe, baixado, inapto...), 'nenhum' (não achamos CNPJ
// na página nem no registro.br) ou 'sem-resposta' (a BrasilAPI não respondeu: nesse caso a regra não bloqueia).
function situacaoCnpj(cnpjUsado, empresa, rdap) {
  if (!cnpjUsado) return 'nenhum';
  if (!empresa) return 'sem-resposta';
  return empresa.existe && empresa.ativa ? 'ativo' : 'irregular';
}

// ---------- v3.16: nota do Reclame Aqui em segundo plano (opcional) ----------
// O Detector de Site Confiável publica o veredito de cada site em dados estruturados (schema.org, JSON-LD) na própria página
// pública: https://www.reclameaqui.com.br/detector-site-confiavel/<site>. A extensão faz UMA consulta comum (sem cookies) e mostra
// a nota como "segundo o Reclame Aqui", com o link para a pessoa conferir. Não muda a porcentagem. Se o Reclame Aqui ainda não
// analisou o site, a página dele pede confirmação "não sou um robô": nesse caso NÃO tentamos contornar, só mostramos o link.
const RA_DETECTOR = 'https://www.reclameaqui.com.br/detector-site-confiavel/';
const RA_ROTULOS = { 5: 'Confiável', 4: 'Provavelmente confiável', 3: 'Atenção', 2: 'Pouco confiável', 1: 'Não confiável', 0: 'Não confiável' };
// Lê o veredito (nota de 0 a 5) do HTML do Detector. Devolve null se a página não traz o veredito desse site.
function lerVereditoRA(html, host) {
  const blocos = String(html || '').matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const b of blocos) {
    let j;
    try { j = JSON.parse(b[1]); } catch (e) { continue; }
    for (const n of Array.isArray(j['@graph']) ? j['@graph'] : [j]) {
      if (!n || n['@type'] !== 'Review' || !n.author || !/reclame\s*aqui/i.test(String(n.author.name || ''))) continue;
      const alvo = n.itemReviewed && String(n.itemReviewed.url || '');
      let ah = '';
      try { ah = new URL(alvo).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { continue; }
      if (ah !== host) continue;                                       // o veredito tem que ser deste site, não de outro
      const v = n.reviewRating && Number(n.reviewRating.ratingValue);
      if (!Number.isFinite(v) || v < 0 || v > 5) continue;
      return { nota: Math.round(v), rotulo: RA_ROTULOS[Math.round(v)], data: String(n.datePublished || '').slice(0, 10) };
    }
  }
  return null;
}
async function consultarReclameAqui(host) {
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return { ok: false };
  const link = RA_DETECTOR + host;
  const { raConsultas = {} } = await chrome.storage.local.get('raConsultas');
  const c = raConsultas[host];
  if (c && Date.now() - c.t < (c.res.nota === undefined ? 3600000 : 86400000)) return { ok: true, link, ...c.res };
  if (c === undefined && (await chrome.storage.session.get('raBloqueado')).raBloqueado > Date.now()) return { ok: true, link, bloqueado: true };   // pausa depois de um desafio
  let res = {};
  try {
    const r = await fetch(link, { signal: AbortSignal.timeout(10000), credentials: 'omit', headers: { Accept: 'text/html' } });
    // O Reclame Aqui usa um desafio anti-robô (Cloudflare). Se ele aparecer, NÃO tentamos contornar: só mostramos o link.
    if (r.status === 403 || r.status === 429 || r.headers.get('cf-mitigated')) {
      await chrome.storage.session.set({ raBloqueado: Date.now() + 30 * 60000 });          // não insiste por 30 minutos
      return { ok: true, link, bloqueado: true };
    }
    if (!r.ok) return { ok: true, link };
    const v = lerVereditoRA(await r.text(), host);
    res = v || {};
  } catch (e) { return { ok: true, link }; }
  if (Object.keys(raConsultas).length > 300) for (const k of Object.keys(raConsultas)) delete raConsultas[k];
  raConsultas[host] = { t: Date.now(), res };
  await chrome.storage.local.set({ raConsultas });
  return { ok: true, link, ...res };
}

// ---------- v3.15: conferência automática do CNPJ e do site oficial ----------
// O aviso mandava a pessoa "abrir o site oficial digitando o endereço e conferir o CNPJ da loja". Agora a extensão faz isso:
// consulta o CNPJ na Receita Federal (BrasilAPI), compara com o dono do domínio no registro.br e, quando a página imita
// uma marca conhecida, oferece um botão que abre o endereço oficial da marca (escrito na extensão, nunca tirado da página).
const mascaraCnpj = (c) => String(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
function oficialDaMarca(host, marcas, dominio) {
  for (const k of marcas || []) {
    const o = OFICIAIS_PAGINA[k];
    if (o && !o[1].some((d) => host === d || host.endsWith('.' + d))) return { nome: o[0], host: o[1][0] };
  }
  const m = detectarMarca(host, dominio);
  return m ? { nome: m.marca, host: m.oficial } : null;
}
// Devolve as linhas "já conferimos por você" e se o CNPJ da página não bate com o dono do domínio.
function conferenciaCnpj({ cnpjPagina, cnpjRegistro, empresa, doRegistro }) {
  const linhas = [];
  const usado = cnpjPagina || cnpjRegistro || '';
  let diverge = false;
  if (!usado) {
    linhas.push('Procuramos o CNPJ na página e no registro do site e não achamos nenhum.');
    return { linhas, diverge };
  }
  const onde = doRegistro ? 'do dono do site no registro.br' : 'mostrado na página';
  if (!empresa) linhas.push('CNPJ ' + mascaraCnpj(usado) + ' (' + onde + '): a Receita Federal não respondeu agora, confira de novo mais tarde.');
  else if (empresa.existe === false) linhas.push('CNPJ ' + mascaraCnpj(usado) + ' (' + onde + '): não existe na Receita Federal.');
  else if (!empresa.ativa) linhas.push('CNPJ ' + mascaraCnpj(usado) + ' (' + onde + '): situação "' + (empresa.situacao || 'irregular') + '" na Receita Federal.');
  else {
    const idade = textoIdadeEmpresa(diasDeEmpresa(empresa));
    linhas.push('CNPJ ' + mascaraCnpj(usado) + ' (' + onde + ') conferido na Receita Federal: ' + (empresa.fantasia || empresa.razao || 'sem nome') +
      ', ativa' + (idade ? ', ' + idade : '') + '.');
  }
  // O CNPJ que a página mostra precisa ser do dono do domínio (mesma empresa: os 8 primeiros números iguais).
  if (cnpjPagina && cnpjRegistro && cnpjPagina.slice(0, 8) !== cnpjRegistro.slice(0, 8)) {
    diverge = true;
    linhas.push('Atenção: o CNPJ da página (' + mascaraCnpj(cnpjPagina) + ') não é o da empresa dona do endereço do site (' + mascaraCnpj(cnpjRegistro) + ').');
  }
  return { linhas, diverge };
}

async function avaliarPagina(host, protocolo, sinais, medidas = null) {
  const pre = await analisar(host, protocolo, { rapido: true });
  if (pre.conhecido || pre.permitido || pre.pontos >= 100) return pre;     // provado, liberado ou já na lista
  const cfg = await lerConfig();
  const r = avaliarHost(host);
  if (await estaNaLista(host) === 'procon') { r.pontos += 50; r.motivos.unshift(MOTIVO_PROCON); }
  const falsa = marcaFalsaNaPagina(host, sinais.marcas || [], sinais);
  if (falsa) { r.pontos += 50; r.motivos.unshift(falsa); }
  const comercio = !!(sinais.pagamento || sinais.venda);
  // A idade só é consultada quando a página mostra venda, dinheiro, senha ou pressão (privacidade).
  const precisaIdade = comercio || sinais.senha || sinais.pressao || sinais.formExterno || sinais.espionagem || cfg.consultaIdade;
  const gratuito = sufixo(host, HOSPEDAGEM);                  // subdomínio grátis: a idade é do serviço, não da loja
  // v3.12: com a página em mãos, vale o modelo da página (lê o conteúdo); sem ela, o do nome do site.
  const ml = (await sinalPagina(host, protocolo, medidas)) || (gratuito ? null : await sinalML(r.dominio));
  if (ml && ml.pontos) { r.pontos += ml.pontos; r.motivos.push(ml.motivo); }
  const rdap = (precisaIdade && !gratuito && !ehIPv4(r.dominio)) ? await consultarRdap(r.dominio) : null;
  const dias = rdap ? rdap.dias : null;
  // CNPJ: o da página; se a página não mostra, o do responsável pelo domínio (registro.br).
  // v3.15: rodapés mostram vários CNPJs (a loja, o banco do cartão da loja...). Vale o que é do dono do domínio no registro.br;
  // se nenhum for, o primeiro da página (como antes).
  let cnpjPagina = /^\d{14}$/.test(sinais.cnpj || '') ? sinais.cnpj : '';
  if (rdap && rdap.cnpj && Array.isArray(sinais.cnpjs)) {
    const doDono = sinais.cnpjs.find((c) => c.slice(0, 8) === rdap.cnpj.slice(0, 8));
    if (doDono) cnpjPagina = doDono;
  }
  const cnpjUsado = cnpjPagina || (rdap && rdap.cnpj) || '';
  const empresa = cnpjUsado ? await consultarCnpj(cnpjUsado) : null;
  if (empresa && !cnpjPagina) empresa.doRegistro = true;
  // v3.15: CNPJ confirmado = é o do dono do domínio no registro.br (o da página bate com o do registro, ou veio do registro)
  if (empresa && rdap && rdap.cnpj && cnpjUsado.slice(0, 8) === rdap.cnpj.slice(0, 8)) empresa.confirmado = true;
  const oficial = oficialDaMarca(host, sinais.marcas, r.dominio);          // v3.15
  const consumidor = await buscarConsumidor([r.dominio.split('.')[0], empresa && empresa.fantasia, empresa && empresa.razao].filter(Boolean));

  if (comercio) {
    const limite = limiteConfianca(cfg.rigor);
    // v3.15: o CNPJ da página tem que ser da empresa dona do domínio (registro.br). Se for de outra, desconfia.
    const conf = conferenciaCnpj({ cnpjPagina, cnpjRegistro: (rdap && rdap.cnpj) || '',
      empresa, doRegistro: !!(empresa && empresa.doRegistro) });
    // CNPJ de outra empresa na página (talvez copiado): os anos dessa empresa não valem para esta loja
    const empresaDaLoja = conf.diverge && empresa ? { ...empresa, abertura: '' } : empresa;
    const c = pontuarConfianca(sinais, dias, protocolo, r.pontos, gratuito, { pesoPressao: pesoDaPressao(empresaDaLoja) });
    const motivos = [...r.motivos, ...c.motivos];
    // v3.16: a empresa (CNPJ) é o ponto de partida. Se a Receita não respondeu, vale a conta sem a empresa, sem punir a loja.
    if (!(cnpjUsado && !empresa)) c.confianca = confiancaDaLoja(c, empresaDaLoja, motivos);
    c.confianca = aplicarRA(await notaRA(r.dominio), true, c.confianca, motivos);
    // atividade de comércio: se a página vende e a empresa não tem atividade de comércio, tira 10 (como antes)
    if (empresa && empresa.existe && empresa.ativa && sinais.venda && Array.isArray(empresa.cnaes) && empresa.cnaes.length && !empresa.cnaes.some(cnaeVende)) {
      c.confianca = Math.max(0, c.confianca - 10);
      motivos.push('A empresa não tem atividade de comércio registrada na Receita' + (empresa.atividade ? ' (atividade principal: ' + empresa.atividade + ')' : '') + ', mas a página vende produtos.');
    }
    if (conf.diverge) { c.confianca = Math.max(0, c.confianca - 15); motivos.push('O CNPJ mostrado na página não é o da empresa dona do endereço do site.'); }
    c.confianca = aplicarConsumidor(consumidor, true, c.confianca, motivos);
    c.confianca = Math.round(c.confianca);
    let nivel = c.confianca >= limite ? 'ok' : (c.confianca < 30 ? 'perigo' : 'atencao');
    if (falsa) nivel = 'perigo';                       // marca falsa é decisiva, mesmo em site antigo
    if (sinais.espionagem) { nivel = 'perigo'; motivos.unshift(MOTIVO_ESPIAO); }   // v3.10
    // v3.15: loja com endereço de fora do Brasil (.com etc.) é avisada como INTERNACIONAL, mesmo com preços em R$, português e CNPJ
    // (ex.: br.louisvuitton.com). Não bloqueia por isso: só tira 10 pontos e explica o que muda numa compra assim.
    const internacional = !r.dominio.endsWith('.br') && !ehIPv4(r.dominio);
    if (internacional) {
      c.confianca = Math.max(0, c.confianca - 10);
      motivos.push('Este é um site internacional: o endereço não termina em .br. Confira quem vende no Brasil (CNPJ), o prazo de entrega, a troca e a garantia antes de pagar.');
      if (nivel === 'ok') nivel = 'atencao';          // o aviso aparece, mas sem bloquear
    }
    // Loja sem CNPJ ativo é bloqueada (v3.6). A porcentagem calculada continua a mesma e aparece na tela de bloqueio.
    let cnpj = situacaoCnpj(cnpjUsado, empresa, rdap);
    // Loja estrangeira (v3.7): fora do .br, sem CNPJ e sem preços em R$ nem página em português. Também é bloqueada,
    // com outro aviso. Loja sem CNPJ voltada ao Brasil (R$ ou português) continua com o aviso de "sem CNPJ".
    if (cnpj === 'nenhum' && !r.dominio.endsWith('.br') && !sinais.brasil) cnpj = 'estrangeira';
    if (cnpj === 'estrangeira') {
      nivel = 'perigo';
      motivos.unshift('Esta é uma loja estrangeira e está fora dos nossos cuidados: ela não tem CNPJ e não segue as leis brasileiras de defesa do consumidor.');
    } else if (cnpj === 'nenhum') {
      nivel = 'perigo';
      motivos.unshift('Esta loja não tem CNPJ registrado: a página não mostra um CNPJ' +
        (r.dominio.endsWith('.br') ? ' e o site não está em nome de uma empresa no registro.br.' : '.') +
        ' Toda loja on-line no Brasil precisa informar quem vende.');
    } else if (cnpj === 'irregular') {
      nivel = 'perigo';
      motivos.unshift('O CNPJ desta loja não existe ou não está ativo na Receita Federal.');
    }
    return { nivel, pontos: 100 - c.confianca, confianca: c.confianca, limite, comercio: true, cnpj,
      motivos, dominio: r.dominio, conhecido: false, provado: nivel === 'ok' && !internacional, dias, conferencia: conf.linhas, oficial, internacional };
  }
  let pontos = r.pontos + (protocolo === 'http:' ? 10 : 0);
  const motivos = [...r.motivos];
  if (protocolo === 'http:') motivos.push('O site não usa conexão segura (sem cadeado).');
  const res = pontuarPagina(pontos, motivos, sinais, dias, cfg.rigor);
  res.pontos = aplicarRA(await notaRA(r.dominio), false, res.pontos, res.motivos);
  res.pontos = aplicarEmpresa(empresa, false, res.pontos, res.motivos);
  res.pontos = aplicarConsumidor(consumidor, false, res.pontos, res.motivos);
  if (falsa) res.pontos = Math.max(res.pontos, 70);  // marca falsa é decisiva, mesmo em site antigo (invadido)
  if (sinais.espionagem) {                            // v3.10: promessa de espionar ou clonar a conta de outra pessoa
    res.pontos += 50;
    res.motivos.unshift(MOTIVO_ESPIAO);
  }
  const nivel = nivelPorRigor(res.pontos, cfg.rigor);
  return { nivel, pontos: res.pontos, motivos: res.motivos, dominio: r.dominio, conhecido: false,
    provado: nivel === 'ok' && dias !== null && dias >= 365, dias, oficial };
}

// ---------- Verificação completa (tela de bloqueio) ----------
// Olha as mesmas coisas que o Detector de Site Confiável do Reclame Aqui: listas de golpes, idade do domínio,
// cadeado, quem é o responsável (CNPJ), situação na Receita e reclamações. Cada prova ruim DIMINUI a confiança.
// Só consulta serviços abertos (RDAP, BrasilAPI) e dados locais; o site bloqueado nunca é aberto.
const NOMES_LISTAS = { phishing: 'Phishing.Database', urlhaus: 'URLhaus (abuse.ch)', procon: 'Procon-SP "Evite esses sites"' };

function confiancaDaVerificacao(base, prova) {
  const itens = [];
  const item = (efeito, titulo, texto) => itens.push({ efeito, titulo, texto });
  let c = base.confianca;
  const somar = (d) => { c = Math.max(0, Math.min(100, c + d)); };

  if (prova.lista) item('contra', 'Listas de golpes', prova.lista === 'usuario' ? 'Você marcou este site como golpe.' : 'Consta na lista ' + (NOMES_LISTAS[prova.lista] || prova.lista) + '.');
  else item('neutro', 'Listas de golpes', 'Não consta nas listas abertas (Phishing.Database, URLhaus, Procon-SP). Golpes novos ainda não estão nelas.');

  const d = prova.dias;
  if (prova.gratuito) { somar(-15); item('contra', 'Idade do site', 'Está em hospedagem gratuita: qualquer pessoa cria uma página ali, e não dá para saber a idade.'); }
  else if (d === null || d === undefined) { somar(-10); item('contra', 'Idade do site', 'Não conseguimos confirmar há quanto tempo o site existe.'); }
  else if (d < 30) { somar(-40); item('contra', 'Idade do site', 'Criado há apenas ' + Math.max(1, Math.round(d)) + ' dias. Golpes costumam usar sites novos.'); }
  else if (d < 90) { somar(-25); item('contra', 'Idade do site', 'Criado há só ' + Math.round(d) + ' dias.'); }
  else if (d < 180) { somar(-10); item('contra', 'Idade do site', 'Tem menos de 6 meses.'); }
  else if (d >= 1095) { somar(20); item('favor', 'Idade do site', 'Existe há mais de ' + Math.floor(d / 365) + ' anos.'); }
  else if (d >= 365) { somar(10); item('favor', 'Idade do site', 'Existe há mais de 1 ano.'); }
  else item('neutro', 'Idade do site', 'Existe há ' + Math.round(d / 30) + ' meses.');

  if (prova.protocolo === 'https:') item('neutro', 'Cadeado (conexão segura)', 'Usa https. Atenção: golpes também usam cadeado, então isso sozinho não prova nada.');
  else { somar(-10); item('contra', 'Cadeado (conexão segura)', 'Não usa conexão segura (sem cadeado).'); }

  const e = prova.empresa;
  if (e && e.existe === false) { somar(-25); item('contra', 'Empresa responsável', 'O CNPJ do responsável pelo domínio não existe na Receita Federal.'); }
  else if (e && !e.ativa) { somar(-25); item('contra', 'Empresa responsável', 'O CNPJ do responsável está "' + (e.situacao || 'irregular') + '" na Receita Federal.'); }
  else if (e) {
    let dd = 10;
    const dias = diasDeEmpresa(e);
    const idade = textoIdadeEmpresa(dias);
    let t = 'Empresa ativa na Receita Federal: ' + (e.fantasia || e.razao || 'sem nome') + (idade ? ', ' + idade : '') + '.';
    if (e.atividade) t += ' Atividade principal: ' + e.atividade + '.';
    if (dias !== null && dias >= 0 && dias < 180) { dd -= 15; t += ' Atenção: empresa aberta há menos de 6 meses.'; }
    else if (dias !== null && dias < 365) { dd -= 5; t += ' Empresa com menos de 1 ano.'; }
    else if (dias !== null && dias >= 5 * 365) dd += 5;
    somar(dd); item(dd > 0 ? 'favor' : 'contra', 'Empresa responsável', t);
  } else if (prova.pf) { somar(-5); item('contra', 'Empresa responsável', 'O site está registrado em nome de uma pessoa física, não de uma empresa (CNPJ).'); }
  else item('neutro', 'Empresa responsável', prova.br ? 'Não conseguimos ver quem é o responsável pelo domínio.' : 'Sites fora do .br não mostram quem é o dono. Procure o CNPJ no rodapé, sem digitar seus dados.');

  const reg = prova.consumidor;
  if (reg) {
    const [nome, total, resp, resol, nota] = reg.dados;
    let dd = 5;
    if (resp >= 95) dd += 5;
    if (resol !== null && resol >= 60) dd += 5; else if (resol !== null && resol < 30) dd -= 10;
    if (nota !== null && nota < 2) dd -= 5;
    somar(dd);
    item(dd > 0 ? 'favor' : 'contra', 'Reclamações (consumidor.gov.br)', nome + ': ' + total.toLocaleString('pt-BR') + ' reclamações, ' + resp + '% respondidas, ' +
      (resol === null ? '?' : resol) + '% resolvidas, nota ' + (nota === null ? '?' : String(nota).replace('.', ',')) + ' de 5 (' + reg.periodo + ').');
  } else item('neutro', 'Reclamações (consumidor.gov.br)', 'A empresa não aparece no consumidor.gov.br (o cadastro é voluntário).');

  if (prova.ra && NOTAS_RA[prova.ra.nota]) {
    const [nome, delta] = NOTAS_RA[prova.ra.nota];
    somar(delta);
    item(delta > 0 ? 'favor' : delta < 0 ? 'contra' : 'neutro', 'Reclame Aqui', 'Você registrou: ' + nome + '.');
  } else item('neutro', 'Reclame Aqui', 'Ainda não verificado. Use o botão "Verificar no Reclame Aqui".');

  if (prova.ml) {
    const pct = Math.round(prova.ml.p * 100);
    if (prova.ml.pontos) item('contra', 'Inteligência artificial', 'O nome do site parece com nomes de golpes (' + pct + '%).');
    else item('neutro', 'Inteligência artificial', 'O nome do site não parece com nomes de golpes conhecidos (' + pct + '%).');
  }
  if (prova.lista && prova.lista !== 'procon') c = 0;      // golpe confirmado em lista: confiança zero
  return { confianca: Math.round(c), itens };
}

async function investigar(urlTexto) {
  let u;
  try { u = new URL(urlTexto); } catch (e) { return null; }
  if (!protocoloValido(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  const r = avaliarHost(host);
  const { meusGolpes = [] } = await chrome.storage.local.get('meusGolpes');
  const lista = meusGolpes.includes(host) ? 'usuario' : await estaNaLista(host);
  const gratuito = sufixo(host, HOSPEDAGEM);
  const ml = gratuito ? null : await sinalML(r.dominio);
  const rdap = (gratuito || ehIPv4(r.dominio)) ? { dias: null, cnpj: null, pf: false } : await consultarRdap(r.dominio);
  const empresa = rdap.cnpj ? await consultarCnpj(rdap.cnpj) : null;
  const consumidor = await buscarConsumidor([r.dominio.split('.')[0], empresa && empresa.fantasia, empresa && empresa.razao].filter(Boolean));
  // Ponto de partida: o que bloqueou (sinais do endereço e da página). Site bloqueado começa com no máximo 30%.
  const risco = Math.max(70, r.pontos + (ml ? ml.pontos : 0) + (u.protocol === 'http:' ? 10 : 0));
  const base = { confianca: Math.max(0, 100 - risco) };
  const res = confiancaDaVerificacao(base, { lista, dias: rdap.dias, gratuito, protocolo: u.protocol, empresa, pf: rdap.pf,
    br: r.dominio.endsWith('.br'), consumidor, ra: await notaRA(r.dominio), ml });
  const cfg = await lerConfig();
  return { ...res, host, dominio: r.dominio, limite: limiteConfianca(cfg.rigor) };
}

// ---------- Voz (chrome.tts funciona mesmo sem clique, ao contrário da voz da página) ----------
function falar(texto) {
  if (!chrome.tts || typeof texto !== 'string' || !texto) return;
  chrome.tts.speak(texto.slice(0, 1500), { lang: 'pt-BR', rate: 0.9 });
}

// ---------- Bloqueio antes de a página abrir ----------
function bloquear(tabId, url, motivos, conta) {
  // guarda os motivos para a tela de bloqueio (alguns vêm da página, não só do endereço)
  if (motivos && motivos.length) chrome.storage.session.set({ ['motivos:' + url]: motivos.slice(0, 6) }).catch(() => {});
  // e a porcentagem que causou o bloqueio, para a tela mostrar o mesmo número
  if (conta && (typeof conta.confianca === 'number' || conta.oficial)) chrome.storage.session.set({ ['conta:' + url]: conta }).catch(() => {});
  const alvo = chrome.runtime.getURL('bloqueado.html') + '?u=' + encodeURIComponent(url);
  return chrome.tabs.update(tabId, { url: alvo }).catch(() => {});
}

chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0) return;
  let u;
  try { u = new URL(d.url); } catch (e) { return; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  const res = await analisar(u.hostname.toLowerCase(), u.protocol, { rapido: true });
  if (res.nivel === 'perigo') {
    const h = u.hostname.toLowerCase();
    const of = ehIPv4(h) ? null : oficialDaMarca(h, [], dominioRaiz(h));     // v3.15: botão do site oficial da marca imitada
    bloquear(d.tabId, d.url, res.motivos, of ? { oficial: of } : null);
  }
}, { url: [{ schemes: ['http', 'https'] }] });

// ---------- Metadados de imagem (opcional, precisa de permissão) ----------
function hostPrivado(h) {
  return h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.includes(':') ||
    /^(10|127|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h);
}

const cacheImagens = new Map();
let ativos = 0;
const espera = [];
async function comLimite(fn) {
  if (ativos >= 3) await new Promise((r) => espera.push(r));
  ativos++;
  try { return await fn(); } finally { ativos--; const p = espera.shift(); if (p) p(); }
}

async function verificarMetadados(url) {
  let u;
  try { u = new URL(url); } catch (e) { return { ia: false }; }
  if (u.protocol !== 'https:' || hostPrivado(u.hostname)) return { ia: false };
  if (cacheImagens.has(url)) return { ia: cacheImagens.get(url) };

  const cfg = await lerConfig();
  if (!cfg.imagens || !(await chrome.permissions.contains({ origins: ['https://*/*'] }))) return { ia: false };

  const ia = await comLimite(async () => {
    try {
      const r = await fetch(url, {
        headers: { Range: 'bytes=0-262143' }, credentials: 'omit',
        referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(5000)
      });
      if (!r.ok || !r.body) return false;
      const leitor = r.body.getReader();
      const partes = [];
      let total = 0;
      while (total < 262144) {            // lê no máximo 256 KB, mesmo se o servidor ignorar o Range
        const { done, value } = await leitor.read();
        if (done) break;
        partes.push(value); total += value.length;
      }
      leitor.cancel().catch(() => {});
      const buf = new Uint8Array(total);
      let pos = 0;
      for (const p of partes) { buf.set(p, pos); pos += p.length; }
      const texto = new TextDecoder('latin1').decode(buf).toLowerCase();
      return MARCAS_IA.some((m) => texto.includes(m));
    } catch (e) {
      return false;
    }
  });
  if (cacheImagens.size > 1000) cacheImagens.delete(cacheImagens.keys().next().value);
  cacheImagens.set(url, ia);
  return { ia };
}

// ---------- Mensagens ----------
function hostValido(h) {
  return typeof h === 'string' && /^[a-z0-9.\-]{1,253}$/i.test(h);
}
function protocoloValido(p) {
  return p === 'http:' || p === 'https:';
}

async function tratar(msg, sender) {
  if (!msg || typeof msg.tipo !== 'string') return null;
  switch (msg.tipo) {
    case 'checar-site': {
      if (!hostValido(msg.host) || !protocoloValido(msg.protocolo)) return null;
      const host = msg.host.toLowerCase();
      const res = await analisar(host, msg.protocolo);
      // v3.6: sem selo em sites de leitura e vídeo; o selo aparece quando a página pede dinheiro (avaliar-pagina).
      if (sender.tab) selo(sender.tab.id, res.nivel === 'perigo' ? 'perigo' : 'nenhum');
      if (res.nivel === 'perigo' && sender.tab && typeof msg.url === 'string') {
        try {
          const u = new URL(msg.url);
          if (u.hostname.toLowerCase() === host) bloquear(sender.tab.id, msg.url, res.motivos);
        } catch (e) { /* ignora */ }
      }
      return res;
    }
    case 'avaliar-pagina': {
      if (!hostValido(msg.host) || !protocoloValido(msg.protocolo) || !msg.sinais) return null;
      const sinais = {};
      for (const k of SINAIS_CHAVES) sinais[k] = msg.sinais[k] === true;
      sinais.cnpj = /^\d{14}$/.test(String(msg.sinais.cnpj || '')) ? String(msg.sinais.cnpj) : '';
      sinais.cnpjs = Array.isArray(msg.sinais.cnpjs) ? msg.sinais.cnpjs.map(String).filter((c) => /^\d{14}$/.test(c)).slice(0, 5) : [];
      sinais.marcas = Array.isArray(msg.sinais.marcas) ? msg.sinais.marcas.filter((k) => Object.hasOwn(OFICIAIS_PAGINA, k)).slice(0, 5) : [];
      const host = msg.host.toLowerCase();
      const res = await avaliarPagina(host, msg.protocolo, sinais, limparMedidas(msg.medidas));
      if (sender.tab) selo(sender.tab.id, res.provado ? 'ok' : estadoSelo(res));
      if (res.nivel === 'perigo' && sender.tab && typeof msg.url === 'string') {
        try {
          if (new URL(msg.url).hostname.toLowerCase() === host) {
            bloquear(sender.tab.id, msg.url, res.motivos, res.comercio
              ? { confianca: res.confianca, limite: res.limite, cnpj: res.cnpj, conferencia: res.conferencia, oficial: res.oficial }
              : (res.oficial ? { oficial: res.oficial } : null));
          }
        } catch (e) { /* ignora */ }
      }
      return res;
    }
    case 'rotular': {                          // "é golpe" / "é seguro": forma o seu conjunto de treino
      let u;
      try { u = new URL(msg.url); } catch (e) { return null; }
      if (!protocoloValido(u.protocol) || !['golpe', 'seguro'].includes(msg.rotulo)) return null;
      const host = u.hostname.toLowerCase();
      const lista = msg.rotulo === 'golpe' ? 'meusGolpes' : 'confiaveis';
      const outra = msg.rotulo === 'golpe' ? 'confiaveis' : 'meusGolpes';
      const dados = await chrome.storage.local.get([lista, outra, 'rotulos']);
      const a = dados[lista] || [];
      if (!a.includes(host)) a.push(host);
      const sinais = {};
      for (const k of SINAIS_CHAVES) sinais[k] = !!(msg.sinais && msg.sinais[k]);
      const rotulos = (dados.rotulos || []).filter((x) => x.host !== host);
      rotulos.push({ host, rotulo: msg.rotulo, sinais, nota: Number(msg.nota) || 0, em: new Date().toISOString() });
      await chrome.storage.local.set({ [lista]: a, [outra]: (dados[outra] || []).filter((h) => h !== host), rotulos: rotulos.slice(-2000) });
      return { ok: true, total: rotulos.length };
    }
    case 'ra': {
      let u;
      try { u = new URL(msg.url); } catch (e) { return null; }
      if (!protocoloValido(u.protocol)) return null;
      const dominio = dominioRaiz(u.hostname.toLowerCase());
      const { reclameAqui = {} } = await chrome.storage.local.get('reclameAqui');
      if (msg.nota && NOTAS_RA[msg.nota]) reclameAqui[dominio] = { nota: msg.nota, em: new Date().toISOString() };
      else if (msg.nota === '') delete reclameAqui[dominio];
      await chrome.storage.local.set({ reclameAqui });
      return { ok: true, dominio, registro: reclameAqui[dominio] || null };
    }
    case 'status':
    case 'detalhes': {
      let u;
      try { u = new URL(msg.url); } catch (e) { return null; }
      if (!protocoloValido(u.protocol)) return null;
      const res = { ...(await analisar(u.hostname.toLowerCase(), u.protocol)), host: u.hostname };
      if (msg.tipo === 'detalhes') {
        const guardados = (await chrome.storage.session.get('motivos:' + u.href))['motivos:' + u.href];
        if (guardados && guardados.length) {
          // A idade do site pode vir duas vezes (da página e do endereço), com palavras diferentes: fica uma só.
          const idadeNaPagina = guardados.some((m) => /dias de vida|meses de vida|ano de vida/.test(m));
          const doEndereco = res.motivos.filter((m) => !(idadeNaPagina && /^Este site foi criado há/.test(m)));
          res.motivos = [...new Set([...guardados, ...doEndereco])];
        }
        const conta = (await chrome.storage.session.get('conta:' + u.href))['conta:' + u.href];
        if (conta) res.conta = conta;                   // porcentagem calculada na página da loja
      }
      return res;
    }
    case 'investigar':
      return investigar(String(msg.url || ''));
    case 'falar':
      falar(String(msg.texto || ''));
      return { ok: true };
    case 'ra-nota': {
      // v3.16 (opcional): consulta em segundo plano o veredito público do Reclame Aqui para o site da aba que pediu
      // (a própria página da loja ou a tela de bloqueio dela) e devolve a nota. Só se a pessoa ligou a opção no popup.
      const cfgRA = await lerConfig();
      if (!cfgRA.raAuto || !sender.tab || typeof sender.tab.url !== 'string') return { ok: false };
      let h;
      try {
        const u = new URL(sender.tab.url);
        const alvo = u.href.startsWith(chrome.runtime.getURL('bloqueado.html')) ? new URL(u.searchParams.get('u')) : u;
        h = alvo.hostname.toLowerCase().replace(/^www\./, '');
      } catch (e) { return { ok: false }; }
      return await consultarReclameAqui(h);
    }
    case 'parar-fala':
      if (chrome.tts) chrome.tts.stop();
      return { ok: true };
    case 'permitir':
      if (!hostValido(msg.host)) return null;
      await permitir(msg.host.toLowerCase());
      return { ok: true };
    case 'metadados-imagem':
      return verificarMetadados(String(msg.url || ''));
    case 'voltar':
      if (sender.tab) {
        try { await chrome.tabs.goBack(sender.tab.id); }
        catch (e) { await chrome.tabs.remove(sender.tab.id).catch(() => {}); }
      }
      return { ok: true };
    case 'atualizar-listas':
      await atualizarListas();
      return { ok: true };
    default:
      return null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  tratar(msg, sender).then(sendResponse).catch(() => sendResponse(null));
  return true;
});
