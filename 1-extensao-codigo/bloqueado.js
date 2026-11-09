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
let contaDaPagina = null;   // a porcentagem que causou o bloqueio (loja), quando houver

const limiteDaConfig = () => (config.rigor === 'normal' ? 60 : 80);

const ICONES ={ contra: ['✗', 'Contra'], favor: ['✓', 'A favor'], neutro: ['•', 'Informação'] };

function li(texto) {
  const e = document.createElement('li');
  e.textContent = texto;
  return e;
}

function textoParaOuvir() {
  let t = contaDaPagina && contaDaPagina.cnpj === 'estrangeira'
    ? 'Esta é uma loja estrangeira. Ela está fora dos nossos cuidados, mas o que podemos dizer sobre ela é o seguinte. '
    : 'Pare. Alerta de golpe. Bloqueamos este site para proteger você. ';
  if (verificacao || contaDaPagina) t += 'Confiança neste site: ' + (verificacao || contaDaPagina).confianca + ' por cento. Para ser confiável, precisa ter ' + ((verificacao || contaDaPagina).limite || 90) + ' por cento ou mais. ';
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

// Loja estrangeira (v3.7): outro título e outro texto, e as provas que conseguimos ver ficam abertas.
function avisoEstrangeira() {
  $('titulo').textContent = 'Esta é uma loja estrangeira';
  const fora = document.createElement('p');
  fora.className = 'fora';
  fora.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4L61 58H3z" fill="#1a1200"/>' +
    '<rect x="29" y="22" width="6" height="20" rx="3" fill="#fff8e6"/><circle cx="32" cy="49" r="3.5" fill="#fff8e6"/></svg>';
  fora.append('Ela está fora dos nossos cuidados.');
  $('texto').before(fora);
  $('texto').textContent = 'Ela não tem CNPJ e não segue as leis brasileiras de defesa do consumidor. ' +
    'Mas o que podemos dizer sobre ela está logo abaixo.';
  motivos = motivos.filter((m) => !/^Esta é uma loja estrangeira/.test(m));
  $('detalhes').open = true;
}

// v3.17: duas listas coloridas (o que pesa contra e o que pesa a favor). Linhas que chegam depois entram na lista certa.
const linhaFavor = (t) => /conferido na Receita Federal|faz parte do mesmo grupo|aparece nos arquivos desde|está entre os|primeiro certificado público deste domínio é de \d{4}/.test(String(t));
const contagem = { contra: 0, favor: 0 };
function adicionarItem(tipo, texto) {
  if (typeof texto !== 'string' || !texto) return;
  const ul = $(tipo === 'favor' ? 'listaFavor' : 'listaContra');
  const item = document.createElement('li'); item.textContent = texto; ul.appendChild(item);
  contagem[tipo]++;
  $(tipo === 'favor' ? 'tituloFavor' : 'tituloContra').textContent = (tipo === 'favor' ? '✓ Pontos a favor' : '⚠ Pontos de atenção') + ' (' + contagem[tipo] + ')';
  $(tipo === 'favor' ? 'cartaoFavor' : 'cartaoContra').hidden = false;
}
function mostrarMotivos() {
  const limite = config.modoSimples ? 3 : 6;
  $('listaContra').replaceChildren(); $('listaFavor').replaceChildren(); contagem.contra = 0; contagem.favor = 0;
  $('cartaoContra').hidden = true; $('cartaoFavor').hidden = true;
  const conta = contaDaPagina;
  const contra = conta && Array.isArray(conta.contra) ? conta.contra : motivos.filter((m) => !/^A favor:/.test(m)).map((m) => m.replace(/^Contra:\s*/, ''));
  const favor = conta && Array.isArray(conta.favor) ? conta.favor : motivos.filter((m) => /^A favor:/.test(m)).map((m) => m.replace(/^A favor:\s*/, ''));
  contra.slice(0, limite).forEach((t) => adicionarItem('contra', t));
  favor.slice(0, limite).forEach((t) => adicionarItem('favor', t));
}

// Mostra a porcentagem. Só é confiável quem CHEGA ao limite (80% ou mais no rigor padrão).
function mostrarConfianca(confianca, limite) {
  $('confNum').textContent = confianca + '%';
  $('confBarra').style.width = confianca + '%';
  $('confLimite').style.left = 'calc(' + limite + '% - 2px)';
  $('resumo').textContent = 'confiável só com ' + limite + '% ou mais';
}

function mostrarVerificacao(v) {
  // Loja bloqueada pela página: a lista de provas aparece, mas o número continua o da página (um número só).
  verificacao = contaDaPagina ? { ...v, confianca: contaDaPagina.confianca, limite: contaDaPagina.limite || v.limite } : v;
  mostrarConfianca(verificacao.confianca, verificacao.limite || limiteDaConfig());
  $('verif').replaceChildren(...v.itens.map((it) => {
    const [ic, rot] = ICONES[it.efeito] || ICONES.neutro;
    const e = document.createElement('li');
    e.className = it.efeito;
    const i = document.createElement('span'); i.className = 'ic'; i.setAttribute('role', 'img'); i.setAttribute('aria-label', rot); i.textContent = ic;
    const corpo = document.createElement('span');
    const r = document.createElement('span'); r.className = 'rot'; r.textContent = it.titulo + ': ';
    corpo.append(r, it.texto);
    e.append(i, corpo);
    return e;
  }));
  $('caixaVerif').hidden = false;
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
    if (!whats) $('perguntarTxt').textContent = 'Perguntar para ' + nome + ' por e-mail';
    b.addEventListener('click', () => { location.href = email; });
  }
  $('copiarMsg').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(msg); $('copiarMsg').textContent = 'Mensagem copiada'; }
    catch (e) { $('copiarMsg').textContent = 'Não foi possível copiar'; }
  });
}

