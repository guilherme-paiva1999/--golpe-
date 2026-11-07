'use strict';
/* =====================================================================
   Aprendizado de máquina: classificador da PÁGINA (ml/modelo-pagina.json).
   Regressão logística que lê o texto da página (pedaços de 3 a 5 letras, TF-IDF)
   e 39 características (preços, Pix, formulários, políticas, CNPJ, endereço...).
   Treinada em 1.234 páginas reais (8-treino-ml/). No teste por domínio (o modelo
   nunca viu o site): AUC 0,92; com 2% de falsos alertas pega cerca de metade dos golpes.
   Por isso ele SOMA pontos e nunca decide sozinho.
   O cálculo abaixo reproduz o scikit-learn (TfidfVectorizer char_wb + StandardScaler).
   Teste de paridade: node ml/testar_modelo_pagina.js
   ===================================================================== */

let MP = null;          // modelo carregado
function carregarModeloPagina(j) {
  const indice = new Map();
  j.vocab.forEach((g, i) => indice.set(g, i));
  MP = { ...j, indice };
}
function modeloPaginaPronto() { return MP !== null; }
function modeloPaginaLimiares() { return MP ? { limiar1: MP.limiar1, limiar2: MP.limiar2 } : {}; }

// Mesmo critério de espaço do Python (str.split): não dá para usar \s do JavaScript, que é um pouco diferente.
const MP_ESPACO = /[\t\n\v\f\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/;

// Pedaços de letras dentro de cada palavra, com espaço nas pontas (analyzer='char_wb' do scikit-learn).
function mpPedacos(texto, min, max) {
  const out = [];
  for (const palavra of texto.toLowerCase().split(MP_ESPACO)) {
    if (!palavra) continue;
    const w = Array.from(' ' + palavra + ' ');      // por caractere (não por unidade UTF-16), como o Python
    for (let n = min; n <= max; n++) {
      let o = 0;
      out.push(w.slice(o, o + n).join(''));
      while (o + n < w.length) { o++; out.push(w.slice(o, o + n).join('')); }
      if (o === 0) break;                          // palavra curta conta uma vez só
    }
  }
  return out;
}

// ---------- Características (as mesmas de 8-treino-ml/caracteristicas.js) ----------
const MP_PAGAMENTO = [/chave\s+pix/i, /pague\s+(agora|com\s+pix)/i, /finalizar\s+(a\s+)?compra/i, /boleto\s+banc[áa]rio/i,
  /n[úu]mero\s+do\s+cart[ãa]o/i, /c[óo]digo\s+de\s+seguran[çc]a|\bcvv\b/i, /pagamento\s+(via|por)\s+pix/i, /pix\s+copia\s+e\s+cola/i,
  /taxa\s+(de\s+)?(libera[cç][aã]o|desbloqueio)/i];
const MP_PRESSAO = [/[úu]ltimas?\s+(unidades?|pe[cç]as?|horas?|vagas?)/i, /restam\s+(apenas\s+)?\d+/i, /s[óo]\s+hoje/i,
  /oferta\s+(termina|expira|acaba|por\s+tempo)/i, /por\s+tempo\s+limitado/i, /estoque\s+(limitado|acabando)/i,
  /aproveite\s+(agora|j[áa])/i, /garanta\s+(j[áa]|agora)/i, /agora\s+ou\s+nunca/i, /[úu]ltima\s+chance/i,
  /sua\s+conta\s+ser[áa]\s+(bloqueada|suspensa|cancelada)/i, /\d+\s+pessoas\s+(est[ãa]o|vendo|comprando)/i];
const MP_POLITICAS = [/pol[íi]tica\s+de\s+privacidade|privacidade/i, /termos\s+(de\s+)?(uso|servi[cç]o|compra)/i,
  /troca[s]?\s+e\s+devolu[cç][õo]es|pol[íi]tica\s+de\s+troca|devolu[cç][ãa]o/i, /prazo\s+de\s+entrega|pol[íi]tica\s+de\s+entrega|\bfrete\b/i];
const MP_CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
function mpCnpjOk(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n) => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += Number(d[i]) * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
function mpDesconto(t) { const re = /(\d{2,3})\s*%\s*(off|de\s+desconto|desconto)|desconto\s+de\s+(\d{2,3})\s*%/gi; let m, max = 0; while ((m = re.exec(t))) max = Math.max(max, Number(m[1] || m[3])); return max; }
const mpLg = (x) => Math.log10(1 + (x || 0));

// pg: medidas da página (content.js); end: características do endereço, calculadas no background.
function caracteristicasPagina(pg, end) {
  const t = pg.texto || '';
  const cnpjs = [...t.matchAll(MP_CNPJ)].map((m) => m[0].replace(/\D/g, ''));
  return {
    https: end.https, br: end.br, pontosHost: end.pontosHost, ml: end.ml, gratis: end.gratis, subdominios: end.subdominios, ip: end.ip,
    textoLog: mpLg(pg.nTexto), htmlLog: mpLg(pg.html), linksLog: mpLg(pg.nLinks), linksExternos: pg.nLinks ? pg.extLinks / pg.nLinks : 0,
    forms: Math.min(pg.nForms || 0, 5), inputsLog: mpLg(pg.nInputs), senha: pg.senha ? 1 : 0, iframes: Math.min(pg.nIframes || 0, 5),
    imgsLog: mpLg(pg.nImgs), scriptsLog: mpLg(pg.nScripts), pt: /^pt/i.test(pg.lang || '') ? 1 : 0, semTitulo: (pg.title || '').trim() ? 0 : 1,
    precosLog: mpLg((t.match(/R\$\s?\d/g) || []).length), comprar: /adicionar\s+ao\s+carrinho|comprar\s+agora|\bcomprar\b|carrinho|finalizar\s+compra/i.test(t) ? 1 : 0,
    pix: /\bpix\b/i.test(t) ? 1 : 0, pagamento: MP_PAGAMENTO.some((x) => x.test(t)) ? 1 : 0, pressao: MP_PRESSAO.filter((x) => x.test(t)).length,
    descontoMax: mpDesconto(t) / 100, cnpjNaPagina: cnpjs.some(mpCnpjOk) ? 1 : 0, cnpjInvalidoNaPagina: cnpjs.length && !cnpjs.some(mpCnpjOk) ? 1 : 0,
    politicas: MP_POLITICAS.filter((x) => x.test(t)).length, contato: /fale\s+conosco|contato|atendimento|\bsac\b|quem\s+somos/i.test(t) ? 1 : 0,
    whatsapp: /whats\s?app/i.test(t) ? 1 : 0, assinatura: /\bassin(e|atura|ante)/i.test(t) ? 1 : 0,
    noticias: /not[íi]cias|reportagem|colunistas|[úu]ltimas\s+not/i.test(t) ? 1 : 0,
    login: /\b(entrar|login|acessar\s+(sua\s+)?conta|fa[çc]a\s+login|sign\s?in|log\s?in)\b/i.test(t) ? 1 : 0,
    urgenciaConta: /(conta|cart[ãa]o|cpf)\s+(ser[áa]\s+)?(bloquead|suspens|cancelad)|atualiz(e|ar)\s+(seus\s+)?dados|regulariz/i.test(t) ? 1 : 0,
    premio: /parab[ée]ns|voc[êe]\s+(foi\s+)?(ganhou|sorteado|selecionad)|resgat(e|ar)\s+(seu|o)\s+(pr[êe]mio|saldo|valor)/i.test(t) ? 1 : 0,
    ingles: /\b(the|your|account|password|verify|sign in)\b/i.test(t) && !/\b(você|não|para|com|sua)\b/i.test(t) ? 1 : 0,
    compraUI: pg.compraUI ? 1 : 0, cartao: pg.cartao ? 1 : 0,
    espiao: /(clonar|espionar|espiar|hackear|rastrear)/i.test(t) && /(de\s+qualquer\s+pessoa|sem\s+notificar|100%\s+an[ôo]nimo)/i.test(t) ? 1 : 0
  };
}

// Texto que o modelo lê: título + texto visível, até 4.000 caracteres (como no treino).
function textoDoModelo(pg) { return Array.from((pg.title || '') + ' \n ' + (pg.texto || '')).slice(0, 4000).join(''); }

// Probabilidade de golpe (0 a 1) a partir do texto e das características já calculadas.
function probGolpeTexto(texto, x) {
  if (!MP) return null;
  const tf = new Map();
  for (const g of mpPedacos(texto, MP.ngram[0], MP.ngram[1])) {
    const i = MP.indice.get(g);
    if (i !== undefined) tf.set(i, (tf.get(i) || 0) + 1);
  }
  let norma = 0, dot = 0;
  for (const [i, c] of tf) {
    const v = (1 + Math.log(c)) * MP.idf[i];
    norma += v * v; dot += v * MP.pesoTexto[i];
  }
  let z = MP.intercepto + (norma > 0 ? dot / Math.sqrt(norma) : 0);
  MP.nomes.forEach((n, k) => { z += ((Number(x[n]) || 0) - MP.media[k]) / (MP.escala[k] || 1) * MP.pesoNum[k]; });
  return 1 / (1 + Math.exp(-z));
}

function probGolpePagina(pg, end) {
  if (!MP || !pg) return null;
  return probGolpeTexto(textoDoModelo(pg), caracteristicasPagina(pg, end));
}

if (typeof module !== 'undefined') module.exports = { carregarModeloPagina, modeloPaginaPronto, modeloPaginaLimiares, mpPedacos, caracteristicasPagina, textoDoModelo, probGolpeTexto, probGolpePagina };
