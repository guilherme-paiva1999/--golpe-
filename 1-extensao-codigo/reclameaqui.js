'use strict';
/* Reclame Aqui: preenche o Detector de Site Confiável com o site que a pessoa pediu para verificar.
   Só roda na página do Detector e só depois de a pessoa clicar em "Verificar no Reclame Aqui" no É Golpe?
   (o botão guarda o endereço em "raPendente" por 2 minutos). Não envia o formulário nem lê o resultado:
   a consulta continua sendo da pessoa, que clica no botão do próprio Reclame Aqui.
   O endereço também segue copiado na área de transferência, caso o campo não seja encontrado. */
(async () => {
  let pendente;
  try { ({ raPendente: pendente } = await chrome.storage.local.get('raPendente')); } catch (e) { return; }
  if (!pendente || typeof pendente.host !== 'string' || Date.now() - pendente.t > 120000) return;
  const host = pendente.host.toLowerCase();
  if (!/^[a-z0-9.-]{1,253}$/.test(host)) return;

  const visivel = (i) => i.offsetParent !== null && !i.disabled && !i.readOnly;
  const texto = (i) => [i.placeholder, i.name, i.id, i.getAttribute('aria-label'), i.closest('label') && i.closest('label').textContent]
    .filter(Boolean).join(' ');
  const achar = () => {
    const campos = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit])')].filter(visivel);
    return campos.find((i) => i.type === 'url') ||
      campos.find((i) => /site|url|endere[cç]o|link|dom[ií]nio|www/i.test(texto(i)) && !/empresa|buscar empresa/i.test(texto(i))) || null;
  };

  // A página do Reclame Aqui monta o formulário depois de carregar: espera até 15 segundos.
  let campo = null;
  for (let n = 0; n < 60 && !campo; n++) {
    campo = achar();
    if (!campo) await new Promise((r) => setTimeout(r, 250));
  }
  if (!campo) return;
  await chrome.storage.local.remove('raPendente');

  // Escreve como se a pessoa tivesse digitado (a página usa React e só "vê" o valor com esses eventos).
  const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  definir.call(campo, host);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  campo.focus();
  campo.scrollIntoView({ block: 'center' });

  // Aviso pequeno, para a pessoa saber de onde veio o texto.
  const caixa = document.createElement('div');
  const sombra = caixa.attachShadow({ mode: 'closed' });
  const p = document.createElement('p');
  p.setAttribute('role', 'status');
  p.textContent = 'O É Golpe? preencheu o endereço ' + host + '. Confira e clique no botão de verificar do Reclame Aqui.';
  const estilo = document.createElement('style');
  estilo.textContent = 'p{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;margin:0 auto;max-width:560px;' +
    'background:#12284a;color:#fff;font:600 17px/1.4 Arial,sans-serif;padding:14px 18px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.3)}';
  sombra.append(estilo, p);
  document.documentElement.appendChild(caixa);
  setTimeout(() => caixa.remove(), 12000);
})();
