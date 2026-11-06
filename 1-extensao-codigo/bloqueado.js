'use strict';

const $ = (id) => document.getElementById(id);
const P = self.EGolpePessoa;
const alvo = new URLSearchParams(location.search).get('u');
let url = null;
try {
  url = new URL(alvo);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') url = null;
} catch (e) { url = null; }

let config = {};
let pessoa = null;
let motivos = [];
let verificacao = null;

const limiteDaConfig = () => (config.rigor === 'normal' ? 60 : 80);

const ICONES ={ contra: ['✗', 'Contra'], favor: ['✓', 'A favor'], neutro: ['•', 'Informação'] };

function li(texto) {
  const e = document.createElement('li');
  e.textContent = texto;
  return e;
}

function textoParaOuvir() {
  let t = 'Pare. ' + $('titulo').textContent + '. ';
  if (verificacao) t += 'Confiança neste site: ' + verificacao.confianca + ' por cento. ';
  t += motivos.slice(0, config.modoSimples ? 2 : 4).join(' ') + ' ';
  t += 'Não digite senha, CPF nem dados do cartão. ';
  if (pessoa) t += 'Se quiser, aperte o botão para perguntar a ' + P.primeiroNome(pessoa.nome) + ' se é golpe.';
  return t;
}

function falar(texto) {
  try { chrome.tts.stop(); chrome.tts.speak(texto, { lang: 'pt-BR', rate: 0.9 }); return true; } catch (e) { /* sem voz */ }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR'; u.rate = 0.9;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    return true;
  }
  return false;
}

function mostrarMotivos() {
  const lista = motivos.slice(0, config.modoSimples ? 3 : 8);
  $('motivos').replaceChildren(...lista.map(li));
  $('caixaMotivos').hidden = !lista.length;
}

// Mostra a porcentagem. Só é confiável quem PASSA do limite (mais de 80% no rigor padrão).
function mostrarConfianca(confianca, limite) {
  $('confNum').textContent = 'Confiança: ' + confianca + '%';
  $('confBarra').style.width = confianca + '%';
  $('confLimite').style.left = 'calc(' + limite + '% - 2px)';
  $('resumo').textContent = 'Para ser considerado confiável, o site precisa passar de ' + limite + '%. Este tem ' + confianca + '%' +
    (confianca < 30 ? ': muito baixa. Tem cara de golpe.' : confianca <= limite ? ': não é confiável. Não pague nem digite dados.' : '.');
}

function mostrarVerificacao(v) {
  verificacao = v;
  mostrarConfianca(v.confianca, v.limite || limiteDaConfig());
  $('verif').replaceChildren(...v.itens.map((it) => {
    const [ic, rot] = ICONES[it.efeito] || ICONES.neutro;
    const e = document.createElement('li');
    e.className = it.efeito;
    const i = document.createElement('span'); i.className = 'ic'; i.setAttribute('aria-hidden', 'true'); i.textContent = ic;
    const corpo = document.createElement('span');
    const r = document.createElement('span'); r.className = 'rot'; r.textContent = it.titulo + ' (' + rot.toLowerCase() + '): ';
    corpo.append(r, it.texto);
    e.append(i, corpo);
    return e;
  }));
  $('caixaVerif').hidden = false;
  if (config.modoSimples) $('detalhesVerif').open = false;   // modo simples: só o essencial, detalhes num clique
}

