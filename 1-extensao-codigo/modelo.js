'use strict';
/* =====================================================================
   Aprendizado de máquina: classificador do NOME do site (ml/modelo.json).
   Os sinais abaixo são os mesmos de ml/recursos.py (o que foi treinado é o
   que roda aqui). Teste de paridade: node ml/testar_modelo.js
   Uso: carregarModelo(json) uma vez; depois probGolpe(host) -> 0 a 1.
   ===================================================================== */

const ML_SUFIXOS = ['com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'mil.br', 'co.uk', 'org.uk',
  'com.au', 'com.ar', 'com.pt', 'com.mx', 'co.za'];
const ML_HOSPEDAGEM = ['000webhostapp.com', 'weebly.com', 'wixsite.com', 'blogspot.com', 'github.io', 'netlify.app',
  'vercel.app', 'pages.dev', 'web.app', 'firebaseapp.com', 'herokuapp.com', 'glitch.me', 'godaddysites.com',
  'myshopify.com', 'webflow.io', 'sites.google.com', 'duckdns.org', 'ngrok.io', 'repl.co', 'onrender.com'];
const ML_PALAVRAS = ['secure', 'account', 'verify', 'verif', 'login', 'signin', 'update', 'bank', 'pay', 'support', 'wallet',
  'confirm', 'webmail', 'password', 'senha', 'seguranca', 'atualizar', 'cadastro', 'acesso', 'boleto', '2via',
  'segundavia', 'promo', 'oferta', 'relampago', 'liberacao', 'recover', 'unlock', 'suspend', 'alert', 'auth', 'token'];
const ML_MARCAS = {
  nubank: ['nubank.com.br'], itau: ['itau.com.br', 'itau.com'], bradesco: ['bradesco.com.br'],
  caixa: ['caixa.gov.br'], santander: ['santander.com.br', 'santander.com'], correios: ['correios.com.br'],
  mercadolivre: ['mercadolivre.com.br', 'mercadolivre.com'], mercadopago: ['mercadopago.com.br', 'mercadopago.com'],
  magalu: ['magazineluiza.com.br', 'magalu.com'], magazineluiza: ['magazineluiza.com.br'],
  americanas: ['americanas.com.br', 'americanas.com'], casasbahia: ['casasbahia.com.br'],
  shopee: ['shopee.com.br', 'shopee.com'], netflix: ['netflix.com'], picpay: ['picpay.com'],
  paypal: ['paypal.com'], apple: ['apple.com', 'icloud.com'], microsoft: ['microsoft.com', 'live.com', 'office.com'],
  google: ['google.com'], facebook: ['facebook.com'], instagram: ['instagram.com'], whatsapp: ['whatsapp.com'],
  amazon: ['amazon.com', 'amazon.com.br'], linkedin: ['linkedin.com'], dropbox: ['dropbox.com'],
  binance: ['binance.com'], coinbase: ['coinbase.com'], steam: ['steampowered.com', 'steamcommunity.com']
};
const ML_ESPIONAGEM = /(social|phone|mobile|cell|whats?app|insta(gram)?|face(book)?|tele(gram)?|tiktok|chat|follow|wech|msg|sms|track)\w*spy|spy\w*(app|phone|chat|social)|espion(ar|agem)\w*|(whats|zap|insta|celular|face)\w*espi[aã]o|espi[aã]o\w*(whats|zap|insta|celular|face)|spyware|stalker/i;

function mlRaiz(host) {
  const p = host.split('.');
  if (p.length < 2) return host;
  const dois = p.slice(-2).join('.');
  if (p.length >= 3 && ML_SUFIXOS.includes(dois)) return p.slice(-3).join('.');
  return dois;
}

function mlLev(a, b) {
  const m = [];
  for (let j = 0; j <= b.length; j++) m[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = m[0];
    m[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = m[j];
      m[j] = Math.min(m[j] + 1, m[j - 1] + 1, prev + (a[i - 1] !== b[j - 1] ? 1 : 0));
      prev = cur;
    }
  }
  return m[b.length];
}

function mlEntropia(s) {
  if (!s) return 0;
  const n = s.length, cont = {};
  for (const c of s) cont[c] = (cont[c] || 0) + 1;
  let h = 0;
  for (const c of Object.values(cont)) h -= (c / n) * Math.log2(c / n);
  return h;
}

