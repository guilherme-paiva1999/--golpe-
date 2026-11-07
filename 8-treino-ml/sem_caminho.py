import numpy as np, warnings
warnings.filterwarnings('ignore')
src=open('comparar.py').read().split("out = []")[0]
exec(src)
i=nomes.index('caminho'); X=np.delete(X,i,axis=1); nomes=[n for n in nomes if n!='caminho']
print('\n== Sem o "caminho" do endereço ==')
avaliar('Clássico: regressão logística', lambda s: make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, class_weight='balanced')))
avaliar('Clássico: floresta de árvores', lambda s: RandomForestClassifier(n_estimators=400, class_weight='balanced', random_state=s, n_jobs=4))
avaliar('Clássico: boosting de árvores', lambda s: HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, class_weight='balanced', random_state=s))
avaliar('Rede neural (64 e 32 neurônios)', lambda s: make_pipeline(StandardScaler(), MLPClassifier((64, 32), alpha=1e-3, max_iter=2000, early_stopping=True, random_state=s)), sementes=(0,1,2))
avaliar('Clássico: regressão logística (texto + 45)', lambda s: LogisticRegression(max_iter=3000, class_weight='balanced', C=4), combinado=True)
rf=RandomForestClassifier(n_estimators=400, class_weight='balanced', random_state=0, n_jobs=4).fit(X,Y)
print('Mais importantes:', ', '.join(f'{nomes[j]} {rf.feature_importances_[j]:.2f}' for j in np.argsort(-rf.feature_importances_)[:10]))
