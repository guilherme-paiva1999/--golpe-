# Compara aprendizado de máquina clássico x rede neural nas páginas coletadas.
# Teste honesto: GroupKFold por domínio (o modelo nunca vê o mesmo site no treino e no teste).
import json, re, sys, numpy as np, warnings
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import roc_auc_score
from scipy.sparse import hstack, csr_matrix
warnings.filterwarnings('ignore')
import os; AQUI = os.path.dirname(os.path.abspath(sys.argv[0])); sys.path.insert(0, os.path.join(AQUI, '..', '1-extensao-codigo', 'ml')); import alfabetos as ALF   # v3.13: letras cirílicas

col = {json.loads(l)['url']: json.loads(l) for l in open('coleta.jsonl')}
fe = [json.loads(l) for l in open('feats.jsonl')]
MORTO = re.compile(r"for sale|domain|dom[íi]nio|404|not found|index of|suspend|parked|coming soon|em manuten|under construction|"
                   r"this site can|account has been|website is|bandwidth|cloudflare|just a moment|forbidden|access denied|error", re.I)
def raiz(h):
    p = (h or '').lower().replace('www.', '').split('.')
    return '.'.join(p[-3:]) if len(p) >= 3 and p[-2] in ('com', 'net', 'org', 'gov', 'edu') and len(p[-1]) == 2 else '.'.join(p[-2:])

X, Y, G, T, BRUTO, cortados = [], [], [], [], [], 0
for r in fe:
    if r['rotulo'] not in ('golpe', 'real') or not r['x']: continue
    c = col[r['url']]; pg = c.get('pagina') or {}
    texto = (pg.get('title') or '') + ' \n ' + (pg.get('texto') or '')
    if r['rotulo'] == 'golpe' and (len((pg.get('texto') or '').strip()) < 60 or MORTO.search(pg.get('title') or '') or MORTO.search((pg.get('texto') or '')[:300])):
        cortados += 1; continue                       # golpe que já saiu do ar ou virou outra coisa: rótulo não confiável
    if r['rotulo'] == 'golpe' and raiz(re.sub(r'^https?://', '', r['url']).split('/')[0].split(':')[0]) != raiz(pg.get('host')):
        cortados += 1; continue                       # golpe que redirecionou para outro site (GoDaddy, Instagram, site verdadeiro)
    X.append(list(r['x'].values())); Y.append(1 if r['rotulo'] == 'golpe' else 0); G.append(raiz(r['host'] or c['url'])); T.append(ALF.texto(texto[:4000])['texto']); BRUTO.append(pg.get('texto') or '')
X = np.array(X, float); Y = np.array(Y); G = np.array(G)
nomes = list(fe[0]['x'].keys()) if fe[0]['x'] else list(next(r for r in fe if r['x'])['x'].keys())
print(f'páginas usadas: {len(Y)} (golpes {Y.sum()}, reais {(Y==0).sum()}); golpes descartados por estarem fora do ar: {cortados}')

gkf = GroupKFold(n_splits=5)
def avaliar(nome, fazer, usa_texto=False, combinado=False, sementes=(0,)):
    res = []
    for sem in sementes:
        p = np.zeros(len(Y))
        for tr, te in gkf.split(X, Y, G):
            if usa_texto or combinado:
                v = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), min_df=3, max_features=40000, sublinear_tf=True)
                At, Ae = v.fit_transform([T[i] for i in tr]), v.transform([T[i] for i in te])
                if combinado:
                    sc = StandardScaler().fit(X[tr]); At = hstack([At, csr_matrix(sc.transform(X[tr]))]).tocsr(); Ae = hstack([Ae, csr_matrix(sc.transform(X[te]))]).tocsr()
            else:
                At, Ae = X[tr], X[te]
            m = fazer(sem); m.fit(At, Y[tr]); p[te] = m.predict_proba(Ae)[:, 1]
        res.append(p)
    p = np.mean(res, axis=0)
    pred = p >= 0.5
    acc = (pred == Y).mean(); rec = pred[Y == 1].mean(); fp = pred[Y == 0].mean(); auc = roc_auc_score(Y, p)
    # limiar com no máximo 2% de falsos alertas (o que importa numa extensão que bloqueia)
    lim = np.quantile(p[Y == 0], 0.98); rec2 = (p[Y == 1] > lim).mean()
    print(f'{nome:<46} acerto {acc:6.1%}  golpes pegos {rec:6.1%}  falsos alertas {fp:5.1%}  AUC {auc:.3f}  | com 2% de falso alerta pega {rec2:6.1%}')
    return dict(modelo=nome, acerto=acc, recall=rec, falsos=fp, auc=auc, recall_fp2=rec2)

out = []
print('\n== Características da página (46 números) ==')
out.append(avaliar('Clássico: regressão logística', lambda s: make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, class_weight='balanced'))))
out.append(avaliar('Clássico: floresta de árvores (Random Forest)', lambda s: RandomForestClassifier(n_estimators=400, class_weight='balanced', random_state=s, n_jobs=4)))
out.append(avaliar('Clássico: boosting de árvores', lambda s: HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, class_weight='balanced', random_state=s)))
out.append(avaliar('Rede neural (2 camadas, 64 e 32 neurônios)', lambda s: make_pipeline(StandardScaler(), MLPClassifier((64, 32), alpha=1e-3, max_iter=2000, early_stopping=True, random_state=s)), sementes=(0, 1, 2)))
print('\n== Texto da página (pedaços de letras, TF-IDF) ==')
out.append(avaliar('Clássico: regressão logística no texto', lambda s: LogisticRegression(max_iter=3000, class_weight='balanced', C=4), usa_texto=True))
out.append(avaliar('Rede neural no texto (1 camada, 128 neurônios)', lambda s: MLPClassifier((128,), alpha=1e-4, max_iter=200, early_stopping=True, random_state=s), usa_texto=True, sementes=(0, 1, 2)))
print('\n== Texto + características juntos ==')
out.append(avaliar('Clássico: regressão logística (texto + 46)', lambda s: LogisticRegression(max_iter=3000, class_weight='balanced', C=4), combinado=True))
out.append(avaliar('Rede neural (texto + 46)', lambda s: MLPClassifier((128,), alpha=1e-4, max_iter=200, early_stopping=True, random_state=s), combinado=True, sementes=(0, 1, 2)))
json.dump(out, open('comparacao.json', 'w'), ensure_ascii=False, indent=1)
# Quais características mais pesam (floresta de árvores, treinada em tudo)
rf = RandomForestClassifier(n_estimators=400, class_weight='balanced', random_state=0, n_jobs=4).fit(X, Y)
print('\nMais importantes:', ', '.join(f'{nomes[i]} {rf.feature_importances_[i]:.2f}' for i in np.argsort(-rf.feature_importances_)[:10]))