function mlMaiorRun(s, pred) {
  let best = 0, cur = 0;
  for (const ch of s) { cur = pred(ch) ? cur + 1 : 0; if (cur > best) best = cur; }
  return best;
}

const ehLetra = (c) => /\p{L}/u.test(c);
const ehDigito = (c) => c >= '0' && c <= '9';

function mlMarca(host, dom) {
  const tokens = host.split(/[.\-]/).filter(Boolean);
  const extras = host.split('.').length > dom.split('.').length;
  const comPalavra = ML_PALAVRAS.some((p) => host.includes(p));
  let falsa = 0, typo = 0;
  for (const [m, ofic] of Object.entries(ML_MARCAS)) {
    if (ofic.includes(dom)) continue;
    for (const t of tokens) {
      const exato = t === m && (m.length >= 6 || comPalavra || extras);
      const contem = m.length >= 6 && t.length > m.length && t.includes(m);
      const parecido = m.length >= 6 && t.length >= 5 && Math.abs(t.length - m.length) <= 1 && mlLev(t, m) === 1;
      if (exato || contem) falsa = 1;
      if (parecido) typo = 1;
    }
  }
  return [falsa, typo];
}

function mlRecursos(hostOriginal, tldRisco, tldPadrao) {
  const host = hostOriginal.toLowerCase().replace(/^\.+|\.+$/g, '');
  const dom = mlRaiz(host), labels = host.split('.'), tld = labels[labels.length - 1];
  const sld = dom.includes('.') ? dom.split('.')[0] : dom;
  const ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const letras = [...sld].filter(ehLetra);
  const vog = letras.length ? letras.filter((c) => 'aeiou'.includes(c)).length / letras.length : 0;
  let trocas = 0;
  for (let i = 0; i + 1 < sld.length; i++) {
    const a = sld[i], b = sld[i + 1];
    if (ehDigito(a) !== ehDigito(b) && (ehLetra(a) || ehLetra(b))) trocas++;
  }
  const [falsa, typo] = mlMarca(host, dom);
  const tokens = host.split(/[.\-]/).filter(Boolean);
  const conta = (s, f) => [...s].filter(f).length;
  return [
    host.length, labels.length, dom.length, sld.length, labels.length - dom.split('.').length,
    conta(host, ehDigito) / host.length, sld.length ? conta(sld, ehDigito) / sld.length : 0,
    (sld.match(/-/g) || []).length, (host.match(/-/g) || []).length, Math.max(...labels.map((l) => l.length)),
    mlEntropia(sld), vog,
    mlMaiorRun(sld, (c) => ehLetra(c) && !'aeiou'.includes(c)), trocas,
    Object.prototype.hasOwnProperty.call(tldRisco, tld) ? tldRisco[tld] : tldPadrao, tld.length, ip ? 1 : 0,
    host.includes('xn--') ? 1 : 0,
    ML_HOSPEDAGEM.some((h) => host === h || host.endsWith('.' + h)) ? 1 : 0,
    ML_PALAVRAS.filter((p) => host.includes(p)).length, falsa, typo, tokens.length,
    tokens.length ? tokens.reduce((s, t) => s + t.length, 0) / tokens.length : 0,
    tokens.length ? Math.max(...tokens.map((t) => t.length)) : 0,
    mlMaiorRun(host, ehDigito), sld.length ? new Set(sld).size / sld.length : 0,
    ML_ESPIONAGEM.test(host) ? 1 : 0
  ];
}

let MODELO = null;
function carregarModelo(json) { MODELO = json; }
function modeloPronto() { return !!MODELO; }

// Gradient boosting (scikit-learn): soma das árvores em log-odds, depois sigmoide.
function probGolpe(host) {
  if (!MODELO) return null;
  const x = mlRecursos(host, MODELO.tld, MODELO.tld_padrao);
  let bruto = MODELO.init;
  for (const a of MODELO.arvores) {
    let n = 0;
    while (a.e[n] !== -1) n = x[a.f[n]] <= a.t[n] ? a.e[n] : a.d[n];
    bruto += MODELO.taxa * a.v[n];
  }
  return 1 / (1 + Math.exp(-bruto));
}
