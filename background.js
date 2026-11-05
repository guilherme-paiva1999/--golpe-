'use strict';

/* =====================================================================
   Protetor Anti-Golpe - service worker
   - Listas de golpes ficam no IndexedDB (não na memória)
   - Nota de risco por pontos (vários sinais fracos somam)
   - Consulta de idade do domínio só quando já existe suspeita local
   ===================================================================== */

// ---------- Configuração ----------
const CONFIG_PADRAO = { limite: 3, consultaIdade: false, imagens: false, modoSimples: false, rigor: 'alto' };
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

const ENCURTADORES = ['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'is.gd', 'rb.gy'];
const TLDS_RISCO = ['xyz', 'top', 'click', 'shop', 'site', 'online', 'icu', 'buzz', 'live', 'cfd'];
const PALAVRAS_HOST = ['seguranca', 'atualizar', 'cadastro', 'login', 'acesso', 'verificar',
  'boleto', '2via', 'segundavia', 'promo', 'oferta', 'relampago', 'liberacao'];
const SUFIXOS_COMPOSTOS = ['com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'mil.br',
  'co.uk', 'org.uk', 'com.au', 'com.ar', 'com.pt', 'com.mx', 'co.za'];

const FONTES_LISTAS = [
  { nome: 'phishing', url: 'https://raw.githubusercontent.com/mitchellkrogza/Phishing.Database/master/phishing-domains-ACTIVE.txt' },
  { nome: 'urlhaus', url: 'https://urlhaus.abuse.ch/downloads/hostfile/' },
  // Feed público do OpenPhish (golpes recentes, lista de endereços). Confira os termos de uso antes de publicar.
  { nome: 'openphish', url: 'https://raw.githubusercontent.com/openphish/public_feed/main/feed.txt', minimo: 50, horas: 6 }
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
      const rq = indexedDB.open('protetor', 2);
      rq.onupgradeneeded = () => {
        for (const f of FONTES_LISTAS) if (!rq.result.objectStoreNames.contains(f.nome)) rq.result.createObjectStore(f.nome);
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
          rq.onsuccess = () => { if (rq.result > 0) achou = true; };
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
          const dominios = lerLista(await baixar(fonte.url));
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
chrome.runtime.onInstalled.addListener(() => { garantirAlarme(); atualizarListas(); });
chrome.runtime.onStartup.addListener(garantirAlarme);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'atualizar') atualizarListas();
  if (a.name === 'feed') atualizarListas(['openphish']);   // golpes novos entram em horas, não em dias
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

function avaliarHost(host) {
  const dominio = dominioRaiz(host);
  const motivos = [];
  let pontos = 0;
  const somar = (p, m) => { pontos += p; motivos.push(m); };

  if (ehIPv4(host)) somar(40, 'O endereço é um número (IP) em vez de um nome de site.');
  if (host.includes('xn--')) somar(30, 'O endereço usa letras disfarçadas para parecer outro site.');

  const marca = ehIPv4(host) ? null : detectarMarca(host, dominio);
  if (marca) somar(50, 'O endereço parece imitar "' + marca.marca + '", mas o site oficial é ' + marca.oficial + '.');

  const tld = host.split('.').pop();
  if (TLDS_RISCO.includes(tld)) somar(15, 'A terminação .' + tld + ' é muito usada em golpes.');
  if ((dominio.match(/-/g) || []).length >= 2) somar(10, 'O nome do site tem vários hífens, comum em endereços falsos.');
  if (host.split('.').length - dominio.split('.').length >= 3) somar(10, 'O endereço tem muitos subdomínios, o que pode esconder o site real.');
  if (ENCURTADORES.includes(dominio)) somar(20, 'Link encurtado esconde o destino real.');
  if (PALAVRAS_HOST.some((p) => host.includes(p))) somar(10, 'O endereço tem palavras de pressão ou de acesso a conta.');
  if (ESPIONAGEM.test(host)) somar(30, 'O nome do site promete espiar contas ou mensagens de outras pessoas. Esse tipo de serviço costuma ser golpe ou instalar programas que roubam dados.');
  if (sufixo(host, HOSPEDAGEM)) somar(10, 'O site está em hospedagem gratuita, que golpistas também usam.');

  return { pontos, motivos, dominio };
}

// ---------- Idade do domínio (RDAP) ----------
async function idadeEmDias(dominio) {
  const { idades = {} } = await chrome.storage.local.get('idades');
  const c = idades[dominio];
  if (c && (c.r !== null || Date.now() - c.t < 86400000)) {
    return c.r === null ? null : (Date.now() - c.r) / 86400000;
  }
  let registro = null;
  try {
    const r = await fetch('https://rdap.org/domain/' + encodeURIComponent(dominio),
      { signal: AbortSignal.timeout(3000), credentials: 'omit' });
    if (r.ok) {
      const j = await r.json();
      const ev = (j.events || []).find((e) => e.eventAction === 'registration');
      const t = ev ? new Date(ev.eventDate).getTime() : NaN;
      if (!isNaN(t)) registro = t;
    }
  } catch (e) { /* sem rede ou lento: segue sem a idade */ }
  if (Object.keys(idades).length > 1500) for (const k of Object.keys(idades)) delete idades[k];
  idades[dominio] = { r: registro, t: Date.now() };
  await chrome.storage.local.set({ idades });
  return registro === null ? null : (Date.now() - registro) / 86400000;
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
  if (await estaNaLista(host)) {
    return {
      pontos: 100, dominio: r.dominio,
      motivos: ['Este site consta em listas públicas de golpes e vírus.', ...r.motivos]
    };
  }
  let { pontos, motivos } = r;
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
function selo(tabId, estado) {
  const m = { ok: ['✓', '#17803f'], verificar: ['?', '#6b6b6b'], atencao: ['!', '#c77700'], perigo: ['X', '#c62828'] }[estado];
  if (tabId == null || !m) return;
  chrome.action.setBadgeText({ tabId, text: m[0] }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: m[1] }).catch(() => {});
}
function estadoSelo(res) {
  if (res.conhecido || res.permitido) return 'ok';
  return res.nivel === 'ok' ? 'verificar' : res.nivel;
}

const SINAIS_CHAVES = ['pagamento', 'pressao', 'desconto', 'formExterno', 'senha', 'semContato',
  'venda', 'cnpjValido', 'cnpjInvalido', 'contato', 'emailMesmoDominio', 'politicas', 'gateway'];

// Loja (venda ou pedido de pagamento): começa com 0 e precisa PROVAR confiança, com mais de 75 de 100.
// Provas somam; sinais ruins tiram. O que faltou vira o aviso.
function pontuarConfianca(sinais, dias, protocolo, pontosDoEndereco, gratuito) {
  const alertas = [], faltou = [];
  let c = 0;
  if (gratuito) { c -= 15; faltou.push('A loja está em hospedagem gratuita, onde qualquer pessoa cria páginas. A idade do serviço não prova a idade da loja.'); }
  else if (dias === null || dias === undefined) faltou.push('Não conseguimos provar há quanto tempo esta loja existe.');
  else if (dias >= 1095) c += 35;
  else if (dias >= 365) c += 25;
  else if (dias >= 180) { c += 10; faltou.push('Esta loja tem menos de 1 ano de vida.'); }
  else if (dias >= 90) faltou.push('Esta loja tem menos de 6 meses de vida.');
  else if (dias >= 30) { c -= 25; faltou.push('Esta loja tem só ' + Math.round(dias) + ' dias de vida.'); }
  else { c -= 40; faltou.push('Esta loja foi criada há apenas ' + Math.max(1, Math.round(dias)) + ' dias.'); }
  if (protocolo === 'https:') c += 10; else faltou.push('O site não usa conexão segura (sem cadeado).');
  if (sinais.cnpjValido) c += 10; else faltou.push(sinais.cnpjInvalido ? 'O CNPJ que aparece na página é inválido.' : 'Não achamos CNPJ na página.');
  if (sinais.contato) c += 10; else faltou.push('Não achamos contato claro (e-mail, telefone ou endereço).');
  if (sinais.emailMesmoDominio) c += 5;
  if (sinais.politicas) c += 15; else faltou.push('Não achamos política de trocas, privacidade ou entrega.');
  if (sinais.gateway) c += 10;
  if (sinais.formExterno) { c -= 20; alertas.push('O formulário envia os seus dados para outro site.'); }
  if (sinais.pressao) { c -= 15; alertas.push('A página usa mensagens de pressão (tempo curto, poucas unidades).'); }
  if (sinais.desconto) { c -= 15; alertas.push('A página promete descontos exagerados.'); }
  if (pontosDoEndereco > 0) c -= Math.min(pontosDoEndereco, 40);
  return { confianca: Math.max(0, Math.min(100, c)), motivos: [...alertas, ...faltou] };
}

function limiteConfianca(rigor) { return rigor === 'normal' ? 60 : 75; }

async function avaliarPagina(host, protocolo, sinais) {
  const pre = await analisar(host, protocolo, { rapido: true });
  if (pre.conhecido || pre.permitido || pre.pontos >= 100) return pre;     // provado, liberado ou já na lista
  const cfg = await lerConfig();
  const r = avaliarHost(host);
  const comercio = !!(sinais.pagamento || sinais.venda);
  // A idade só é consultada quando a página mostra venda, dinheiro, senha ou pressão (privacidade).
  const precisaIdade = comercio || sinais.senha || sinais.pressao || sinais.formExterno || cfg.consultaIdade;
  const gratuito = sufixo(host, HOSPEDAGEM);                  // subdomínio grátis: a idade é do serviço, não da loja
  const dias = (precisaIdade && !gratuito && !ehIPv4(r.dominio)) ? await idadeEmDias(r.dominio) : null;

  if (comercio) {
    const limite = limiteConfianca(cfg.rigor);
    const c = pontuarConfianca(sinais, dias, protocolo, r.pontos, gratuito);
    const motivos = [...r.motivos, ...c.motivos];
    const nivel = c.confianca > limite ? 'ok' : (c.confianca < 30 ? 'perigo' : 'atencao');
    return { nivel, pontos: 100 - c.confianca, confianca: c.confianca, limite, comercio: true,
      motivos, dominio: r.dominio, conhecido: false, provado: nivel === 'ok', dias };
  }
  let pontos = r.pontos + (protocolo === 'http:' ? 10 : 0);
  const motivos = [...r.motivos];
  if (protocolo === 'http:') motivos.push('O site não usa conexão segura (sem cadeado).');
  const res = pontuarPagina(pontos, motivos, sinais, dias, cfg.rigor);
  const nivel = nivelPorRigor(res.pontos, cfg.rigor);
  return { nivel, pontos: res.pontos, motivos: res.motivos, dominio: r.dominio, conhecido: false,
    provado: nivel === 'ok' && dias !== null && dias >= 365, dias };
}

// ---------- Bloqueio antes de a página abrir ----------
function bloquear(tabId, url) {
  const alvo = chrome.runtime.getURL('bloqueado.html') + '?u=' + encodeURIComponent(url);
  return chrome.tabs.update(tabId, { url: alvo }).catch(() => {});
}

chrome.webNavigation.onBeforeNavigate.addListener(async (d) => {
  if (d.frameId !== 0) return;
  let u;
  try { u = new URL(d.url); } catch (e) { return; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
  const res = await analisar(u.hostname.toLowerCase(), u.protocol, { rapido: true });
  if (res.nivel === 'perigo') bloquear(d.tabId, d.url);
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
      if (sender.tab) selo(sender.tab.id, estadoSelo(res));
      if (res.nivel === 'perigo' && sender.tab && typeof msg.url === 'string') {
        try {
          const u = new URL(msg.url);
          if (u.hostname.toLowerCase() === host) bloquear(sender.tab.id, msg.url);
        } catch (e) { /* ignora */ }
      }
      return res;
    }
    case 'avaliar-pagina': {
      if (!hostValido(msg.host) || !protocoloValido(msg.protocolo) || !msg.sinais) return null;
      const sinais = {};
      for (const k of SINAIS_CHAVES) sinais[k] = msg.sinais[k] === true;
      const host = msg.host.toLowerCase();
      const res = await avaliarPagina(host, msg.protocolo, sinais);
      if (sender.tab) selo(sender.tab.id, res.provado ? 'ok' : estadoSelo(res));
      if (res.nivel === 'perigo' && sender.tab && typeof msg.url === 'string') {
        try { if (new URL(msg.url).hostname.toLowerCase() === host) bloquear(sender.tab.id, msg.url); } catch (e) { /* ignora */ }
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
    case 'status':
    case 'detalhes': {
      let u;
      try { u = new URL(msg.url); } catch (e) { return null; }
      if (!protocoloValido(u.protocol)) return null;
      return { ...(await analisar(u.hostname.toLowerCase(), u.protocol)), host: u.hostname };
    }
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
