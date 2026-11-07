"""Gera 1-extensao-codigo/ml/amostras-paginas-reais.json: páginas reais da coleta, com as medidas como o content.js manda,
as características e a probabilidade calculadas aqui, para o teste ponta a ponta da extensão conferir que dá igual.
Uso (na pasta com coleta.jsonl e feats.jsonl): python amostras_reais.py modelo-pagina.json saida.json
v3.13: entra também a página de golpe real que escreve "Nеtfliх" com letras russas (ficos.com.br)."""
import json, sys, os, math, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), '..', '1-extensao-codigo', 'ml'))
import alfabetos as ALF
from sklearn.feature_extraction.text import TfidfVectorizer
md = json.load(open(sys.argv[1], encoding='utf-8'))
col = {}
for l in open('coleta.jsonl', encoding='utf-8'):
    r = json.loads(l); col[r['url']] = r
fe = {}
for l in open('feats.jsonl', encoding='utf-8'):
    r = json.loads(l)
    if r['x']: fe[r['url']] = r
vv = TfidfVectorizer(analyzer='char_wb', ngram_range=tuple(md['ngram']), sublinear_tf=True, dtype=np.float64)
vv.vocabulary_ = {g: i for i, g in enumerate(md['vocab'])}; vv.idf_ = np.array(md['idf'])
def prob(texto, x):
    z = md['intercepto'] + vv.transform([texto]).dot(np.array(md['pesoTexto']))[0]
    z += sum(((x[n] - m) / s if s else 0) * w for n, m, s, w in zip(md['nomes'], md['media'], md['escala'], md['pesoNum']))
    return 1 / (1 + math.exp(-z))
CAMPOS = ['title', 'lang', 'texto', 'nTexto', 'nLinks', 'extLinks', 'nForms', 'nInputs', 'senha', 'nIframes', 'nImgs', 'nScripts', 'html', 'compraUI', 'cartao']
escolha, vistos = [], set()
for url, f in fe.items():
    pg = col[url].get('pagina') or {}
    if not pg.get('host') or pg['host'] in vistos or len((pg.get('texto') or '').strip()) < 200: continue
    disfarce = ALF.texto(pg.get('texto') or '')['mistas'] > 0
    if disfarce or (f['rotulo'] in ('golpe', 'real') and len([e for e in escolha if e['rotulo'] == f['rotulo']]) < 6):
        vistos.add(pg['host'])
        pagina = {k: pg.get(k) for k in CAMPOS}
        pagina['texto'] = (pagina['texto'] or '')[:6000]; pagina['title'] = (pagina['title'] or '')[:500]
        texto = ALF.texto(''.join(list((pagina['title'] or '') + ' \n ' + pagina['texto'])[:4000]))['texto']
        x = {n: f['x'][n] for n in md['nomes']}
        escolha.append({'rotulo': f['rotulo'], 'host': pg['host'].replace('www.', '', 1) if pg['host'].startswith('www.') else pg['host'],
                        'protocolo': 'https:' if f['x']['https'] else 'http:', 'p': prob(texto, x), 'x': x, 'pagina': pagina, 'disfarce': disfarce})
json.dump(escolha, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
for e in escolha: print(e['rotulo'], e['host'][:40], round(e['p'], 4), 'letras russas' if e['disfarce'] else '')
