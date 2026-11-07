# Curva de aprendizado: com mais dados, a rede neural passa a floresta de árvores?
# Mesmo teste honesto (por domínio). Treina com uma fração dos dados de treino de cada dobra.
import json, re, numpy as np, warnings
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import roc_auc_score
warnings.filterwarnings('ignore')
exec(open('comparar.py').read().split("gkf = GroupKFold")[0])   # reaproveita a limpeza e as características
gkf = GroupKFold(n_splits=5)
rng = np.random.default_rng(0)
print(f'{"fração":>7}  {"Floresta (AUC)":>15}  {"Rede neural (AUC)":>18}')
for frac in (0.25, 0.5, 0.75, 1.0):
    pr, pn = np.zeros(len(Y)), np.zeros(len(Y))
    for tr, te in gkf.split(X, Y, G):
        tr = rng.permutation(tr)[: int(len(tr) * frac)]
        pr[te] = RandomForestClassifier(n_estimators=400, class_weight='balanced', random_state=0, n_jobs=4).fit(X[tr], Y[tr]).predict_proba(X[te])[:, 1]
        pn[te] = np.mean([make_pipeline(StandardScaler(), MLPClassifier((64, 32), alpha=1e-3, max_iter=2000, early_stopping=True, random_state=s)).fit(X[tr], Y[tr]).predict_proba(X[te])[:, 1] for s in (0, 1, 2)], axis=0)
    print(f'{frac:>7.0%}  {roc_auc_score(Y, pr):>15.3f}  {roc_auc_score(Y, pn):>18.3f}')
