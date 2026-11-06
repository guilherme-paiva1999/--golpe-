(() => {
  'use strict';
  if (window.__pgCarregado) return;
  window.__pgCarregado = true;

  // ---------- Estado e configuração ----------
  let ativo = true;
  let config = { limite: 3, imagens: false, modoSimples: false, vozAutomatica: false, daltonico: false };
  let pessoa = null;                       // pessoa de confiança (fica só neste computador)
  let siteRes = null;
  let avisoSite = null;
  let fecharAvisoAtual = null;
  let avisouPagamento = false;
  let rodadas = 0;

  try {
    chrome.storage.local.get(['config', 'pessoaConfianca']).then((d) => {
      if (d.config) Object.assign(config, d.config);
      pessoa = d.pessoaConfianca || null;
    }).catch(() => {});
    chrome.storage.onChanged.addListener((mud) => {
      if (mud.config && mud.config.newValue) Object.assign(config, mud.config.newValue);
      if (mud.pessoaConfianca) pessoa = mud.pessoaConfianca.newValue || null;
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
    /* Tela cheia sóbria (o mesmo visual da tela de bloqueio): vermelho-escuro, alinhado à esquerda */
    .tela{position:fixed;inset:0;overflow-y:auto;color:#fff;font:19px/1.6 Arial,Helvetica,sans-serif;text-align:left;
      --fundo:#7f1d1d;--escuro:rgba(0,0,0,.25);background:var(--fundo);padding:28px 20px 48px}
    .tela.atencao{--fundo:#7a4a00}
    .tela.daltonico{--fundo:#1e3a5f}
    .tela.grande{font-size:23px}
    .miolo{max-width:640px;margin:0 auto}
    .tela .cab{display:flex;gap:20px;align-items:center}
    .tela .ico{width:64px;height:64px;flex:none}
    .rotulo{font-size:.85em;font-weight:bold;letter-spacing:.12em}
    .h1{margin:0;font-size:1.7em;font-weight:bold;line-height:1.2}
    .tela .host{margin-top:20px;background:var(--escuro);border-radius:6px;padding:10px 14px;font:bold 1em Consolas,monospace;overflow-wrap:anywhere}
    .tela .conf{margin-top:24px}
    .conf-linha{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
    .num{font-size:1.6em;font-weight:bold}
    .conf-txt{opacity:.85;font-size:.9em}
    .barra{position:relative;height:8px;margin-top:8px;background:var(--escuro);border-radius:4px}
    .barra i{display:block;height:100%;background:#fff;border-radius:4px}
    .barra b{position:absolute;top:-4px;bottom:-4px;width:2px;background:#fff;opacity:.7}
    .tela .texto{margin:24px 0 0}
    .tela .lista{margin:24px 0 0;padding-left:24px}
    .tela .lista li{margin:2px 0}
    .acoes{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
    .tela button{margin:0;font:inherit;cursor:pointer;border-radius:8px}
    .tela button:focus-visible,.tela summary:focus-visible{outline:3px solid #fff;outline-offset:3px;box-shadow:none}
    .tela button.b{display:inline-flex;align-items:center;gap:10px;padding:12px 22px;font-weight:bold;border:2px solid #fff}
    .tela button.seguro{background:#fff;color:var(--fundo)}
    .tela button.pessoa{background:transparent;color:#fff}
    .tela button.pessoa svg{width:20px;height:20px;flex:none}
    .tela button.ra{background:#056734;color:#fff;border-color:#056734}
    .logo-ra{background:#fff;border-radius:4px;padding:3px 6px;display:inline-flex}
    .logo-ra img{height:15px;width:auto;display:block}
    .tela details{margin-top:28px}
    .tela summary{cursor:pointer;font-size:.9em;opacity:.9}
    .painel{margin-top:12px;font-size:.9em}
    .tela button.leve{background:none;color:#fff;border:1px solid #fff;padding:6px 12px;font-size:.95em;margin-top:12px}
    .tela button.link{display:block;margin-top:24px;background:none;border:0;color:#fff;font-size:.8em;opacity:.7;text-decoration:underline;padding:4px 0}
    @media (max-width:480px){.tela{font-size:17px}.tela .cab{gap:14px}.tela .ico{width:48px;height:48px}.h1{font-size:1.4em}.tela button.b{width:100%;justify-content:center;padding:12px 14px}.conf-txt{flex-basis:100%}}`;

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

  // Desenhos fixos do cartaz (texto estático da extensão, nunca vindo da página).
  const DESENHOS = {
    perigo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="ico" aria-hidden="true">' +
      '<path d="M11 2h10l9 9v10l-9 9H11l-9-9V11z" fill="#fff"/><path d="M11.5 11.5l9 9M20.5 11.5l-9 9" stroke="#b42323" stroke-width="3.4" stroke-linecap="round"/></svg>',
    atencao: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="ico" aria-hidden="true">' +
      '<path d="M16 2.5L30.5 28.5H1.5z" fill="#fff"/><path d="M16 11v8.5M16 23.5v.5" stroke="#7a4a00" stroke-width="3.4" stroke-linecap="round"/></svg>',
    balao: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" aria-hidden="true">' +
      '<path d="M30 5C15 5 4 15 4 28c0 7 3 13 9 17l-3 11 12-7c2.5.6 5 .9 8 .9 15 0 26-10 26-22S45 5 30 5z" fill="#fff"/></svg>'
  };
  function desenho(nome) {
    return document.importNode(new DOMParser().parseFromString(DESENHOS[nome], 'image/svg+xml').documentElement, true);
  }

  function barraConf(valor, limite) {
    const fill = el('i', {}); fill.style.width = Math.max(0, Math.min(100, valor)) + '%';
    const marca = el('b', {}); marca.style.left = 'calc(' + limite + '% - 2px)';
    return el('div', { class: 'barra', 'aria-hidden': 'true' }, fill, marca);
  }

  function mostrarAvisoSite(res) {
    if (avisoSite) return;
    const perigo = res.nivel === 'perigo';
    const nivel = perigo ? 'perigo' : 'atencao';
    const simples = !!config.modoSimples;
    const motivos = res.motivos.slice(0, simples ? 2 : 4);
    const titulo = res.comercio
      ? (perigo ? 'Esta loja tem cara de golpe' : 'Esta loja ainda não provou ser confiável')
      : (perigo ? 'Este site pode ser um golpe' : 'Este site é suspeito');
    // Porcentagem: só é confiável quem chega ao limite (90% ou mais no rigor padrão).
    const limiteConf = res.limite || (config.rigor === 'normal' ? 60 : 90);
    const confNum = res.confianca !== undefined ? res.confianca : (typeof res.pontos === 'number' ? Math.max(0, 100 - res.pontos) : null);
    const confTexto = res.confianca !== undefined
      ? 'Confiança: ' + res.confianca + '%. Para ser confiável, precisa ter ' + limiteConf + '% ou mais.'
      : (typeof res.pontos === 'number' ? 'Confiança: ' + Math.max(0, 100 - res.pontos) + '%. Para ser confiável, precisa ter ' + limiteConf + '% ou mais.' : '');

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
    const voltar = el('button', { type: 'button', class: 'b seguro', onclick: () => enviar({ tipo: 'voltar' }) }, 'Voltar para a segurança');
    const continuar = el('button', {
      type: 'button', class: 'link',
      onclick: () => {
        if (!confirmou) { confirmou = true; continuar.textContent = 'Tem certeza? Clique de novo para entrar'; return; }
        enviar({ tipo: 'parar-fala' });
        fechar();
      }
    }, 'Continuar mesmo assim (não recomendado)');

    const dominioRA = (res.dominio || location.hostname).replace(/^www\./, '');
    // Botão grande: uma fonte externa, além do nosso aviso. Verde da marca, com a logo numa etiqueta branca.
    const logo = el('img', { src: chrome.runtime.getURL('icons/reclameaqui.png'), alt: '' });
    const chip = el('span', { class: 'logo-ra', 'aria-hidden': 'true' }, logo);
    logo.addEventListener('error', () => chip.remove());          // se a página bloquear a imagem, fica só o texto
    const textoRA = el('span', {}, 'Verificar no Reclame Aqui');
    const ra = el('button', {
      type: 'button', class: 'b ra',
      onclick: () => {
        try { navigator.clipboard.writeText(dominioRA).catch(() => {}); } catch (e) { /* sem área de transferência */ }
        try { chrome.storage.local.set({ raPendente: { host: dominioRA, t: Date.now() } }); } catch (e) { /* extensão recarregada */ }
        window.open('https://www.reclameaqui.com.br/detector-site-confiavel/', '_blank', 'noopener');
        textoRA.textContent = 'Abrindo o Reclame Aqui com o endereço preenchido';
      }
    }, chip, textoRA);
    const acoes = el('div', { class: 'acoes' }, voltar);
    const P = self.EGolpePessoa;
    if (P && P.valida(pessoa)) {
      const msg = P.mensagem(pessoa.nome, location.href);
      const link = P.linkWhats(pessoa, msg) || P.linkEmail(pessoa, msg);
      acoes.append(el('button', {
        type: 'button', class: 'b pessoa',
        onclick: () => { if (link.startsWith('mailto:')) location.href = link; else window.open(link, '_blank', 'noopener'); }
      }, desenho('balao'), el('span', {}, 'Perguntar para ' + P.primeiroNome(pessoa.nome) + ' se é golpe')));
    }
    acoes.append(ra);
    const textoVoz = 'Pare. ' + titulo + '. ' + (confTexto ? confTexto + ' ' : '') + motivos.join(' ') + ' O que fazer: ' + PASSOS[nivel];
    const ouvir = botaoOuvir(textoVoz);
    if (ouvir) ouvir.className = 'leve';


    const tela = el('div', {
      class: 'tela ' + nivel + (simples ? ' grande' : '') + (config.daltonico ? ' daltonico' : ''), role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'pg-tit'
    },
      el('div', { class: 'miolo' },
        el('div', { class: 'cab' }, desenho(nivel),
          el('div', {}, el('div', { class: 'rotulo' }, perigo ? 'PERIGO' : 'ATENÇÃO'), el('div', { class: 'h1', id: 'pg-tit' }, titulo))),
        el('div', { class: 'host' }, location.hostname),
        ...(confNum === null ? [] : [el('div', { class: 'conf' },
          el('div', { class: 'conf-linha' }, el('span', { class: 'num' }, confNum + '%'), el('span', {}, 'de confiança'),
            el('span', { class: 'conf-txt' }, '· confiável só com ' + limiteConf + '% ou mais')),
          barraConf(confNum, limiteConf))]),
        el('p', { class: 'texto' }, PASSOS[nivel]),
        el('ul', { class: 'lista' }, ...motivos.map((m) => el('li', {}, m))),
        acoes,
        ...(ouvir ? [ouvir] : []),
        continuar));
    root.appendChild(tela);
    document.documentElement.appendChild(host);
    avisoSite = host;
    voltar.focus({ preventScroll: true });                       // Enter = ação segura; leitor de tela anuncia o alerta
    if (config.vozAutomatica) enviar({ tipo: 'falar', texto: textoVoz });
  }

  // ---------- 2) Página pedindo pagamento ----------
  // Sinais da página. O texto fica no computador; só vai ao fundo verdadeiro/falso de cada sinal.
  const PRESSAO = [
    /[úu]ltimas?\s+(unidades?|pe[cç]as?|horas?|vagas?)/i, /restam\s+(apenas\s+)?\d+/i, /s[óo]\s+hoje/i,
    /oferta\s+(termina|expira|acaba|por\s+tempo)/i, /por\s+tempo\s+limitado/i, /estoque\s+(limitado|acabando)/i,
    /aproveite\s+(agora|j[áa])/i, /garanta\s+(j[áa]|agora)/i, /agora\s+ou\s+nunca/i, /[úu]ltima\s+chance/i,
    /sua\s+conta\s+ser[áa]\s+(bloqueada|suspensa|cancelada)/i, /\d+\s+pessoas\s+(est[ãa]o|vendo|comprando)/i
  ];
  const PAGAMENTO = [
    /chave\s+pix/i, /pague\s+(agora|com\s+pix)/i, /finalizar\s+(a\s+)?compra/i, /boleto\s+banc[áa]rio/i,
    /n[úu]mero\s+do\s+cart[ãa]o/i, /c[óo]digo\s+de\s+seguran[çc]a|\bcvv\b/i, /pagamento\s+(via|por)\s+pix/i, /pix\s+copia\s+e\s+cola/i,
    /taxa\s+(de\s+)?(libera[cç][aã]o|desbloqueio)/i
  ];
  const CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
  const CONTATO = /fale\s+conosco|contato|atendimento|\bsac\b|quem\s+somos/i;

  function descontoExagerado(texto) {
    const re = /(\d{2,3})\s*%\s*(off|de\s+desconto|desconto)|desconto\s+de\s+(\d{2,3})\s*%/gi;
    let m;
    while ((m = re.exec(texto))) { if (Number(m[1] || m[3]) >= 70) return true; }
    return false;
  }

  const POLITICAS = [
    /pol[íi]tica\s+de\s+privacidade|privacidade/i, /termos\s+(de\s+)?(uso|servi[cç]o|compra)/i,
    /troca[s]?\s+e\s+devolu[cç][õo]es|pol[íi]tica\s+de\s+troca|devolu[cç][ãa]o/i,
    /prazo\s+de\s+entrega|pol[íi]tica\s+de\s+entrega|\bfrete\b/i
  ];
  const GATEWAYS = ['mercadopago.com', 'mercadopago.com.br', 'pagseguro.uol.com.br', 'pagbank.com.br', 'stripe.com',
    'paypal.com', 'pagar.me', 'cielo.com.br', 'stone.com.br', 'ebanx.com', 'hotmart.com', 'pix.bcb.gov.br'];
  const ENDERECO = /\b(rua|av\.?|avenida|alameda|rodovia|travessa)\s+[^,\n]{3,40},?\s*\d+/i;

  // Só título e cabeçalhos: um botão "Entrar com Google" num site legítimo não conta.
  const MARCAS_PAGINA = {
    microsoft: /\b(microsoft|outlook|office\s*365|onedrive|sharepoint)\b/i, google: /\b(google|gmail)\b/i,
    govbr: /\bgov\.?br\b|receita\s+federal|\bmeu\s+inss\b|\binss\b/i, nubank: /\bnubank\b/i, itau: /\bita[uú]\b/i,
    bradesco: /\bbradesco\b/i, caixa: /caixa\s+econ[oô]mica|\bcaixa\s+tem\b/i, santander: /\bsantander\b/i,
    bb: /banco\s+do\s+brasil/i, correios: /\bcorreios\b/i, mercadolivre: /mercado\s*livre/i, paypal: /\bpaypal\b/i,
    apple: /\bapple\s*id\b|\bicloud\b/i, netflix: /\bnetflix\b/i, instagram: /\binstagram\b/i,
    facebook: /\bfacebook\b/i, whatsapp: /\bwhatsapp\b/i
  };
  function marcasDaPagina() {
    const cab = [document.title, ...[...document.querySelectorAll('h1, h2')].slice(0, 6).map((e) => e.textContent)].join(' \n ');
    return Object.keys(MARCAS_PAGINA).filter((k) => MARCAS_PAGINA[k].test(cab));
  }

  function cnpjOk(d) {
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const calc = (n) => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += Number(d[i]) * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }
  function hostEm(host, lista) { return lista.some((g) => host === g || host.endsWith('.' + g)); }

  const TEXTO_COMPRA = /^(comprar(\s+agora)?|compre(\s+j[áa]|\s+agora)?|adicionar(\s+(ao|à|a)\s+(carrinho|sacola|cesta))?|add\s+to\s+(cart|bag)|buy\s+now|finalizar\s+(a\s+)?compra|ir\s+para\s+o\s+carrinho|ver\s+carrinho)\b/i;
  // v3.10: página que promete espionar ou clonar a conta de OUTRA pessoa ("Clonar perfil agora", "de qualquer pessoa",
  // "sem notificar"). Precisa do botão de ação E da promessa no texto: uma notícia que só fala desse golpe não conta.
  const BOTAO_ESPIAO = /\b(clonar|clone|espionar|espiar|espione|investigar|rastrear|hackear|invadir|monitorar)\b/i;
  const PROMESSA_ESPIAO = /(de\s+qualquer\s+pessoa|sem\s+(notificar|que\s+(ela|ele|a\s+pessoa)\s+saiba|ser\s+notificad)|100%\s+an[ôo]nimo|conversas?\s+(apagadas|de\s+outra\s+pessoa)|mensagens\s+(de\s+qualquer|apagadas|privadas\s+de))/i;
  function paginaEspiao(texto) {
    if (!PROMESSA_ESPIAO.test(texto)) return false;
    const els = document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]');
    for (let i = 0; i < els.length && i < 2000; i++) {
      const t = (els[i].innerText || els[i].value || els[i].getAttribute('aria-label') || '').trim().slice(0, 60);
      if (t && BOTAO_ESPIAO.test(t)) return true;
    }
    return false;
  }

  function botaoDeCompra() {
    const els = document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]');
    for (let i = 0; i < els.length && i < 4000; i++) {
      const e = els[i];
      const t = (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 60);
      if (t && TEXTO_COMPRA.test(t)) return true;
    }
    return !!document.querySelector('a[href*="carrinho" i], a[href*="sacola" i], a[href*="/cart" i], a[href*="/bag" i], a[href*="checkout" i], [class*="minicart" i], [id*="minicart" i]');
  }

  function lerSinais() {
    const texto = (document.body ? document.body.innerText : '').slice(0, 100000);
    const campoCartao = !!document.querySelector('input[autocomplete^="cc-"], input[name*="card" i], input[name*="cartao" i], input[name*="cvv" i], input[id*="cvv" i]');
    const senha = !!document.querySelector('input[type="password"]');
    const pagamento = campoCartao || PAGAMENTO.some((p) => p.test(texto));
    const preco = (texto.match(/R\$\s?\d/g) || []).length;
    // v3.8: loja de verdade tem BOTÃO de compra ou link de carrinho. "R$" e "comprar" soltos no texto aparecem em notícias
    // (cotações, "vendido por R$ 22 milhões") e faziam sites de notícias parecerem lojas.
    const compraUI = botaoDeCompra();
    const venda = preco >= 1 && compraUI;
    const contador = !!document.querySelector('[class*="countdown" i], [id*="countdown" i], [class*="timer" i], [id*="timer" i]');
    const pressao = contador || PRESSAO.some((p) => p.test(texto));
    let formExterno = false, gateway = false;
    document.querySelectorAll('form[action], iframe[src]').forEach((f) => {
      try {
        const url = new URL(f.getAttribute('action') || f.getAttribute('src'), location.href);
        if (!/^https?:$/.test(url.protocol) || url.hostname === location.hostname) return;
        if (hostEm(url.hostname, GATEWAYS)) { gateway = true; return; }
        if (f.tagName === 'FORM' && f.querySelector('input[type="password"], input[autocomplete^="cc-"], input[name*="card" i], input[name*="cpf" i], input[name*="senha" i]')) formExterno = true;
      } catch (e) { /* endereço inválido */ }
    });
    let cnpjValido = false, cnpjInvalido = false, cnpj = '';
    for (const m of texto.matchAll(new RegExp(CNPJ.source, 'g'))) {
      const d = m[0].replace(/\D/g, '');
      if (cnpjOk(d)) { cnpjValido = true; if (!cnpj) cnpj = d; } else cnpjInvalido = true;
    }
    if (cnpjValido) cnpjInvalido = false;
    const raiz = location.hostname.replace(/^www\./, '');
    const emails = [...texto.matchAll(/[\w.+-]+@([\w.-]+\.[a-z]{2,})/gi)].map((m) => m[1].toLowerCase());
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => { const m = a.getAttribute('href').match(/@([\w.-]+)/); if (m) emails.push(m[1].toLowerCase()); });
    const emailMesmoDominio = emails.some((d) => d === raiz || d.endsWith('.' + raiz) || raiz.endsWith('.' + d));
    const contato = CONTATO.test(texto) || ENDERECO.test(texto) || emails.length > 0 || !!document.querySelector('a[href^="tel:"]');
    const politicas = POLITICAS.filter((p) => p.test(texto)).length >= 2;
    // Página voltada ao Brasil: preços em R$ ou página em português (usado para saber se a loja é estrangeira).
    const brasil = preco >= 1 || /^pt/i.test(document.documentElement.lang || '');
    return { pagamento, pressao, desconto: descontoExagerado(texto), formExterno, senha, venda, brasil, espionagem: paginaEspiao(texto),
      semContato: pagamento && !(CNPJ.test(texto) || contato), cnpjValido, cnpjInvalido, contato, emailMesmoDominio, politicas, gateway,
      marcas: (senha || pagamento) ? marcasDaPagina() : [], cnpj };
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

  function paginaDeDinheiro(s) {
    // Pressão e desconto sozinhos não bastam (notícias falam em "últimas horas" e "50% de desconto"):
    // contam só junto com venda ou pagamento, que já entram por conta própria.
    return !!(s.pagamento || s.venda || s.formExterno || s.espionagem || (s.senha && s.marcas && s.marcas.length));
  }

  let ultimoEnvio = '';
  async function checarPagina() {
    if (!ativo || rodadas++ >= 6 || !document.body) return;
    if (siteRes && siteRes.conhecido) return;               // site provado: não incomoda
    const sinais = lerSinais();
    const chave = JSON.stringify(sinais);
    // v3.6: a extensão só age em páginas de compra, pagamento, Pix ou promoção. Senha sozinha não conta
    // (todo site tem login); conta quando a página diz ser um banco, o gov.br ou outra marca (golpe de login falso).
    const gatilho = paginaDeDinheiro(sinais);
    if (!gatilho || chave === ultimoEnvio) return;
    ultimoEnvio = chave;
    const res = await enviar({ tipo: 'avaliar-pagina', host: location.hostname, protocolo: location.protocol, url: location.href, sinais });
    if (res) { siteRes = res; if (res.nivel !== 'ok') mostrarAvisoSite(res); }
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

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.tipo === 'sinais') { sendResponse({ sinais: lerSinais(), nota: siteRes ? siteRes.pontos : 0 }); }
  });

  // ---------- Início ----------
  obsMut.observe(document.documentElement, { childList: true, subtree: true });
  registrar(document.documentElement);

  // Espera a configuração carregar para o aviso já sair no tamanho certo.
  const configPronta = chrome.storage.local.get(['config', 'pessoaConfianca']).then((d) => {
    if (d.config) Object.assign(config, d.config);
    pessoa = d.pessoaConfianca || null;
  }).catch(() => {});
  configPronta.then(() => enviar({ tipo: 'checar-site', host: location.hostname, protocolo: location.protocol, url: location.href }))
    .then((res) => {
      siteRes = res;
      // Endereço suspeito: o aviso só aparece se a página pedir dinheiro (compra, pagamento, Pix, promoção).
      // Em sites de leitura e vídeo, a extensão fica quieta. Golpe confirmado já foi bloqueado antes de abrir.
      if (res && res.nivel !== 'ok' && document.body && paginaDeDinheiro(lerSinais())) mostrarAvisoSite(res);
      checarPagina();
    });
})();
