"""Resume os dados abertos do consumidor.gov.br por empresa (só números; nada pessoal).
Uso: python3 consumidor.py SAIDA.json finalizadas_AAAA-MM.zip [outros meses...]
Baixe os arquivos "Dados - Mês/Ano" em https://www.consumidor.gov.br/pages/dadosabertos/externo/"""
import sys, csv, io, json, zipfile, unicodedata, re, collections, subprocess

def normalizar(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s.lower())

saida, arquivos = sys.argv[1], sys.argv[2:]
agg = collections.defaultdict(lambda: {'n': 0, 'resp': 0, 'aval': 0, 'resol': 0, 'nota_s': 0, 'nota_n': 0, 'nomes': collections.Counter()})
meses = []
for arq in arquivos:
    meses.append(re.search(r'(\d{4}-\d{2})', arq).group(1))
    with zipfile.ZipFile(arq) as z:
        csvs = [n for n in z.namelist() if n.endswith('.csv')]
    for nome in csvs:
        # alguns meses vêm em Deflate64, que o zipfile não abre; o comando unzip abre
        proc = subprocess.Popen(['unzip', '-p', arq, nome], stdout=subprocess.PIPE)
        if True:
            if True:
                leitor = csv.DictReader(io.TextIOWrapper(proc.stdout, encoding='utf-8-sig', newline=''), delimiter=';')
                for r in leitor:
                    emp = (r.get('Nome Fantasia') or '').strip()
                    k = normalizar(emp)
                    if not k: continue
                    a = agg[k]; a['n'] += 1; a['nomes'][emp] += 1
                    if (r.get('Respondida') or '').strip().upper() == 'S': a['resp'] += 1
                    av = (r.get('Avaliação Reclamação') or '').strip().lower()
                    if av in ('resolvida', 'não resolvida'):
                        a['aval'] += 1
                        if av == 'resolvida': a['resol'] += 1
                    nota = (r.get('Nota do Consumidor') or '').strip()
                    if nota.isdigit(): a['nota_s'] += int(nota); a['nota_n'] += 1
        proc.wait()
empresas = {}
for k, a in agg.items():
    if a['n'] < 20: continue                              # poucas reclamações não dizem muito
    empresas[k] = [a['nomes'].most_common(1)[0][0], a['n'], round(100 * a['resp'] / a['n']),
                   round(100 * a['resol'] / a['aval']) if a['aval'] >= 10 else None,
                   round(a['nota_s'] / a['nota_n'], 1) if a['nota_n'] >= 10 else None]
meses.sort()
json.dump({'fonte': 'consumidor.gov.br (dados abertos, reclamações finalizadas)', 'periodo': f'{meses[0]} a {meses[-1]}',
           'campos': ['nome', 'reclamacoes', 'pct_respondidas', 'pct_resolvidas', 'nota_media'], 'empresas': empresas},
          open(saida, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(empresas)} empresas com 20+ reclamações, {sum(a["n"] for a in agg.values())} reclamações, {meses[0]} a {meses[-1]}')
