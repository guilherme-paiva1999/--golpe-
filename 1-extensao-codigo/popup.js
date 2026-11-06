'use strict';

const $ = (id) => document.getElementById(id);
const PADRAO = { limite: 3, consultaIdade: false, imagens: false, modoSimples: false, rigor: 'alto', perfis: [], vozAutomatica: false, daltonico: false };
const P = self.EGolpePessoa;
const TEXTO = { ok: 'Nenhum sinal forte de golpe', atencao: 'Atenção: confira antes de pagar', perigo: 'Provável golpe' };

async function lerConfig() {
  const { config } = await chrome.storage.local.get('config');
  return { ...PADRAO, ...(config || {}) };
}
async function salvar(parte) {
  await chrome.storage.local.set({ config: { ...(await lerConfig()), ...parte } });
}

async function demo(nivel) {
  try {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(aba.id, { tipo: 'demo', nivel });
    window.close();
  } catch (e) {
    $('quando').textContent = 'Abra uma página comum (http ou https) e recarregue-a para testar.';
  }
}

async function rotular(rotulo) {
  try {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    let extra = {};
    try { extra = await chrome.tabs.sendMessage(aba.id, { tipo: 'sinais' }) || {}; } catch (e) { /* página sem a extensão */ }
    const r = await chrome.runtime.sendMessage({ tipo: 'rotular', url: aba.url, rotulo, sinais: extra.sinais, nota: extra.nota });
    $('rotulosInfo').textContent = r ? 'Anotado como "' + (rotulo === 'golpe' ? 'golpe' : 'seguro') + '". Total: ' + r.total + '.' : 'Não foi possível anotar esta página.';
  } catch (e) { $('rotulosInfo').textContent = 'Abra uma página comum (http ou https).'; }
}

async function baixar() {
  const { rotulos = [] } = await chrome.storage.local.get('rotulos');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(rotulos, null, 1)], { type: 'application/json' }));
  a.download = 'e-golpe-meus-dados.json';
  a.click();
}

async function abaAtual() {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  return aba;
}

async function prepararRA() {
  const aba = await abaAtual();
  let host = '';
  try { host = new URL(aba.url).hostname.replace(/^www\./, ''); } catch (e) { /* página especial */ }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) { $('notaRA').disabled = true; $('btnRA').disabled = true; return; }
  const { reclameAqui = {} } = await chrome.storage.local.get('reclameAqui');
  const chave = Object.keys(reclameAqui).find((d) => host === d || host.endsWith('.' + d));
  if (chave) $('notaRA').value = reclameAqui[chave].nota;
  $('btnRA').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(host); } catch (e) { /* sem área de transferência */ }
    chrome.tabs.create({ url: 'https://www.reclameaqui.com.br/detector-site-confiavel/' });
  });
  $('notaRA').addEventListener('change', async () => {
    const r = await chrome.runtime.sendMessage({ tipo: 'ra', url: aba.url, nota: $('notaRA').value });
    $('raInfo').textContent = r ? 'Anotado para ' + r.dominio + '. Recarregue a página para ver o efeito.' : 'Não foi possível anotar.';
  });
}

async function mostrarStatus() {
  try {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = aba && aba.url ? await chrome.runtime.sendMessage({ tipo: 'status', url: aba.url }) : null;
    if (!res) { $('pill').textContent = 'Esta página não é analisada'; return; }
    $('pill').className = res.nivel;
    $('pill').textContent = res.conhecido ? '✓ Site conhecido e confiável'
      : (res.nivel === 'ok' ? '? Não verificado: confira antes de pagar' : (res.nivel === 'perigo' ? 'X ' : '! ') + TEXTO[res.nivel]);
    if (!res.conhecido && !res.permitido) {
      const conf = res.confianca !== undefined ? res.confianca : Math.max(0, 100 - res.pontos);
      const d = document.createElement('div');
      d.style.fontSize = '15px';
      const cfg = await lerConfig();
      d.textContent = 'Confiança: ' + conf + '% (confiável só com ' + (cfg.rigor === 'normal' ? 60 : 90) + '% ou mais)';
      $('pill').appendChild(d);
    }
    $('host').firstChild.textContent = res.host;
    for (const m of res.motivos) {
      const li = document.createElement('li');
      li.textContent = m;
      $('motivos').appendChild(li);
    }
  } catch (e) {
    $('pill').textContent = 'Não foi possível analisar';
  }
}

