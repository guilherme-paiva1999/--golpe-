'use strict';

const $ = (id) => document.getElementById(id);
const alvo = new URLSearchParams(location.search).get('u');
let url = null;
try {
  url = new URL(alvo);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') url = null;
} catch (e) { url = null; }

if (!url) {
  $('host').textContent = 'Endereço inválido';
  $('continuar').hidden = true;
} else {
  $('host').textContent = url.hostname;
  chrome.runtime.sendMessage({ tipo: 'detalhes', url: url.href }).then((res) => {
    const lista = $('motivos');
    for (const m of (res && res.motivos) || []) {
      const li = document.createElement('li');
      li.textContent = m;
      lista.appendChild(li);
    }
  }).catch(() => {});
}

$('voltar').addEventListener('click', async () => {
  if (history.length > 1) { history.back(); return; }
  try {
    const aba = await chrome.tabs.getCurrent();
    await chrome.tabs.remove(aba.id);
  } catch (e) { window.close(); }
});

$('ouvir').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return;
  const s = window.speechSynthesis;
  if (s.speaking) { s.cancel(); return; }
  const motivos = [...document.querySelectorAll('#motivos li')].map((li) => li.textContent).join(' ');
  const u = new SpeechSynthesisUtterance('Pare. ' + $('titulo').textContent + '. ' + motivos +
    ' Se chegou por mensagem, apague a mensagem e acesse o serviço digitando o endereço oficial.');
  u.lang = 'pt-BR';
  u.rate = 0.9;
  s.speak(u);
});
if (!('speechSynthesis' in window)) $('ouvir').hidden = true;
$('titulo').focus();                    // leitor de tela anuncia o bloqueio ao abrir

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