function prepararPessoa() {
  if (!url) return;
  if (!P.valida(pessoa)) { $('semPessoa').hidden = false; return; }
  const msg = P.mensagem(pessoa.nome, url.href);
  const whats = P.linkWhats(pessoa, msg);
  const email = P.linkEmail(pessoa, msg);
  const nome = P.primeiroNome(pessoa.nome);
  $('perguntarTxt').textContent = 'Perguntar para ' + nome + ' se é golpe';
  $('outrosEnvios').hidden = false;
  if (whats) {
    $('perguntar').hidden = false;
    $('perguntar').addEventListener('click', () => window.open(whats, '_blank', 'noopener'));
  }
  if (email) {
    const b = whats ? $('perguntarEmail') : $('perguntar');
    b.hidden = false;
    if (!whats) $('perguntar').querySelector('.sub').textContent = 'Envia o link deste site por e-mail';
    else b.textContent = 'Perguntar para ' + nome + ' por e-mail';
    b.addEventListener('click', () => { location.href = email; });
  }
  $('copiarMsg').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(msg); $('copiarMsg').textContent = 'Mensagem copiada: cole no aplicativo que preferir'; }
    catch (e) { $('copiarMsg').textContent = 'Não foi possível copiar'; }
  });
}

async function iniciar() {
  const dados = await chrome.storage.local.get(['config', 'pessoaConfianca']);
  config = dados.config || {};
  pessoa = dados.pessoaConfianca || null;
  document.body.classList.toggle('grande', !!config.modoSimples);
  document.body.classList.toggle('daltonico', !!config.daltonico);

  if (!url) {
    $('host').textContent = 'Endereço inválido';
    $('continuar').hidden = true;
    $('confNum').textContent = '—';
    return;
  }
  $('host').textContent = url.hostname;
  prepararPessoa();

  try {
    const res = await chrome.runtime.sendMessage({ tipo: 'detalhes', url: url.href });
    motivos = (res && res.motivos) || [];
    // A porcentagem aparece na hora (mesma conta da verificação: site bloqueado começa com no máximo 30%).
    // Quando a verificação completa termina, o número é ajustado com as provas encontradas.
    const pontos = res && typeof res.pontos === 'number' ? res.pontos : 100;
    mostrarConfianca(Math.max(0, 100 - Math.max(70, pontos)), limiteDaConfig());
  } catch (e) { motivos = []; mostrarConfianca(0, limiteDaConfig()); }
  mostrarMotivos();
  if (config.vozAutomatica) falar(textoParaOuvir());

  try {
    const v = await chrome.runtime.sendMessage({ tipo: 'investigar', url: url.href });
    if (v) mostrarVerificacao(v);              // sem resposta: fica a porcentagem que já está na tela
  } catch (e) { /* sem resposta: fica a porcentagem que já está na tela */ }
}

$('voltar').addEventListener('click', async () => {
  try { chrome.tts.stop(); } catch (e) { /* sem voz */ }
  if (history.length > 1) { history.back(); return; }
  try {
    const aba = await chrome.tabs.getCurrent();
    await chrome.tabs.remove(aba.id);
  } catch (e) { window.close(); }
});

$('ra').addEventListener('click', async () => {
  if (url) {
    const dominio = url.hostname.replace(/^www\./, '');
    try { await navigator.clipboard.writeText(dominio); $('raSub').textContent = 'Endereço copiado (' + dominio + '): cole no campo do Reclame Aqui'; }
    catch (e) { $('raSub').textContent = 'Digite no Reclame Aqui: ' + dominio; }
  }
  chrome.tabs.create({ url: 'https://www.reclameaqui.com.br/detector-site-confiavel/' });
});

$('cadastrar').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

let falando = false;
$('ouvir').addEventListener('click', () => {
  if (falando) {
    try { chrome.tts.stop(); } catch (e) { /* sem voz */ }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    falando = false; $('ouvir').textContent = 'Ouvir o aviso';
    return;
  }
  falando = falar(textoParaOuvir());
  if (falando) $('ouvir').textContent = 'Parar de ouvir';
});

let confirmou = false;
$('continuar').addEventListener('click', async () => {
  if (!url) return;
  if (!confirmou) {                       // segunda confirmação, para evitar clique sem querer
    confirmou = true;
    $('continuar').textContent = 'Tem certeza? Clique de novo para entrar neste site';
    return;
  }
  await chrome.runtime.sendMessage({ tipo: 'permitir', host: url.hostname });
  location.replace(url.href);
});

$('titulo').focus();                    // leitor de tela anuncia o bloqueio ao abrir
iniciar();
