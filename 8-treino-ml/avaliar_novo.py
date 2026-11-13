# Compara o modelo da página ATUAL (1-extensao-codigo/ml/modelo-pagina.json) com um modelo RETREINADO nas páginas antigas + novas
# (segunda coleta, v3.19: páginas de produto e carrinho de lojas reais, mais golpes atuais).
# Duas medidas honestas, sempre com sites que o modelo não viu no treino:
#  A) o modelo ATUAL nas páginas NOVAS (ele foi treinado só com as antigas, então as novas são "de fora");
#  B) o modelo RETREINADO em validação cruzada por domínio (GroupKFold), medido nas novas e nas antigas.
# Uso (na pasta com coleta.jsonl e feats.jsonl, com PYTHONUTF8=1):  python avaliar_novo.py caminho/modelo-pagina.json
import json, sys, os, math, numpy as np, warnings
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import roc_auc_score
from scipy.sparse import hstack, csr_matrix
warnings.filterwarnings('ignore')
exec(open(os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), 'comparar.py'), encoding='utf-8').read().split("gkf = GroupKFold")[0])

atual = json.load(open(sys.argv[1], encoding='utf-8'))
# quais linhas (na mesma ordem de X/Y/G/T) vieram da coleta nova e de que tipo de página
chave_para_meta = {}
for l in open('coleta.jsonl', encoding='utf-8'):
    r = json.loads(l); chave_para_meta[r['url']] = (r.get('fonte', 'antiga'), r.get('tipo', 'inicial'))
META = []
for r in fe:
    if r['rotulo'] not in ('golpe', 'real') or not r['x']: continue
    c = col[r['url']]; pg = c.get('pagina') or {}
    if str(c.get('final') or '').startswith('chrome-error') or pg.get('host') == 'chromewebdata': continue
    if r['rotulo'] == 'golpe' and (len((pg.get('texto') or '').strip()) < 60 or MORTO.search(pg.get('title') or '') or MORTO.search((pg.get('texto') or '')[:300])): continue
    if r['rotulo'] == 'golpe' and raiz(r['url'].split('//')[-1].split('/')[0].split(':')[0]) != raiz(pg.get('host')): continue
    META.append(chave_para_meta.get(r['url'], ('antiga', 'inicial')))
assert len(META) == len(Y), (len(META), len(Y))
FONTE = np.array([m[0] for m in META]); TIPO = np.array([m[1] for m in META])

# --- A) modelo atual ---
idx_atual = [nomes.index(n) for n in atual['nomes']]
vv = TfidfVectorizer(analyzer='char_wb', ngram_range=tuple(atual['ngram']), sublinear_tf=True, dtype=np.float64)
vv.vocabulary_ = {g: i for i, g in enumerate(atual['vocab'])}; vv.idf_ = np.array(atual['idf'])
A = vv.transform(T)
Xn = (X[:, idx_atual] - np.array(atual['media'])) / np.where(np.array(atual['escala']) == 0, 1, np.array(atual['escala']))
z = atual['intercepto'] + A.dot(np.array(atual['pesoTexto'])) + Xn.dot(np.array(atual['pesoNum']))
p_atual = 1 / (1 + np.exp(-np.asarray(z).ravel()))

def resumo(nome, y, p, lim1, lim2):
    if len(set(y)) < 2: return f'{nome}: só uma classe ({len(y)} páginas)'
    fp1 = (p[y == 0] >= lim1).mean(); fp2 = (p[y == 0] >= lim2).mean()
    rec1 = (p[y == 1] >= lim1).mean(); rec2 = (p[y == 1] >= lim2).mean()
    return (f'{nome:<46} n={len(y):>4} (golpes {int(y.sum()):>3})  AUC {roc_auc_score(y, p):.3f}  '
            f'alerta fraco (>= {lim2:.2f}): pega {rec2:5.1%} dos golpes, erra {fp2:5.1%} dos reais  |  alerta forte (>= {lim1:.2f}): pega {rec1:5.1%}, erra {fp1:5.1%}')

print('\n=== A) modelo ATUAL, só em páginas que ele nunca viu (coleta nova) ===')
nova = FONTE == 'nova'
for nome, m in [('todas as novas', nova), ('novas: página inicial', nova & (TIPO == 'inicial')), ('novas: produto', nova & (TIPO == 'produto')), ('novas: carrinho', nova & (TIPO == 'carrinho'))]:
    print(resumo('atual - ' + nome, Y[m], p_atual[m], atual['limiar1'], atual['limiar2']))
reais_novos = nova & (Y == 0)
for t in ('inicial', 'produto', 'carrinho'):
    m = reais_novos & (TIPO == t)
    if m.sum(): print(f'   falsos alertas em páginas REAIS ({t}, {int(m.sum())}): fraco {(p_atual[m] >= atual["limiar2"]).mean():.1%}, forte {(p_atual[m] >= atual["limiar1"]).mean():.1%}')

# --- B) retreinado, validação cruzada por domínio ---
FORA = {'caminho', 'idadeLog', 'idadeDesconhecida', 'idadeMenos90', 'cnpjAtivo', 'cnpjIrregular', 'pessoaFisica'}
idx = [i for i, n in enumerate(nomes) if n not in FORA]
Xr = X[:, idx]; NOMES = [nomes[i] for i in idx]
def vet(mf): return TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), min_df=3, max_features=mf, sublinear_tf=True, dtype=np.float64)
mf = 5000
p_novo = np.zeros(len(Y))
for tr, te in GroupKFold(5).split(Xr, Y, G):
    v = vet(mf); sc = StandardScaler().fit(Xr[tr])
    At = hstack([v.fit_transform([T[i] for i in tr]), csr_matrix(sc.transform(Xr[tr]))]).tocsr()
    Ae = hstack([v.transform([T[i] for i in te]), csr_matrix(sc.transform(Xr[te]))]).tocsr()
    p_novo[te] = LogisticRegression(max_iter=4000, class_weight='balanced', C=4).fit(At, Y[tr]).predict_proba(Ae)[:, 1]
lim2 = float(np.quantile(p_novo[Y == 0], 0.98)); lim1 = float(np.quantile(p_novo[Y == 0], 0.99))
print('\n=== B) modelo RETREINADO (antigas + novas), validação por domínio ===')
for nome, m in [('todas', np.ones(len(Y), bool)), ('antigas', FONTE == 'antiga'), ('novas', nova), ('novas: produto', nova & (TIPO == 'produto')), ('novas: carrinho', nova & (TIPO == 'carrinho'))]:
    print(resumo('novo  - ' + nome, Y[m], p_novo[m], lim1, lim2))
print('\n=== Mesmas páginas, lado a lado (AUC) ===')
for nome, m in [('todas', np.ones(len(Y), bool)), ('antigas', FONTE == 'antiga'), ('novas', nova)]:
    if len(set(Y[m])) > 1:
        print(f'{nome:<10} atual {roc_auc_score(Y[m], p_atual[m]):.3f}   retreinado {roc_auc_score(Y[m], p_novo[m]):.3f}' + ('   (atual: treino com as antigas, então o número das antigas é otimista)' if nome != 'novas' else ''))
json.dump({'lim2': lim2, 'lim1': lim1, 'n': int(len(Y)), 'golpes': int(Y.sum())}, open('resultado_avaliacao.json', 'w'))
