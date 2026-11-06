"""Mostra por que o acerto do conjunto de Vrbančič engana. Uso: python3 avaliar_generalizacao.py full.csv [hosts_teste.json]"""
import json, numpy as np, pandas as pd, sys
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
df=pd.read_csv(sys.argv[1]).drop_duplicates().reset_index(drop=True)
REDE=['time_response','domain_spf','asn_ip','time_domain_activation','time_domain_expiration','qty_ip_resolved','qty_nameservers','qty_mx_servers','ttl_hostname','tls_ssl_certificate','qty_redirects','url_google_index','domain_google_index']
A=[c for c in df.columns if c not in REDE+['phishing']]; y=df.phishing.values
tr,te=train_test_split(np.arange(len(df)),test_size=0.2,stratify=y,random_state=7)
def med(yv,p,lim=.5):
    pr=(p>=lim); tn=((~pr)&(yv==0)).sum(); fp=(pr&(yv==0)).sum(); fn=((~pr)&(yv==1)).sum(); tp=(pr&(yv==1)).sum()
    return dict(acc=round((tp+tn)/len(yv),3),recall=round(tp/max(tp+fn,1),3),fp=round(fp/max(fp+tn,1),3),n=len(yv),legit=int((yv==0).sum()))
m=HistGradientBoostingClassifier(max_iter=300,random_state=7).fit(df.iloc[tr][A],y[tr])
p=m.predict_proba(df.iloc[te][A])[:,1]; yt=y[te]; tem_caminho=(df.iloc[te].directory_length.values!=-1)
print('1) teste igual ao treino              ',med(yt,p))
print('2) só endereços COM caminho           ',med(yt[tem_caminho],p[tem_caminho]))
print('3) só endereços SEM caminho           ',med(yt[~tem_caminho],p[~tem_caminho]))
# treinando e testando só com endereços que têm caminho
c=df.directory_length.values!=-1
idx=np.where(c)[0]; tr2,te2=train_test_split(idx,test_size=0.2,stratify=y[idx],random_state=7)
m2=HistGradientBoostingClassifier(max_iter=300,random_state=7).fit(df.iloc[tr2][A],y[tr2]); p2=m2.predict_proba(df.iloc[te2][A])[:,1]
print('4) treino e teste só COM caminho      ',med(y[te2],p2),'auc',round(roc_auc_score(y[te2],p2),3))
# teste em outra fonte: 24 mil nomes de sites (sem caminho)
cols17=['.','-','_','/','?','=','@','&','!',' ','~',',','+','*','#','$','%']
nomes=['dot','hyphen','underline','slash','questionmark','equal','at','and','exclamation','space','tilde','comma','plus','asterisk','hashtag','dollar','percent']
def linha(h):
    r={}
    for n,ch in zip(nomes,cols17): r[f'qty_{n}_url']=h.count(ch); r[f'qty_{n}_domain']=h.count(ch)
    r['qty_tld_url']=len(h.split('.')[-1]); r['length_url']=len(h); r['domain_length']=len(h)
    r['qty_vowels_domain']=sum(ch in 'aeiou' for ch in h)
    r['domain_in_ip']=int(h.replace('.','').isdigit()); r['server_client_domain']=int('server' in h or 'client' in h)
    r['email_in_url']=0; r['url_shortened']=int(h in ('bit.ly','tinyurl.com','t.co','cutt.ly','is.gd','rb.gy'))
    for part in ('directory','file','params'):
        for n in nomes: r[f'qty_{n}_{part}']=-1
        r[f'{part}_length']=-1
    r['tld_present_params']=-1; r['qty_params']=-1
    return r
print('--- com consultas de rede (B), só endereços COM caminho ---')
B=A+REDE
m3=HistGradientBoostingClassifier(max_iter=300,random_state=7).fit(df.iloc[tr2][B],y[tr2]); p3=m3.predict_proba(df.iloc[te2][B])[:,1]
print('6) B, treino e teste só COM caminho   ',med(y[te2],p3),'auc',round(roc_auc_score(y[te2],p3),3))
rede_so=REDE
m4=HistGradientBoostingClassifier(max_iter=300,random_state=7).fit(df.iloc[tr2][rede_so],y[tr2]); p4=m4.predict_proba(df.iloc[te2][rede_so])[:,1]
print('7) SÓ consultas de rede, COM caminho  ',med(y[te2],p4),'auc',round(roc_auc_score(y[te2],p4),3))

import os
if len(sys.argv) < 3 or not os.path.exists(sys.argv[2]): sys.exit('(teste 5 pulado: passe o hosts_teste.json gerado por treinar.py)')
h=json.load(open(sys.argv[2]))
Xh=pd.DataFrame([linha(x['host']) for x in h]).reindex(columns=A,fill_value=-1); yh=np.array([x['y'] for x in h])
ph=m.predict_proba(Xh)[:,1]
print('5) outra fonte (24 mil nomes de sites)',med(yh,ph),'auc',round(roc_auc_score(yh,ph),3))
print('   golpes marcados como golpe:',round(((ph>=.5)&(yh==1)).sum()/(yh==1).sum(),3),'| normais marcados como golpe:',round(((ph>=.5)&(yh==0)).sum()/(yh==0).sum(),3))