async function iniciar() {
  const dados = await chrome.storage.local.get(['config', 'pessoaConfianca']);
  config = dados.config || {};
  pessoa = dados.pessoaConfianca || null;
  document.body.classList.toggle('grande', !!config.modoSimples);
  document.documentElement.classList.toggle('daltonico', !!config.daltonico);
  document.body.classList.toggle('daltonico', !!config.daltonico);
  // v3.16 (opcional, desligado por padrão): consulta a nota no Reclame Aqui em segundo plano e mostra aqui, com o link
  if (url) $('ra').href = self.EGolpeRA.link(url.hostname);
  // v3.17: confirmações abertas (Tranco, Internet Archive, crt.sh): cada linha entra na lista certa quando chega
  if (url && config.confirmacoes !== false) {
    const entra = (linha) => { if (typeof linha === 'string') adicionarItem(linhaFavor(linha) ? 'favor' : 'contra', linha); };
    chrome.runtime.sendMessage({ tipo: 'confirmacoes' }).then((r) => { if (r && Array.isArray(r.linhas)) r.linhas.slice(0, 3).forEach(entra); }).catch(() => {});
    chrome.runtime.sendMessage({ tipo: 'confirmacao-crt' }).then((r) => { if (r) entra(r.linha); }).catch(() => {});
  }
  if (config.raAuto !== false && url) {
    chrome.runtime.sendMessage({ tipo: 'ra-nota' }).then((ra) => {
      if (!ra || !ra.ok || !/^https:\/\/www\.reclameaqui\.com\.br\/detector-site-confiavel\/[a-z0-9.-]+$/.test(ra.link || '')) return;
      if (ra.bloqueado) $('raNota').textContent = 'O Reclame Aqui não deixou consultar a nota automaticamente.';
      else if (ra.nota === undefined) $('raNota').textContent = 'O Reclame Aqui ainda não analisou este site.';
      else {
        $('raNota').textContent = 'De acordo com o Reclame Aqui:';
        const n = Math.max(0, Math.min(5, Number(ra.nota) || 0));
        $('raEscudos').setAttribute('aria-label', n + ' de 5 escudos');
        for (let i = 0; i < 5; i++) {
          const e = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          e.setAttribute('viewBox', '0 0 24 28'); e.setAttribute('width', '26'); e.setAttribute('height', '30'); e.setAttribute('aria-hidden', 'true'); e.style.marginRight = '4px';
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          c.setAttribute('d', 'M12 1.5 21.5 5v8.2c0 6-4 10.3-9.5 13.3C6.5 23.5 2.5 19.2 2.5 13.2V5z');
          c.setAttribute('fill', i < n ? '#fff' : 'none'); c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', '1.8'); if (i >= n) c.setAttribute('stroke-opacity', '.55');
          e.appendChild(c);
          if (i < n) {
            const v = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            v.setAttribute('d', 'M7.5 13.5l3.2 3.2 6-6.4'); v.setAttribute('fill', 'none'); v.setAttribute('stroke', '#056734');
            v.setAttribute('stroke-width', '2.4'); v.setAttribute('stroke-linecap', 'round'); v.setAttribute('stroke-linejoin', 'round');
            e.appendChild(v);
          }
          $('raEscudos').appendChild(e);
        }
        $('raTexto').textContent = n + ' de 5 escudos (' + ra.rotulo + ')';
      }
      $('raTopo').hidden = false;
    }).catch(() => {});
  }

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
    if (res && res.conta && typeof res.conta.confianca === 'number') {
      contaDaPagina = res.conta;               // loja: mostra exatamente a porcentagem calculada na página
      mostrarConfianca(res.conta.confianca, res.conta.limite || limiteDaConfig());
      if (res.conta.cnpj === 'estrangeira') avisoEstrangeira();
    } else mostrarConfianca(Math.max(0, 100 - Math.max(70, pontos)), limiteDaConfig());
    // v3.15: o botão do site oficial da marca imitada (o que foi conferido do CNPJ agora está nas duas listas)
    const conta = res && res.conta;
    if (conta && conta.oficial && /^[a-z0-9.-]+$/.test(conta.oficial.host || '')) {
      $('oficial').hidden = false;
      $('oficial').textContent = 'Abrir o site oficial (' + conta.oficial.host + ')';
      $('oficial').addEventListener('click', () => chrome.tabs.create({ url: 'https://' + conta.oficial.host + '/' }));
    }
  } catch (e) { motivos = []; mostrarConfianca(0, limiteDaConfig()); }
  mostrarMotivos();
  $('ouvir').closest('section').hidden = !config.vozAutomatica;     // v3.16: "Ouvir o aviso" só para quem marcou a voz na boas-vindas
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

// v3.16.3: o botão verde é o link direto para a nota do site no Reclame Aqui (definido quando a tela abre)

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
