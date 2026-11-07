# Modelo da página para a extensão: regressão logística com texto (TF-IDF de pedaços de letras) + características.
# 1) escolhe o tamanho do vocabulário (teste por domínio); 2) treina com tudo; 3) exporta JSON e amostras de conferência.
import json, sys, numpy as np, warnings
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import roc_auc_score
from scipy.sparse import hstack, csr_matrix
warnings.filterwarnings('ignore')
exec(open('comparar.py').read().split("gkf = GroupKFold")[0])
# Fora: o caminho do endereço (viés da coleta) e as que ficaram constantes no treino (idade e CNPJ não foram consultados).
FORA = {'caminho', 'idadeLog', 'idadeDesconhecida', 'idadeMenos90', 'cnpjAtivo', 'cnpjIrregular', 'pessoaFisica'}
idx = [i for i, n in enumerate(nomes) if n not in FORA]
X = X[:, idx]; NOMES = [nomes[i] for i in idx]
print(len(NOMES), 'características numéricas')
def vet(mf): return TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), min_df=3, max_features=mf, sublinear_tf=True, dtype=np.float64)
def oof(mf, C=4):
    p = np.zeros(len(Y))
    for tr, te in GroupKFold(5).split(X, Y, G):
        v = vet(mf); sc = StandardScaler().fit(X[tr])
        At = hstack([v.fit_transform([T[i] for i in tr]), csr_matrix(sc.transform(X[tr]))]).tocsr()
        Ae = hstack([v.transform([T[i] for i in te]), csr_matrix(sc.transform(X[te]))]).tocsr()
        p[te] = LogisticRegression(max_iter=4000, class_weight='balanced', C=C).fit(At, Y[tr]).predict_proba(Ae)[:, 1]
    return p
melhor = None
for mf in (5000, 10000, 20000, 40000):
    p = oof(mf); auc = roc_auc_score(Y, p); r2 = (p[Y == 1] > np.quantile(p[Y == 0], 0.98)).mean()
    print(f'vocabulário {mf:>6}: AUC {auc:.3f}  golpes pegos com 2% de falso alerta {r2:.1%}')
    if melhor is None or auc > melhor[1] + 0.003: melhor = (mf, auc, p)
mf, auc, p = melhor
lim2, lim1 = float(np.quantile(p[Y == 0], 0.98)), float(np.quantile(p[Y == 0], 0.99))
print(f'escolhido: {mf} (AUC {auc:.3f}); limiares 2% FP {lim2:.3f}, 1% FP {lim1:.3f}; pega {(p[Y==1]>lim2).mean():.1%} e {(p[Y==1]>lim1).mean():.1%}')
# Treino final com tudo
v = vet(mf); sc = StandardScaler().fit(X)
A = hstack([v.fit_transform(T), csr_matrix(sc.transform(X))]).tocsr()
lr = LogisticRegression(max_iter=4000, class_weight='balanced', C=4).fit(A, Y)
nv = len(v.vocabulary_); coef = lr.coef_[0]
vocab = [None] * nv
for g, i in v.vocabulary_.items(): vocab[i] = g
modelo = {'versao': 1, 'descricao': 'Regressão logística: texto da página (TF-IDF char_wb 3-5, sublinear, l2) + características', 'treino': {'paginas': int(len(Y)), 'golpes': int(Y.sum()), 'auc_teste_por_dominio': round(auc, 3)},
  'ngram': [3, 5], 'vocab': vocab, 'idf': [round(float(x), 6) for x in v.idf_], 'pesoTexto': [round(float(x), 6) for x in coef[:nv]],
  'nomes': NOMES, 'media': [float(x) for x in sc.mean_], 'escala': [float(x) for x in sc.scale_], 'pesoNum': [round(float(x), 6) for x in coef[nv:]],
  'intercepto': float(lr.intercept_[0]), 'limiar2': round(lim2, 4), 'limiar1': round(lim1, 4)}
json.dump(modelo, open(sys.argv[1], 'w'), ensure_ascii=False, separators=(',', ':'))
# Amostras para conferir o JavaScript: texto, características e a probabilidade calculada aqui (com os pesos arredondados).
rng = np.random.default_rng(1); am = rng.choice(len(Y), 40, replace=False)
md = json.load(open(sys.argv[1]))
def prob_json(texto, xnum):
    z = md['intercepto']; vv = vet(None); vv.vocabulary_ = {g: i for i, g in enumerate(md['vocab'])}; vv.idf_ = np.array(md['idf'])
    a = vv.transform([texto]); z += a.dot(np.array(md['pesoTexto']))[0]
    z += sum(((x - m) / s if s else 0) * w for x, m, s, w in zip(xnum, md['media'], md['escala'], md['pesoNum']))
    return 1 / (1 + np.exp(-z))
json.dump([{'texto': T[i], 'x': dict(zip(NOMES, X[i].tolist())), 'p': float(prob_json(T[i], X[i]))} for i in am], open(sys.argv[2], 'w'), ensure_ascii=False)
import os; print('tamanho do modelo:', os.path.getsize(sys.argv[1]) // 1024, 'KB')
