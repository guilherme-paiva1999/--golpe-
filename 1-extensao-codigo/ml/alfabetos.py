"""Alfabeto cirílico (v3.13): cópia exata de alfabetos.js, usada no treino.
Teste de que os dois dão o mesmo resultado: node ml/testar_alfabetos.js"""
import re

PARECIDAS = {
  'а': 'a', 'в': 'b', 'г': 'r', 'е': 'e', 'ё': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'п': 'n', 'р': 'p', 'с': 'c',
  'т': 't', 'у': 'y', 'х': 'x', 'ь': 'b', 'ѕ': 's', 'і': 'i', 'ї': 'i', 'ј': 'j', 'һ': 'h', 'ӏ': 'l', 'ԁ': 'd', 'ԛ': 'q',
  'ԝ': 'w', 'ү': 'y',
  'А': 'A', 'В': 'B', 'Е': 'E', 'Ё': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y',
  'Х': 'X', 'Ѕ': 'S', 'І': 'I', 'Ї': 'I', 'Ј': 'J', 'Һ': 'H', 'Ӏ': 'I', 'Ԛ': 'Q', 'Ԝ': 'W', 'Ү': 'Y'}
PALAVRA = re.compile('[A-Za-zÀ-ɏЀ-ԯ]+')
LATINA = re.compile('[A-Za-zÀ-ɏ]')
CIRILICA = re.compile('[Ѐ-ԯ]')
LETRA = re.compile('[A-Za-zÀ-ɏЀ-ԯ]')

def trocar(p): return ''.join(PARECIDAS.get(c, c) for c in p)
def mistura(p): return bool(LATINA.search(p) and CIRILICA.search(p))
def tudo_parecido(p):
    if not CIRILICA.search(p): return False
    return all(c in PARECIDAS for c in p if CIRILICA.match(c))

def texto(t):
    t = t or ''; mistas = 0
    def f(m):
        nonlocal mistas
        w = m.group(0)
        if not mistura(w): return w
        mistas += 1; return trocar(w)
    limpo = PALAVRA.sub(f, t)
    letras = len(LETRA.findall(t)); cir = len(CIRILICA.findall(t))
    return {'texto': limpo, 'mistas': mistas, 'cirilico': cir / letras if letras else 0}

def decodificar_host(host):
    out = []
    for l in (host or '').lower().split('.'):
        if l.startswith('xn--'):
            try: l = l[4:].encode('ascii').decode('punycode').lower()
            except Exception: pass
        out.append(l)
    return '.'.join(out)

def host(h):
    u = decodificar_host(h); m_ = t_ = 0; partes = []
    for l in u.split('.'):
        m, t = mistura(l), tudo_parecido(l)
        m_ |= m; t_ |= t
        partes.append(trocar(l) if m or t else l)
    letras = len(LETRA.findall(u)); cir = len(CIRILICA.findall(u))
    return {'unicode': u, 'cirilico': cir / letras if letras else 0, 'mistura': int(m_), 'tudoParecido': int(t_), 'esqueleto': '.'.join(partes)}
