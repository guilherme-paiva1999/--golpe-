"""Monta a lista da segunda coleta (v3.15): golpes ATUAIS ligados ao Brasil (Phishing.Database, MIT) e sites reais
brasileiros (ranking Tranco) para visitar página inicial + página de produto + carrinho. Só http(s), sem usuário/senha na URL.
Uso: python montar_lista2.py PASTA_DOS_DADOS saida_golpes.tsv saida_reais.tsv"""
import sys, re, random, collections, concurrent.futures as cf, urllib.request, ssl
from urllib.parse import urlparse
D, SG, SR = sys.argv[1:4]
random.seed(11)
usados = set()
for l in open('dados/lista.tsv', encoding='utf-8'):
    p = l.rstrip('\n').split('\t')
    if len(p) > 1: usados.add((urlparse(p[1]).hostname or '').replace('www.', ''))
MARCAS = re.compile(r'nubank|itau|bradesco|caixa|correios|mercadolivre|mercadopago|shopee|picpay|santander|sicredi|magalu|magazine|americanas|casasbahia|\bpix\b|gov-?br|receita|inss|detran|boleto|2via|serasa|shein|netshoes|kabum|olx|enel|vivo|claro|restitui|fgts|cnh|sorteio|promoc', re.I)
cand, por = [], collections.Counter()
for l in open(f'{D}/links.txt', encoding='utf-8', errors='ignore'):
    u = l.strip()
    if not u.startswith(('http://', 'https://')): continue
    try: p = urlparse(u)
    except Exception: continue
    h = (p.hostname or '').lower()
    if not h or p.username or p.password or '.' not in h or h.replace('www.', '') in usados: continue
    if not (h.endswith('.br') or MARCAS.search(h)): continue
    if por[h] >= 1: continue
    por[h] += 1; cand.append(u)
random.shuffle(cand); cand = cand[:30000]
print(len(cand), 'candidatos de golpe; testando se estão no ar')
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
def vivo(u):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36'}), timeout=7, context=ctx)
        corpo = r.read(4000).decode('utf-8', 'ignore')
        return u if r.status == 200 and len(corpo.strip()) > 100 else None
    except Exception: return None
with cf.ThreadPoolExecutor(120) as ex: vivos = [u for u in ex.map(vivo, cand) if u]
print(len(vivos), 'no ar'); vivos = vivos[:1200]
open(SG, 'w', encoding='utf-8').write(''.join('golpe\t' + u + '\n' for u in vivos))
# sites reais: .com.br do ranking Tranco (posição 1 a 150000) que ainda não foram usados
reais = []
for l in open(f'{D}/tr/top-1m.csv', encoding='utf-8', errors='ignore'):
    rk, _, h = l.strip().partition(',')
    if not rk.isdigit() or int(rk) > 150000: break
    h = h.lower()
    if h.endswith('.com.br') and h.count('.') == 2 and h not in usados: reais.append(h)
random.shuffle(reais); reais = reais[:1800]
open(SR, 'w', encoding='utf-8').write(''.join('real\thttps://www.' + h + '/\n' for h in reais))
print(len(reais), 'sites reais')
