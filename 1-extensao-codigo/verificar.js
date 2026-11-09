'use strict';
/* Isso é golpe? · tela "Verificar um link". É o aplicativo do celular e também uma tela da extensão (aberta pelo popup).
   As regras, as listas, os pesos, o modelo de aprendizado de máquina e as consultas vêm do próprio background.js
   da extensão, carregado nesta página (veja ponte.js). Não há cópia: muda num lugar, muda nos dois.
   Divisão de trabalho: esta tela confere o LINK antes de abrir; a extensão confere cada PÁGINA depois que ela abre.

   Diferença da extensão: o aplicativo não vê a página, só o link. Por isso a conta começa em 50%
   (link desconhecido), tira os pontos de risco do endereço e depois soma ou tira as provas
   (idade do site, empresa, consumidor.gov.br, Reclame Aqui), com os mesmos pesos da tela de bloqueio. */

const $ = (id) => document.getElementById(id);
const PARTIDA_APP = 50;
const telas = ['telaInicio', 'telaCarregando', 'telaResultado', 'telaAjustes'];
let atual = null;          // último resultado mostrado
let confirmarAbrir = false;

// ---------- Telas ----------
function mostrar(tela, empurrar = true) {
  for (const t of telas) $(t).hidden = t !== tela;
  if (empurrar) history.pushState({ tela }, '', tela === 'telaInicio' ? location.pathname : '#' + tela.replace('tela', '').toLowerCase());
  window.scrollTo(0, 0);
  const h = $(tela).querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}
window.addEventListener('popstate', (e) => {
  const t = (e.state && e.state.tela) || 'telaInicio';
  mostrar(t === 'telaCarregando' ? 'telaInicio' : t, false);
});

