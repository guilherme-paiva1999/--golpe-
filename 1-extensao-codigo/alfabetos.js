'use strict';
/* =====================================================================
   Alfabeto cirílico (v3.13). Golpistas trocam letras latinas por letras russas
   iguais a elas: "Nеtfliх" (е e х são russas) ou o endereço "аррӏе.com", que
   aparece como xn--80ak6aa92e.com. A pessoa vê "netflix"/"apple"; o computador vê
   outra palavra, e filtros comuns não pegam.
   Este arquivo: (1) decodifica o endereço (punycode), (2) mede quanto há de
   cirílico, (3) acha palavras que misturam os dois alfabetos e (4) devolve o
   "esqueleto" em letras latinas (Nеtfliх -> Netflix), para as regras e os dois
   modelos de aprendizado de máquina lerem o que a pessoa lê.
   A cópia em Python, usada no treino, é ml/alfabetos.py (teste: ml/testar_alfabetos.js).
   ===================================================================== */

// Letras cirílicas que parecem latinas (minúsculas e maiúsculas).
const ALF_PARECIDAS = {
  'а': 'a', 'в': 'b', 'г': 'r', 'е': 'e', 'ё': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'п': 'n', 'р': 'p', 'с': 'c',
  'т': 't', 'у': 'y', 'х': 'x', 'ь': 'b', 'ѕ': 's', 'і': 'i', 'ї': 'i', 'ј': 'j', 'һ': 'h', 'ӏ': 'l', 'ԁ': 'd', 'ԛ': 'q',
  'ԝ': 'w', 'ү': 'y',
  'А': 'A', 'В': 'B', 'Е': 'E', 'Ё': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y',
  'Х': 'X', 'Ѕ': 'S', 'І': 'I', 'Ї': 'I', 'Ј': 'J', 'Һ': 'H', 'Ӏ': 'I', 'Ԛ': 'Q', 'Ԝ': 'W', 'Ү': 'Y'
};
// Faixas explícitas (iguais no Python): latim básico + acentos, e cirílico.
const ALF_PALAVRA = /[A-Za-zÀ-ɏЀ-ԯ]+/g;
const ALF_LATINA = /[A-Za-zÀ-ɏ]/;
const ALF_CIRILICA = /[Ѐ-ԯ]/;
const ALF_CIRILICA_G = /[Ѐ-ԯ]/g;
const ALF_LETRA_G = /[A-Za-zÀ-ɏЀ-ԯ]/g;

function alfTrocar(palavra) { return Array.from(palavra, (c) => ALF_PARECIDAS[c] || c).join(''); }
function alfMistura(palavra) { return ALF_LATINA.test(palavra) && ALF_CIRILICA.test(palavra); }
// Palavra toda em cirílico, mas só com letras que parecem latinas ("аррӏе"): disfarce, não russo de verdade.
function alfTudoParecido(palavra) {
  if (!ALF_CIRILICA.test(palavra)) return false;
  for (const c of palavra) if (ALF_CIRILICA.test(c) && !ALF_PARECIDAS[c]) return false;
  return true;
}

// Texto da página: troca as letras só nas palavras que misturam os dois alfabetos (o russo de verdade fica como está).
function alfTexto(texto) {
  let mistas = 0;
  const limpo = String(texto || '').replace(ALF_PALAVRA, (w) => { if (!alfMistura(w)) return w; mistas++; return alfTrocar(w); });
  const letras = (String(texto || '').match(ALF_LETRA_G) || []).length;
  const cir = (String(texto || '').match(ALF_CIRILICA_G) || []).length;
  return { texto: limpo, mistas, cirilico: letras ? cir / letras : 0 };
}

// ---------- Punycode (RFC 3492): "xn--80ak6aa92e" -> "аррӏе" ----------
function alfPunycode(entrada) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const saida = [];
  let n = 128, i = 0, bias = 72;
  const fim = entrada.lastIndexOf('-');
  for (let j = 0; j < (fim > 0 ? fim : 0); j++) {
    if (entrada.charCodeAt(j) >= 128) return null;
    saida.push(entrada.charCodeAt(j));
  }
  const adapt = (delta, num, primeiro) => {
    delta = primeiro ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / num);
    let k = 0;
    while (delta > ((base - tMin) * tMax) >> 1) { delta = Math.floor(delta / (base - tMin)); k += base; }
    return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
  };
  for (let p = fim > 0 ? fim + 1 : 0; p < entrada.length;) {
    const velho = i;
    for (let w = 1, k = base; ; k += base) {
      if (p >= entrada.length) return null;
      const c = entrada.charCodeAt(p++);
      const d = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
      if (d >= base) return null;
      i += d * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (d < t) break;
      w *= base - t;
    }
    bias = adapt(i - velho, saida.length + 1, velho === 0);
    n += Math.floor(i / (saida.length + 1));
    i %= saida.length + 1;
    if (n > 0x10ffff) return null;
    saida.splice(i++, 0, n);
  }
  return String.fromCodePoint(...saida);
}
function alfDecodificarHost(host) {
  return String(host || '').toLowerCase().split('.').map((l) => {
    if (!l.startsWith('xn--')) return l;
    const d = alfPunycode(l.slice(4));
    return d === null ? l : d.toLowerCase();
  }).join('.');
}

// Endereço: { unicode, cirilico (0 a 1), mistura, tudoParecido, esqueleto (em letras latinas) }.
function alfHost(host) {
  const unicode = alfDecodificarHost(host);
  let mistura = 0, tudo = 0;
  const esqueleto = unicode.split('.').map((l) => {
    const m = alfMistura(l), t = alfTudoParecido(l);
    if (m) mistura = 1;
    if (t) tudo = 1;
    return m || t ? alfTrocar(l) : l;
  }).join('.');
  const letras = (unicode.match(ALF_LETRA_G) || []).length;
  const cir = (unicode.match(ALF_CIRILICA_G) || []).length;
  return { unicode, cirilico: letras ? cir / letras : 0, mistura, tudoParecido: tudo, esqueleto };
}

if (typeof module !== 'undefined') module.exports = { alfTexto, alfHost, alfPunycode, alfDecodificarHost, alfTrocar, ALF_PARECIDAS };
