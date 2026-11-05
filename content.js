(() => {
  'use strict';
  if (window.__pgCarregado) return;
  window.__pgCarregado = true;

  // ---------- Estado e configuração ----------
  let ativo = true;
  let config = { limite: 3, imagens: false, modoSimples: false };
  let siteRes = null;
  let avisoSite = null;
  let fecharAvisoAtual = null;
  let avisouPagamento = false;
  let rodadas = 0;

  try {
    chrome.storage.local.get('config').then((d) => { if (d.config) Object.assign(config, d.config); }).catch(() => {});
    chrome.storage.onChanged.addListener((mud) => {
      if (mud.config && mud.config.newValue) Object.assign(config, mud.config.newValue);
    });
  } catch (e) { /* contexto inválido */ }

  // ---------- Utilidades ----------
  function el(tag, attrs, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const f of filhos) e.append(f);
    return e;
  }

  // Avisos: cor + ícone + palavra (nunca só cor), contraste alto, foco visível.
  const CSS = `
    :host{all:initial}
    *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
    .faixa{font-size:18px;line-height:1.5;padding:16px 20px;box-shadow:0 2px 12px rgba(0,0,0,.35)}
    .faixa:focus-visible{outline:4px solid #fff;outline-offset:-8px}
    .atencao{background:#f9a825;color:#000}
    .perigo{background:#c62828;color:#fff}
    .cab{display:flex;gap:14px;align-items:center}
    .ico{width:48px;height:48px;flex:none}
    .ico.mini{width:30px;height:30px}
    .palavra{font-weight:bold;font-size:15px;letter-spacing:.14em}
    .titulo{font-weight:bold;font-size:24px;line-height:1.2}
    .sub{font-weight:bold;margin-top:12px}
    ul{margin:4px 0 0;padding-left:24px}
    .passo{margin-top:12px;padding:8px 12px;border:2px solid currentColor;border-radius:6px}
    .grande{font-size:24px}
    .grande .titulo{font-size:32px}
    .grande .palavra{font-size:18px}
    .grande .ico{width:64px;height:64px}
    .grande button{font-size:22px;padding:12px 18px}
    button{font-size:18px;padding:8px 14px;margin:12px 10px 0 0;cursor:pointer;border-radius:6px;border:2px solid #000;background:#fff;color:#000}
    button:focus-visible{outline:4px solid #1565c0;outline-offset:2px;box-shadow:0 0 0 7px #fff}
    .aviso{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#c62828;color:#fff;font-size:18px;line-height:1.4;padding:12px 16px;margin:4px 0;border-radius:6px}
    .aviso button{margin:0;font-size:16px;padding:6px 12px}
    .tela{position:fixed;inset:0;background:#b71c1c;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;overflow-y:auto;overflow-x:hidden;text-align:center}
    .tela>:first-child{margin-top:auto}
    .tela>:last-child{margin-bottom:auto}
    .tri{width:clamp(110px,22vh,190px);height:auto;flex:none}
    .pare{font-size:clamp(44px,min(13vh,19vw),110px);font-weight:900;letter-spacing:.14em;line-height:1;padding-left:.14em}
    .tit{font-size:clamp(22px,3.6vh,34px);font-weight:bold;line-height:1.2;max-width:760px}
    .caixa{max-width:720px;width:100%;text-align:left;background:rgba(0,0,0,.28);border-radius:10px;padding:14px 18px;font-size:19px;line-height:1.5}
    .caixa ul{margin:6px 0 0;padding-left:22px}
    .tela .passo{max-width:720px;width:100%;text-align:left;font-size:19px;margin-top:0;border-color:#fff}
    .botoes{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:6px}
    .tela button{margin:0;font-size:20px;padding:12px 22px;border:3px solid #fff;background:transparent;color:#fff}
    .tela button.seguro{background:#fff;color:#b71c1c;font-weight:bold;font-size:22px;padding:14px 28px}
    .tela button.pequeno{font-size:16px;padding:8px 14px;border-width:2px}
    .tela button:focus-visible{outline:4px solid #ffeb3b;outline-offset:3px;box-shadow:none}
    .tela.grande{font-size:24px}
    .tela.grande .caixa,.tela.grande .passo{font-size:24px}
    .tela.grande .tit{font-size:clamp(26px,4.4vh,40px)}
    .tela.grande button{font-size:24px}`;

  // Avisos ficam em Shadow DOM fechado: o CSS e o JS do site não os alcançam.
  function criarCaixa(estilo) {
    const host = document.createElement('div');
    host.setAttribute('data-pg', '');
    for (const [k, v] of Object.entries(estilo)) host.style.setProperty(k, v, 'important');
    const root = host.attachShadow({ mode: 'closed' });
    root.appendChild(el('style', {}, CSS));
    return { host, root };
  }

  // Perigo = octógono com X (parar). Atenção = triângulo com ! (cuidado).
  const SVG = 'http://www.w3.org/2000/svg';
  function icone(tipo, mini) {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 32 32');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ico' + (mini ? ' mini' : ''));
    const forma = document.createElementNS(SVG, 'path');
    const sinal = document.createElementNS(SVG, 'path');
    if (tipo === 'perigo') {
      forma.setAttribute('d', 'M11 2h10l9 9v10l-9 9H11l-9-9V11z');
      forma.setAttribute('fill', '#fff');
      sinal.setAttribute('d', 'M11.500 11.500l9 9M20.500 11.500l-9 9');
      sinal.setAttribute('stroke', '#c62828');
    } else {
      forma.setAttribute('d', 'M16 2.500L30.500 28.500H1.500z');
      forma.setAttribute('fill', '#000');
      sinal.setAttribute('d', 'M16 11v8.500M16 23.500v.5');
      sinal.setAttribute('stroke', '#f9a825');
    }
    sinal.setAttribute('fill', 'none');
    sinal.setAttribute('stroke-width', '3');
    sinal.setAttribute('stroke-linecap', 'round');
    s.append(forma, sinal);
    return s;
  }

  // Leitura em voz alta (quem não lê bem, ou prefere ouvir). Clicar de novo para parar.
  function botaoOuvir(texto) {
    if (!('speechSynthesis' in window)) return null;
    return el('button', {
      type: 'button',
      onclick: () => {
        try {
          const s = window.speechSynthesis;
          if (s.speaking) { s.cancel(); return; }
          const u = new SpeechSynthesisUtterance(texto);
          u.lang = 'pt-BR';
          u.rate = 0.9;
          s.speak(u);
        } catch (e) { /* sem voz disponível */ }
      }
    }, 'Ouvir o aviso');
  }

  async function enviar(msg) {
    if (!ativo) return null;
    if (!chrome.runtime || !chrome.runtime.id) { desligar(); return null; }
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (String(e && e.message).includes('context invalidated')) desligar();
      return null;
    }
  }

  // ---------- 1) Aviso sobre o site: tela cheia vermelha com PARE ----------
  const PASSOS = {
    perigo: 'Feche esta página. Não digite senha, CPF nem dados do cartão. Se chegou por mensagem, apague a mensagem.',
    atencao: 'Antes de pagar, abra o site oficial digitando o endereço você mesmo e confira o CNPJ da loja.'
  };

  function triangulo() {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 32 30');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'tri');
    const forma = document.createElementNS(SVG, 'path');
    forma.setAttribute('d', 'M16 2.500L30 27.500H2z');
    forma.setAttribute('fill', '#fff');
    forma.setAttribute('stroke', '#fff');
    forma.setAttribute('stroke-width', '2');
    forma.setAttribute('stroke-linejoin', 'round');
    const sinal = document.createElementNS(SVG, 'path');
    sinal.setAttribute('d', 'M16 11v8M16 22.800v.4');
    sinal.setAttribute('stroke', '#b71c1c');
    sinal.setAttribute('stroke-width', '3');
    sinal.setAttribute('stroke-linecap', 'round');
    sinal.setAttribute('fill', 'none');
    s.append(forma, sinal);
    return s;
  }

  function mostrarAvisoSite(res) {
    if (avisoSite) return;
    const perigo = res.nivel === 'perigo';
    const nivel = perigo ? 'perigo' : 'atencao';
    const simples = !!config.modoSimples;
    const motivos = res.motivos.slice(0, simples ? 2 : 4);
    const titulo = perigo ? 'Este site pode ser um golpe' : 'Este site é suspeito';

    const { host, root } = criarCaixa({
      position: 'fixed', inset: '0', 'z-index': '2147483647', display: 'block'
    });

    // Trava a página por trás: sem rolar, sem digitar, sem clicar.
    const html = document.documentElement;
    const overflowAntes = html.style.getPropertyValue('overflow');
    html.style.setProperty('overflow', 'hidden', 'important');
    if (document.body) document.body.inert = true;
    const fechar = () => {
      host.remove();
      if (overflowAntes) html.style.setProperty('overflow', overflowAntes); else html.style.removeProperty('overflow');
      if (document.body) document.body.inert = false;
      fecharAvisoAtual = null;
    };
    fecharAvisoAtual = fechar;

    let confirmou = false;
    const voltar = el('button', { type: 'button', class: 'seguro', onclick: () => enviar({ tipo: 'voltar' }) }, 'Voltar para a segurança');
    const continuar = el('button', {
      type: 'button', class: 'pequeno',
      onclick: () => {
        if (!confirmou) { confirmou = true; continuar.textContent = 'Tem certeza? Clique de novo para entrar'; return; }
        fechar();
      }
    }, 'Continuar mesmo assim (não recomendado)');

    const botoes = el('div', { class: 'botoes' }, voltar);
    const ouvir = botaoOuvir('Pare. ' + titulo + '. ' + motivos.join(' ') + ' O que fazer: ' + PASSOS[nivel]);
    if (ouvir) botoes.append(ouvir);
    botoes.append(continuar);

    const tela = el('div', {
      class: 'tela' + (simples ? ' grande' : ''), role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'pg-tit'
    },
      triangulo(),
      el('div', { class: 'pare', 'aria-hidden': 'true' }, 'PARE'),
      el('div', { class: 'tit', id: 'pg-tit' }, titulo),
      el('div', { class: 'caixa' }, el('b', {}, 'O que encontramos:'), el('ul', {}, ...motivos.map((m) => el('li', {}, m)))),
      el('div', { class: 'passo' }, el('b', {}, 'O que fazer: '), PASSOS[nivel]),
      botoes);
    root.appendChild(tela);
    document.documentElement.appendChild(host);
    avisoSite = host;
    voltar.focus({ preventScroll: true });                       // Enter = ação segura; leitor de tela anuncia o alerta
  }

  // ---------- 2) Página pedindo pagamento ----------
  // Sinais fortes quase só aparecem em golpes; fracos aparecem em qualquer loja.
  const FORTES = [
    /taxa\s+(de\s+)?(libera[cç][aã]o|desbloqueio)/i, /lucro\s+(garantido|certo|di[aá]rio)/i,
    /investimento\s+garantido/i, /dobre\s+seu\s+dinheiro/i, /(fa[cç]a|mande|envie)\s+(um\s+)?pix\s+(para|de)\b/i
  ];
  const FRACOS = [/\bpix\b/i, /boleto/i, /transfer[eê]ncia/i, /whatsapp/i];

  function temCampoSensivel() {
    return !!document.querySelector('input[type="password"], input[autocomplete^="cc-"]');
  }

  function mostrarAvisoPagamento() {
    const simples = !!config.modoSimples;
    const { host, root } = criarCaixa({
      position: 'fixed', bottom: '0', left: '0', right: '0', 'z-index': '2147483647', display: 'block'
    });
    const passo = 'Antes de pagar, ligue para um familiar de confiança.';
    const faixa = el('div', { class: 'faixa atencao' + (simples ? ' grande' : ''), role: 'status', 'aria-live': 'polite' },
      el('div', { class: 'cab' }, icone('atencao'),
        el('div', {}, el('div', { class: 'palavra' }, 'ATENÇÃO'),
          el('div', { class: 'titulo' }, 'Pare e pense: esta página pede dinheiro'))),
      el('div', { class: 'passo' }, el('b', {}, 'O que fazer: '), passo));
    const ouvir = botaoOuvir('Atenção. Pare e pense: esta página pede dinheiro. ' + passo);
    if (ouvir) faixa.append(ouvir);
    faixa.append(el('button', { type: 'button', onclick: () => host.remove() }, 'Entendi, fechar'));
    root.appendChild(faixa);
    document.documentElement.appendChild(host);
  }

  function checarPagina() {
    if (!ativo || rodadas++ >= 6) return;
    const conhecido = !!(siteRes && siteRes.conhecido);

    if (location.protocol === 'http:' && !avisoSite && temCampoSensivel()) {
      mostrarAvisoSite({ nivel: 'atencao', dominio: location.hostname,
        motivos: ['Esta página pede senha ou dados de cartão sem conexão segura (sem cadeado).'] });
    }
    if (avisouPagamento || conhecido || !document.body) return;

    const texto = (document.body.innerText || '').slice(0, 100000);
    const fortes = FORTES.filter((p) => p.test(texto)).length;
    const fracos = FRACOS.filter((p) => p.test(texto)).length;
    const risco = siteRes && siteRes.nivel !== 'ok';
    const pontos = fortes * 2 + fracos;
    if (pontos >= (risco ? 3 : 4) && (fortes >= 1 || risco)) {
      avisouPagamento = true;            // fechou, não volta mais
      mostrarAvisoPagamento();
    }
  }

  // ---------- 3) Posts, imagens e vídeos ----------
  const ROTULOS_IA = /(feito com ia|criado com ia|gerado por ia|informa[cç][õo]es? (de|sobre) ia|ai info|made with ai|ai[- ]generated|conte[úu]do sint[ée]tico|alterado ou sint[ée]tico|altered or synthetic)/i;
  const SINAIS_GOLPE = [
    /investimento\s+garantido/i, /lucro\s+(garantido|certo|di[aá]rio)/i,
    /(fa[cç]a|mande|envie)\s+(um\s+)?pix/i, /dobre\s+seu\s+dinheiro/i,
    /taxa\s+(de\s+)?(libera[cç][aã]o|desbloqueio)/i,
    /voc[eê]\s+(foi\s+)?(ganhou|sorteado)/i,
    /(governo|banco|bndes)[^.\n]{0,60}(libera|indeniza|restitui)/i
  ];
  const ENCURTADORES = ['bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'rb.gy', 't.co'];
  const PATROCINADO = /^(patrocinado|sponsored|publicidade|an[uú]ncio)$/i;
  const CONTAINERS = 'article, [role="article"], ytd-rich-item-renderer, ytd-video-renderer';

  function rotuloCurto(container, regex) {
    const itens = container.querySelectorAll('span, a, div[role="button"], [aria-label]');
    const max = Math.min(itens.length, 400);
    for (let i = 0; i < max; i++) {
      const t = (itens[i].getAttribute('aria-label') || itens[i].textContent || '').trim();
      if (t.length > 0 && t.length < 60 && regex.test(t)) return true;
    }
    return false;
  }

  function temLinkEncurtado(container) {
    const links = container.querySelectorAll('a[href]');
    const max = Math.min(links.length, 60);
    for (let i = 0; i < max; i++) {
      try {
        if (ENCURTADORES.includes(new URL(links[i].href).hostname)) return true;
      } catch (e) { /* href inválido */ }
    }
    return false;
  }

  function calcularRisco(container) {
    let pontos = 0;
    if (rotuloCurto(container, ROTULOS_IA)) pontos += 3;
    if (rotuloCurto(container, PATROCINADO)) pontos += 1;
    if (temLinkEncurtado(container)) pontos += 1;
    const texto = (container.textContent || '').slice(0, 6000);   // textContent não força layout
    pontos += SINAIS_GOLPE.filter((p) => p.test(texto)).length;
    return pontos;
  }

  function proteger(container, motivo) {
    if (container.dataset.pgProtegido) return;
    container.dataset.pgProtegido = '1';
    const midias = container.querySelectorAll('img, video');
    midias.forEach((m) => {
      m.style.setProperty('filter', 'blur(14px)', 'important');
      m.style.setProperty('outline', '4px solid #c62828', 'important');
      if (m.tagName === 'VIDEO') { m.pause(); m.autoplay = false; m.muted = true; }
    });
    const { host, root } = criarCaixa({ display: 'block' });
    const aviso = el('div', { class: 'aviso', role: 'alert' },
      icone('perigo', true),
      el('span', {}, el('b', {}, 'CUIDADO: '), motivo + ' Não envie dinheiro nem dados por causa disso.'),
      el('button', {
        type: 'button',
        onclick: () => {
          midias.forEach((m) => { m.style.removeProperty('filter'); m.style.removeProperty('outline'); });
          host.remove();
        }
      }, 'Ver mesmo assim'));
    root.appendChild(aviso);
    try { container.prepend(host); } catch (e) { /* o site pode bloquear a inserção */ }
  }

  const urlsVistas = new Set();
  function checarImagens(container) {
    if (!config.imagens) return;
    container.querySelectorAll('img').forEach((img) => {
      const checar = async () => {
        if (img.naturalWidth < 200 || img.naturalHeight < 200) return;
        const url = img.currentSrc || img.src;
        if (!url || !url.startsWith('https:') || urlsVistas.has(url)) return;
        urlsVistas.add(url);
        const r = await enviar({ tipo: 'metadados-imagem', url });
        if (r && r.ia) proteger(container, 'esta imagem tem marca de ter sido feita por inteligência artificial.');
      };
      if (img.complete) checar(); else img.addEventListener('load', checar, { once: true });
    });
  }

  function avaliar(container) {
    if (!ativo || container.dataset.pgProtegido) return;
    if (calcularRisco(container) >= config.limite) {
      proteger(container, 'este conteúdo tem vários sinais de golpe ou foi marcado como feito por IA.');
    } else {
      checarImagens(container);
    }
  }

  // Só avalia o que aparece na tela, uma vez por post.
  const obsInt = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      obsInt.unobserve(e.target);
      const f = () => avaliar(e.target);
      if ('requestIdleCallback' in window) requestIdleCallback(f, { timeout: 2000 }); else setTimeout(f, 200);
    }
  }, { rootMargin: '200px' });

  function observar(c) {
    if (c.dataset.pgVisto) return;
    c.dataset.pgVisto = '1';
    obsInt.observe(c);
  }
  function registrar(no) {
    if (no.nodeType !== 1) return;
    if (no.matches && no.matches(CONTAINERS)) observar(no);
    if (no.querySelectorAll) no.querySelectorAll(CONTAINERS).forEach(observar);
  }

  // Olha só os nós novos, em lote.
  const pendentes = new Set();
  let timer = null;
  const obsMut = new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) pendentes.add(n); });
    if (pendentes.size > 1500) { pendentes.clear(); pendentes.add(document.documentElement); }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const lote = [...pendentes];
      pendentes.clear();
      lote.forEach(registrar);
      checarPagina();
    }, 700);
  });

  function desligar() {
    ativo = false;
    try { obsMut.disconnect(); obsInt.disconnect(); } catch (e) { /* já desligado */ }
  }

  // ---------- Modo de teste (botões do popup) ----------
  const MOTIVOS_DEMO = {
    perigo: ['Aviso de teste: este site não foi analisado de verdade.',
      'O endereço parece imitar "nubank", mas o site oficial é nubank.com.br.',
      'A terminação .xyz é muito usada em golpes.', 'Este site foi criado há apenas 3 dias.'],
    atencao: ['Aviso de teste: este site não foi analisado de verdade.',
      'O site não usa conexão segura (sem cadeado).', 'O endereço tem palavras de pressão ou de acesso a conta.']
  };
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.tipo !== 'demo') return;
    if (msg.nivel === 'pagamento') {
      mostrarAvisoPagamento();
    } else if (MOTIVOS_DEMO[msg.nivel]) {
      if (fecharAvisoAtual) fecharAvisoAtual();
      avisoSite = null;
      mostrarAvisoSite({ nivel: msg.nivel, dominio: location.hostname, motivos: MOTIVOS_DEMO[msg.nivel] });
    }
    sendResponse({ ok: true });
  });

  // ---------- Início ----------
  obsMut.observe(document.documentElement, { childList: true, subtree: true });
  registrar(document.documentElement);

  // Espera a configuração carregar para o aviso já sair no tamanho certo.
  const configPronta = chrome.storage.local.get('config').then((d) => { if (d.config) Object.assign(config, d.config); }).catch(() => {});
  configPronta.then(() => enviar({ tipo: 'checar-site', host: location.hostname, protocolo: location.protocol, url: location.href }))
    .then((res) => {
      siteRes = res;
      if (res && res.nivel !== 'ok') mostrarAvisoSite(res);
      checarPagina();
    });
})();