// ---------- Ler o link de um texto (o WhatsApp manda o link junto com a mensagem) ----------
function extrairLink(texto) {
  const t = String(texto || '').trim();
  let m = t.match(/https?:\/\/[^\s<>"']+/i);
  let s = m ? m[0] : null;
  if (!s) { m = t.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/i); s = m ? 'https://' + m[0] : null; }
  if (!s) return null;
  s = s.replace(/[).,;:!?»”"']+$/, '');
  try {
    const u = new URL(s);
    if (!protocoloValido(u.protocol) || !hostValido(u.hostname)) return null;
    return u;
  } catch (e) { return null; }
}

// ---------- Verificação (mesmas funções da extensão) ----------
async function verificarLink(u) {
  const host = u.hostname.toLowerCase();
  const cfg = await lerConfig();
  const limite = limiteConfianca(cfg.rigor);
  const r = avaliarHost(host);
  if (ehConhecido(host)) {
    return { nivel: 'ok', confianca: 100, limite, host, dominio: r.dominio, url: u.href, motivos: [],
      itens: [{ efeito: 'favor', titulo: 'Site conhecido', texto: 'Está na lista de sites oficiais conhecidos.' }] };
  }
  const lista = await estaNaLista(host);
  const gratuito = sufixo(host, HOSPEDAGEM);
  const ml = gratuito ? null : await sinalML(r.dominio);
  const rdap = (gratuito || ehIPv4(r.dominio)) ? { dias: null, cnpj: null, pf: false } : await consultarRdap(r.dominio);
  const empresa = rdap.cnpj ? await consultarCnpj(rdap.cnpj) : null;
  const consumidor = await buscarConsumidor([r.dominio.split('.')[0], empresa && empresa.fantasia, empresa && empresa.razao].filter(Boolean));
  const risco = r.pontos + (ml ? ml.pontos : 0) + (u.protocol === 'http:' ? 10 : 0);
  const res = confiancaDaVerificacao({ confianca: Math.max(0, PARTIDA_APP - risco) }, {
    lista, dias: rdap.dias, gratuito, protocolo: u.protocol, empresa, pf: rdap.pf,
    br: r.dominio.endsWith('.br'), consumidor, ra: await notaRA(r.dominio), ml });
  const motivos = [...r.motivos];
  if (ml && ml.motivo) motivos.push(ml.motivo);
  if (lista === 'procon') motivos.unshift(MOTIVO_PROCON);
  else if (lista) motivos.unshift('Este site consta em listas públicas de golpes e vírus.');
  let nivel = res.confianca >= limite ? 'ok' : (res.confianca < 30 ? 'perigo' : 'atencao');
  if (lista && lista !== 'procon') nivel = 'perigo';
  return { ...res, nivel, limite, host, dominio: r.dominio, url: u.href, motivos };
}

// ---------- Resultado ----------
const SIMBOLOS = {
  ok: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="currentColor"/><path d="M18 33l9 9 19-20" fill="none" stroke="var(--simb)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  atencao: '<svg viewBox="0 0 64 64"><path d="M32 4L61 58H3z" fill="currentColor"/><rect x="29" y="22" width="6" height="20" rx="3" fill="var(--simb)"/><circle cx="32" cy="49" r="3.5" fill="var(--simb)"/></svg>',
  perigo: '<svg viewBox="0 0 64 64"><path d="M20 3h24l17 17v24L44 61H20L3 44V20z" fill="currentColor"/><path d="M22 22l20 20M42 22L22 42" stroke="var(--simb)" stroke-width="6" stroke-linecap="round"/></svg>'
};
const TITULOS = { ok: 'Confiável', atencao: 'Atenção', perigo: 'Perigo' };
const FAZER = {
  ok: ['Pode abrir o site.', 'Mesmo assim, nunca passe senha ou código que chegou por mensagem.'],
  atencao: ['Não pague nem digite senha agora.', 'Confira no Reclame Aqui ou pergunte para alguém de confiança.',
    'Prefira entrar pelo aplicativo ou pelo site oficial da empresa.'],
  perigo: ['Não abra este link.', 'Não digite senha, dados do cartão nem códigos.',
    'Se você já pagou ou passou seus dados, ligue para o seu banco.']
};
const ICONES = { favor: '✓', contra: '✗', neutro: '•' };

function lista(el, textos) {
  el.replaceChildren(...textos.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
}

async function mostrarResultado(res) {
  atual = res;
  confirmarAbrir = false;
  const c = $('cartao');
  c.className = 'cartao ' + res.nivel;
  c.style.setProperty('--simb', getComputedStyle(c).backgroundColor);
  $('simbolo').innerHTML = SIMBOLOS[res.nivel];
  $('tResultado').textContent = TITULOS[res.nivel];
  $('site').textContent = res.host;
  $('confiancaTexto').textContent = 'Confiança: ' + res.confianca + '%';
  $('barraValor').style.width = res.confianca + '%';
  $('barraLimite').style.left = 'calc(' + res.limite + '% - 2px)';
  $('limiteTexto').textContent = 'Para ser confiável, precisa ter ' + res.limite + '% ou mais.';
  lista($('oQueFazer'), FAZER[res.nivel]);
  $('blocoMotivos').hidden = !res.motivos.length;
  lista($('motivos'), res.motivos);
  $('itens').replaceChildren(...res.itens.map((i) => {
    const li = document.createElement('li'); li.className = i.efeito;
    const ic = document.createElement('span'); ic.className = 'ic'; ic.setAttribute('aria-hidden', 'true'); ic.textContent = ICONES[i.efeito] || '•';
    const tx = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = i.titulo + (i.efeito === 'favor' ? ' (a favor)' : i.efeito === 'contra' ? ' (contra)' : '');
    tx.append(b, document.createTextNode(i.texto));
    li.append(ic, tx); return li;
  }));
  const { reclameAqui = {} } = await chrome.storage.local.get('reclameAqui');
  $('notaRA').value = (reclameAqui[res.dominio] && reclameAqui[res.dominio].nota) || '';

  const { pessoaConfianca: p } = await chrome.storage.local.get('pessoaConfianca');
  const temPessoa = EGolpePessoa.valida(p) && EGolpePessoa.telefone(p.telefone);
  const precisa = res.nivel !== 'ok';
  $('perguntar').hidden = !(precisa && temPessoa);
  $('cadastrarPessoa').hidden = !(precisa && !temPessoa);
  if (precisa && temPessoa) {
    const n = EGolpePessoa.primeiroNome(p.nome);
    $('perguntar').textContent = 'Perguntar para ' + n + ' se é golpe';
    $('perguntar').href = EGolpePessoa.linkWhats(p, 'Oi, ' + n + '! Recebi este link e o Isso é golpe? disse que pode ser golpe. ' +
      'Você pode ver para mim antes de eu abrir?\n\n' + res.url + '\n\n(Cuidado ao abrir: se puder, confira antes no Reclame Aqui.)');
  }
  $('abrirSite').textContent = res.nivel === 'ok' ? 'Abrir o site' : 'Abrir o site mesmo assim';
  $('avisoAbrir').hidden = true;
  if (EGolpeModo === 'extensao' && res.nivel === 'ok') {
    $('avisoAbrir').textContent = 'Depois que o site abrir, a extensão continua conferindo a página.';
    $('avisoAbrir').hidden = false;
  }
  const cfg = await lerConfig();
  $('ouvir').hidden = !cfg.vozAutomatica;      // v3.16: "Ouvir o resultado" só para quem marcou a voz na boas-vindas
  if (cfg.vozAutomatica) falarResultado();
}

function textoFalado(res) {
  return TITULOS[res.nivel] + '. Site ' + res.host.replace(/\./g, ' ponto ') + '. Confiança: ' + res.confianca +
    ' por cento. Para ser confiável, precisa ter ' + res.limite + ' por cento ou mais. ' +
    res.motivos.join(' ') + ' O que fazer: ' + FAZER[res.nivel].join(' ');
}
function falarResultado() {
  if (!atual || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const f = new SpeechSynthesisUtterance(textoFalado(atual));
  f.lang = 'pt-BR'; f.rate = 0.9;
  speechSynthesis.speak(f);
}

async function conferir(texto) {
  const u = extrairLink(texto);
  if (!u) {
    $('erroLink').textContent = 'Não achamos um link nesse texto. Cole o endereço completo, por exemplo: https://site.com.br';
    $('erroLink').hidden = false;
    $('link').focus();
    return;
  }
  $('erroLink').hidden = true;
  mostrar('telaCarregando', false);
  let res;
  try { res = await verificarLink(u); }
  catch (e) {
    console.error(e);
    mostrar('telaInicio', false);
    $('erroLink').textContent = 'Não conseguimos conferir agora. Tente de novo em alguns segundos.';
    $('erroLink').hidden = false;
    return;
  }
  await mostrarResultado(res);
  mostrar('telaResultado');
}

// ---------- Listas de golpes ----------
async function textoListas() {
  const { atualizadoEm } = await chrome.storage.local.get('atualizadoEm');
  if (!atualizadoEm) return 'As listas de golpes ainda não foram baixadas neste aparelho.';
  const d = new Date(atualizadoEm);
  return 'Listas de golpes atualizadas em ' + d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.';
}
async function mostrarListas(extra) {
  const t = extra || await textoListas();
  $('estadoListas').textContent = t; $('estadoListas2').textContent = t;
}
async function baixarListas(forcar) {
  const { atualizadoEm } = await chrome.storage.local.get('atualizadoEm');
  // Dentro da extensão, quem baixa as listas é o service worker; esta tela só pede para ele.
  if (EGolpeModo === 'extensao') {
    if (forcar) { mostrarListas('Baixando as listas de golpes…'); await EGolpeChromeReal.runtime.sendMessage({ tipo: 'atualizar-listas' }).catch(() => {}); }
    return mostrarListas();
  }
  if (!forcar && atualizadoEm && Date.now() - atualizadoEm < 86400000) return mostrarListas();
  if (!navigator.onLine) return mostrarListas('Sem internet: as listas de golpes serão baixadas quando a conexão voltar.');
  mostrarListas('Baixando as listas de golpes…');
  await atualizarListas();
  const depois = (await chrome.storage.local.get('atualizadoEm')).atualizadoEm;
  mostrarListas(depois && depois !== atualizadoEm ? null : 'Não foi possível baixar as listas agora. As outras conferências continuam funcionando.');
}

// ---------- Ajustes ----------
async function aplicarVisual() {
  const cfg = await lerConfig();
  document.documentElement.classList.toggle('grande', !!cfg.modoSimples);
  document.documentElement.classList.toggle('daltonico', !!cfg.daltonico);
}
async function abrirAjustes() {
  const cfg = await lerConfig();
  const { pessoaConfianca: p = {} } = await chrome.storage.local.get('pessoaConfianca');
  $('pNome').value = p.nome || ''; $('pTel').value = p.telefone || '';
  $('oGrande').checked = !!cfg.modoSimples; $('oVoz').checked = !!cfg.vozAutomatica; $('oDalt').checked = !!cfg.daltonico;
  $('salvo').hidden = true; $('erroPessoa').hidden = true;
  mostrarListas();
  mostrar('telaAjustes');
}
$('formAjustes').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = $('pNome').value.trim(), tel = $('pTel').value.trim();
  if ((nome || tel) && !(nome && EGolpePessoa.telefone(tel))) {
    $('erroPessoa').textContent = !nome ? 'Escreva o nome da pessoa.' : 'Confira o WhatsApp: use o DDD e o número, por exemplo (11) 98765-4321.';
    $('erroPessoa').hidden = false; return;
  }
  $('erroPessoa').hidden = true;
  const { config = {} } = await chrome.storage.local.get('config');
  await chrome.storage.local.set({
    config: { ...config, modoSimples: $('oGrande').checked, vozAutomatica: $('oVoz').checked, daltonico: $('oDalt').checked },
    pessoaConfianca: nome ? { nome, telefone: tel } : null
  });
  await aplicarVisual();
  $('salvo').hidden = false;
});

// ---------- Botões ----------
$('formLink').addEventListener('submit', (e) => { e.preventDefault(); conferir($('link').value); });
$('colar').addEventListener('click', async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (t) { $('link').value = t; conferir(t); return; }
  } catch (e) { /* o navegador não deixou ler: a pessoa cola à mão */ }
  $('erroLink').textContent = 'Segure o dedo na caixa acima e toque em “Colar”.';
  $('erroLink').hidden = false;
  $('link').focus();
});
document.querySelectorAll('.btn-exemplo').forEach((b) => b.addEventListener('click', () => { $('link').value = b.dataset.link; conferir(b.dataset.link); }));
$('outroLink').addEventListener('click', () => { $('link').value = ''; mostrar('telaInicio'); });
$('irInicio').addEventListener('click', (e) => { e.preventDefault(); mostrar('telaInicio'); });
$('abrirAjustes').addEventListener('click', abrirAjustes);
$('cadastrarPessoa').addEventListener('click', abrirAjustes);
$('voltarAjustes').addEventListener('click', () => history.back());
$('ouvir').addEventListener('click', falarResultado);
$('atualizarListas').addEventListener('click', () => baixarListas(true));
// v3.14: o link abre direto a nota do site no Detector do Reclame Aqui (no computador e no celular).
$('reclameAqui').addEventListener('click', () => {
  if (atual) $('reclameAqui').href = self.EGolpeRA.link(atual.host);
});
$('notaRA').addEventListener('change', async () => {
  if (!atual) return;
  const { reclameAqui = {} } = await chrome.storage.local.get('reclameAqui');
  if ($('notaRA').value) reclameAqui[atual.dominio] = { nota: $('notaRA').value, t: Date.now() };
  else delete reclameAqui[atual.dominio];
  await chrome.storage.local.set({ reclameAqui });
  const u = extrairLink(atual.url);
  if (u) await mostrarResultado(await verificarLink(u));
});
$('abrirSite').addEventListener('click', () => {
  if (!atual) return;
  if (atual.nivel !== 'ok' && !confirmarAbrir) {
    confirmarAbrir = true;
    $('avisoAbrir').textContent = 'Tem certeza? Toque de novo para abrir. Não digite senha nem dados do cartão.' +
      (EGolpeModo === 'extensao' ? ' A extensão vai continuar de olho na página e pode bloquear o site.' : '');
    $('avisoAbrir').hidden = false;
    $('abrirSite').textContent = 'Sim, abrir mesmo assim';
    return;
  }
  window.open(atual.url, '_blank', 'noopener');
});

// ---------- Início ----------
(async () => {
  await aplicarVisual();
  history.replaceState({ tela: 'telaInicio' }, '', location.pathname + location.search);
  if (EGolpeModo === 'aplicativo' && 'serviceWorker' in navigator) navigator.serviceWorker.register('app-sw.js').catch(() => {});
  $('juntosEstado').textContent = EGolpeModo === 'extensao'
    ? 'Você está usando a extensão: ela já protege as páginas deste computador.'
    : 'No computador, instale também a extensão Isso é golpe? no Chrome.';
  if (EGolpeModo === 'extensao') $('dicaCompartilhar').hidden = true;
  // Link que chegou pelo "Compartilhar" do Android (share_target no manifest).
  const q = new URLSearchParams(location.search);
  const compartilhado = [q.get('url'), q.get('text'), q.get('title')].filter(Boolean).join(' ');
  if (compartilhado) {
    history.replaceState({ tela: 'telaInicio' }, '', location.pathname);
    $('link').value = compartilhado;
    conferir(compartilhado);
  }
  baixarListas(false);
})();
