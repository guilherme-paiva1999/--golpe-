"""Treina com o conjunto de Vrbančič (endereço completo + consultas de rede).
Uso: python3 treinar_url.py full.csv
Compara: A) só estrutura do endereço (roda no navegador, sem consultar nada)
         B) com consultas de rede (idade do domínio, SPF, certificado, etc.)"""
import sys, json, time
import numpy as np, pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score

df = pd.read_csv(sys.argv[1])
antes = len(df); df = df.drop_duplicates(); print(f'linhas={antes} sem duplicatas={len(df)} golpes={int(df.phishing.sum())}')
REDE = ['time_response','domain_spf','asn_ip','time_domain_activation','time_domain_expiration','qty_ip_resolved',
        'qty_nameservers','qty_mx_servers','ttl_hostname','tls_ssl_certificate','qty_redirects','url_google_index','domain_google_index']
A = [c for c in df.columns if c not in REDE + ['phishing']]
y = df.phishing.values
tr, te = train_test_split(np.arange(len(df)), test_size=0.2, stratify=y, random_state=7)

def medir(yv, p, lim=0.5):
    pred = (p >= lim).astype(int)
    tn = int(((pred == 0) & (yv == 0)).sum()); fp = int(((pred == 1) & (yv == 0)).sum())
    fn = int(((pred == 0) & (yv == 1)).sum()); tp = int(((pred == 1) & (yv == 1)).sum())
    return dict(acuracia=round((tp+tn)/len(yv), 4), precisao=round(tp/max(tp+fp, 1), 4), recall=round(tp/max(tp+fn, 1), 4),
                falsos_positivos=round(fp/max(fp+tn, 1), 4), auc=round(roc_auc_score(yv, p), 4), n=len(yv))
res = {}
for nome, cols in (('B_com_consultas_de_rede', A + REDE), ('A_so_estrutura_do_endereco', A)):
    t0 = time.time()
    m = HistGradientBoostingClassifier(max_iter=300, learning_rate=0.1, random_state=7).fit(df.iloc[tr][cols], y[tr])
    p = m.predict_proba(df.iloc[te][cols])[:, 1]
    res[nome] = medir(y[te], p); print(nome, res[nome], f'{time.time()-t0:.0f}s')
json.dump(res, open('metricas_url.json', 'w'), indent=1)