async function prepararPessoa() {
  const { pessoaConfianca } = await chrome.storage.local.get('pessoaConfianca');
  $('btnAcess').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('btnVerificar').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('verificar.html') }));
  if (!P.valida(pessoaConfianca)) {
    $('pessoaInfo').textContent = 'Nenhuma pessoa cadastrada. Cadastre alguém para perguntar se um site é golpe.';
    return;
  }
  const nome = P.primeiroNome(pessoaConfianca.nome);
  $('pessoaInfo').textContent = 'Pessoa cadastrada: ' + pessoaConfianca.nome + '.';
  const aba = await abaAtual();
  let u = null;
  try { u = new URL(aba.url); } catch (e) { /* página especial */ }
  if (!u || !/^https?:$/.test(u.protocol)) return;
  $('btnPessoa').hidden = false;
  $('btnPessoa').textContent = '💬 Perguntar para ' + nome + ' se este site é golpe';
  $('btnPessoa').addEventListener('click', () => {
    const msg = P.mensagem(pessoaConfianca.nome, u.href);
    const link = P.linkWhats(pessoaConfianca, msg) || P.linkEmail(pessoaConfianca, msg);
    if (link) chrome.tabs.create({ url: link });
  });
}

async function iniciar() {
  const cfg = await lerConfig();
  document.body.classList.toggle('simples', !!cfg.modoSimples);
  document.body.classList.toggle('daltonico', !!cfg.daltonico);
  $('limite').value = String(cfg.limite);
  $('idade').checked = cfg.consultaIdade;
  $('rigor').value = cfg.rigor;
  $('rigor').addEventListener('change', () => salvar({ rigor: $('rigor').value }));
  $('btnGolpe').addEventListener('click', () => rotular('golpe'));
  $('btnSeguro').addEventListener('click', () => rotular('seguro'));
  $('btnBaixar').addEventListener('click', baixar);
  $('simples').checked = cfg.modoSimples;
  $('simples').addEventListener('change', () => { salvar({ modoSimples: $('simples').checked }); document.body.classList.toggle('simples', $('simples').checked); });
  $('imagens').checked = cfg.imagens;

  $('limite').addEventListener('change', () => salvar({ limite: Number($('limite').value) }));
  $('idade').addEventListener('change', () => salvar({ consultaIdade: $('idade').checked }));
  $('imagens').addEventListener('change', async () => {
    if ($('imagens').checked) {
      const ok = await chrome.permissions.request({ origins: ['https://*/*'] });
      $('imagens').checked = ok;
      await salvar({ imagens: ok });
    } else {
      await salvar({ imagens: false });
      await chrome.permissions.remove({ origins: ['https://*/*'] }).catch(() => {});
    }
  });
  $('atualizar').addEventListener('click', async () => {
    $('atualizar').disabled = true;
    $('atualizar').textContent = 'Atualizando…';
    await chrome.runtime.sendMessage({ tipo: 'atualizar-listas' });
    $('atualizar').disabled = false;
    $('atualizar').textContent = 'Atualizar listas de golpes agora';
    mostrarData();
  });
  $('demoAtencao').addEventListener('click', () => demo('atencao'));
  $('demoPerigo').addEventListener('click', () => demo('perigo'));
  $('demoPagamento').addEventListener('click', () => demo('pagamento'));
  $('demoBloqueio').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('bloqueado.html') + '?u=' + encodeURIComponent('https://nubank-atualizar-cadastro.xyz/login') });
  });
  mostrarData();
  mostrarStatus();
  prepararRA();
  prepararPessoa();
}

async function mostrarData() {
  const { atualizadoEm } = await chrome.storage.local.get('atualizadoEm');
  $('quando').textContent = atualizadoEm
    ? 'Listas atualizadas em ' + new Date(atualizadoEm).toLocaleString('pt-BR')
    : 'Listas ainda não baixadas.';
}

iniciar();
