"""Treina o classificador de sites de golpe.
Uso: python3 treinar.py PASTA_DOS_DADOS   (precisa de phishing.txt e top-1m.csv)
Gera modelo.json (usado pela extensão) e metricas.json."""
import sys, re, json, random, hashlib, collections, time
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score
import recursos as R

D = sys.argv[1]
random.seed(7); np.random.seed(7)
valido = re.compile(r'^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$')
N_POR_CLASSE = 60000

# ---- golpes: Phishing.Database (no máximo 15 por domínio, para um domínio não dominar) ----
ph = set()
for l in open(f'{D}/phishing.txt', encoding='utf-8', errors='ignore'):
    l = l.strip().lower()
    if '.' in l and valido.match(l): ph.add(l)
por = collections.defaultdict(list)
for h in ph: por[R.raiz(h)].append(h)
golpes = []
for reg, hs in por.items():
    random.shuffle(hs); golpes += hs[:15]
random.shuffle(golpes); golpes = golpes[:N_POR_CLASSE]

# ---- legítimos: sites do ranking Cisco Umbrella (só o site em si, sem subdomínios técnicos) ----
legit, vistos = [], set()
for l in open(f'{D}/top-1m.csv', encoding='utf-8', errors='ignore'):
    rank, _, host = l.strip().partition(',')
    host = host.lower()
    if not rank.isdigit() or not valido.match(host) or host in ph: continue
    reg = R.raiz(host)
    if host not in (reg, 'www.' + reg) or reg in vistos or reg in por: continue
    vistos.add(reg); legit.append((int(rank), host))
topo = [x for x in legit if x[0] <= 50000]; cauda = [x for x in legit if x[0] > 50000]
random.shuffle(topo); random.shuffle(cauda)
legit = (topo[:20000] + cauda[:N_POR_CLASSE - min(20000, len(topo))])[:N_POR_CLASSE]

dados = [(h, 1, 0) for h in golpes] + [(h, 0, r) for r, h in legit]
random.shuffle(dados)
print(f'golpes={len(golpes)} legítimos={len(legit)} total={len(dados)}')

# ---- separação por domínio (o mesmo domínio nunca aparece no treino e no teste) ----
def teste(h): return int(hashlib.md5(R.raiz(h).encode()).hexdigest(), 16) % 5 == 0
tr = [d for d in dados if not teste(d[0])]; te = [d for d in dados if teste(d[0])]

# ---- risco por final de domínio, calculado SÓ com o treino ----
cont = collections.Counter(h.split('.')[-1] for h, y, _ in tr)
ruim = collections.Counter(h.split('.')[-1] for h, y, _ in tr if y)
prior = sum(y for _, y, _ in tr) / len(tr)
tld = {t: (ruim[t] + 5*prior) / (cont[t] + 5) for t, c in cont.items() if c >= 30}
tld['__padrao__'] = prior

def X(lista): return np.array([R.calcular(h, tld) for h, _, _ in lista], dtype=float)
t0 = time.time(); Xtr, Xte = X(tr), X(te)
ytr = np.array([y for _, y, _ in tr]); yte = np.array([y for _, y, _ in te])
print(f'sinais calculados em {time.time()-t0:.0f}s | treino={len(tr)} teste={len(te)}')

t0 = time.time()
m = GradientBoostingClassifier(n_estimators=150, max_depth=5, learning_rate=0.1, subsample=0.8, random_state=7)
m.fit(Xtr, ytr); print(f'treinado em {time.time()-t0:.0f}s')

def medir(y, p, lim=0.5, nome=''):
    pred = (p >= lim).astype(int)
    tn = int(((pred == 0) & (y == 0)).sum()); fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum()); tp = int(((pred == 1) & (y == 1)).sum())
    r = dict(acuracia=round((tp+tn)/len(y), 4), precisao=round(tp/max(tp+fp, 1), 4), recall=round(tp/max(tp+fn, 1), 4),
             falsos_positivos=round(fp/max(fp+tn, 1), 4), n=int(len(y)), limiar=lim)
    try: r['auc'] = round(roc_auc_score(y, p), 4)
    except Exception: pass
    return r
p = m.predict_proba(Xte)[:, 1]
res = {'teste_geral': medir(yte, p)}
# teste difícil: só legítimos de pouca fama (rank > 300 mil) contra todos os golpes
dificil = np.array([(y == 1) or (r > 300000) for _, y, r in te])
res['teste_dificil_cauda'] = medir(yte[dificil], p[dificil])
br = np.array([h.endswith('.br') for h, _, _ in te])
if br.sum() > 200: res['somente_br'] = medir(yte[br], p[br])
# limiares: o que dá no máximo 1% e 0,5% de falsos positivos
neg = np.sort(p[yte == 0])
for alvo in (0.01, 0.005):
    lim = float(neg[int(len(neg)*(1-alvo))])
    res[f'limiar_fp_{alvo}'] = medir(yte, p, lim)
# o que a precisão vira no mundo real, onde golpe é raro
g = res['teste_geral']
for prev in (0.01, 0.05):
    tpr, fpr = g['recall'], g['falsos_positivos']
    res[f'precisao_com_{int(prev*100)}pct_de_golpes'] = round(tpr*prev/(tpr*prev + fpr*(1-prev)), 4)
imp = sorted(zip(R.NOMES, m.feature_importances_), key=lambda x: -x[1])[:10]
res['sinais_mais_importantes'] = [(n, round(float(v), 3)) for n, v in imp]
json.dump(res, open('metricas.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(res, indent=1, ensure_ascii=False))

# ---- exporta para a extensão ----
init = float(m._raw_predict_init(Xte[:1])[0][0])
arvores = []
for est in m.estimators_[:, 0]:
    t = est.tree_
    arvores.append({'f': t.feature.tolist(), 't': [round(float(x), 6) for x in t.threshold], 'e': t.children_left.tolist(),
                    'd': t.children_right.tolist(), 'v': [round(float(x), 6) for x in t.value[:, 0, 0]]})
top = sorted(((t, v) for t, v in tld.items() if t != '__padrao__'), key=lambda x: -cont[x[0]])[:300]
json.dump({'nomes': R.NOMES, 'tld': {t: round(v, 4) for t, v in top}, 'tld_padrao': round(prior, 4), 'init': init,
           'taxa': m.learning_rate, 'arvores': arvores, 'limiar': 0.5}, open('modelo.json', 'w'), separators=(',', ':'))
# amostra para conferir a versão em JavaScript
amostra = random.sample(te, 400)
json.dump([{'host': h, 'p': float(pp)} for (h, _, _), pp in zip(amostra, m.predict_proba(X(amostra))[:, 1])],
          open('/tmp/amostra_paridade.json', 'w'))
# lista de teste para comparar com as regras antigas
with open('/tmp/hosts_teste.json', 'w') as f:
    json.dump([{'host': h, 'y': int(y), 'p': float(pp)} for (h, y, _), pp in zip(te, p)], f)
