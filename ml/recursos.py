"""Sinais calculados só a partir do nome do site (host). Os mesmos sinais existem em
modelo.js dentro da extensão, então o que é treinado aqui é o que roda no navegador."""
import math, re

SUFIXOS_COMPOSTOS = {'com.br','net.br','org.br','gov.br','edu.br','mil.br','co.uk','org.uk',
                     'com.au','com.ar','com.pt','com.mx','co.za'}
HOSPEDAGEM = ['000webhostapp.com','weebly.com','wixsite.com','blogspot.com','github.io','netlify.app',
  'vercel.app','pages.dev','web.app','firebaseapp.com','herokuapp.com','glitch.me','godaddysites.com',
  'myshopify.com','webflow.io','sites.google.com','duckdns.org','ngrok.io','repl.co','onrender.com']
PALAVRAS = ['secure','account','verify','verif','login','signin','update','bank','pay','support','wallet',
  'confirm','webmail','password','senha','seguranca','atualizar','cadastro','acesso','boleto','2via',
  'segundavia','promo','oferta','relampago','liberacao','recover','unlock','suspend','alert','auth','token']
MARCAS = {
 'nubank':['nubank.com.br'],'itau':['itau.com.br','itau.com'],'bradesco':['bradesco.com.br'],
 'caixa':['caixa.gov.br'],'santander':['santander.com.br','santander.com'],'correios':['correios.com.br'],
 'mercadolivre':['mercadolivre.com.br','mercadolivre.com'],'mercadopago':['mercadopago.com.br','mercadopago.com'],
 'magalu':['magazineluiza.com.br','magalu.com'],'magazineluiza':['magazineluiza.com.br'],
 'americanas':['americanas.com.br','americanas.com'],'casasbahia':['casasbahia.com.br'],
 'shopee':['shopee.com.br','shopee.com'],'netflix':['netflix.com'],'picpay':['picpay.com'],
 'paypal':['paypal.com'],'apple':['apple.com','icloud.com'],'microsoft':['microsoft.com','live.com','office.com'],
 'google':['google.com'],'facebook':['facebook.com'],'instagram':['instagram.com'],'whatsapp':['whatsapp.com'],
 'amazon':['amazon.com','amazon.com.br'],'linkedin':['linkedin.com'],'dropbox':['dropbox.com'],
 'binance':['binance.com'],'coinbase':['coinbase.com'],'steam':['steampowered.com','steamcommunity.com']}
ESPIONAGEM = re.compile(r'(social|phone|mobile|cell|whats?app|insta(gram)?|face(book)?|tele(gram)?|tiktok|chat|follow|wech|msg|sms|track)\w*spy|spy\w*(app|phone|chat|social)|espion(ar|agem)\w*|(whats|zap|insta|celular|face)\w*espi[aã]o|espi[aã]o\w*(whats|zap|insta|celular|face)|spyware|stalker', re.I)

NOMES = ['len_host','n_labels','len_reg','len_sld','n_sub','dig_host','dig_sld','hif_sld','hif_host',
  'max_label','entropia','vogais','cons_run','trocas_dig','tld_risco','tld_len','is_ip','puny','hospedagem',
  'kw','marca_falsa','marca_typo','n_tokens','tok_medio','tok_max','dig_run','unicos','espiao']

def raiz(host):
    p = host.split('.')
    if len(p) < 2: return host
    dois = '.'.join(p[-2:])
    if len(p) >= 3 and dois in SUFIXOS_COMPOSTOS: return '.'.join(p[-3:])
    return dois

def lev(a, b):
    m = list(range(len(b)+1))
    for i in range(1, len(a)+1):
        prev, m[0] = m[0], i
        for j in range(1, len(b)+1):
            cur = m[j]
            m[j] = min(m[j]+1, m[j-1]+1, prev + (a[i-1] != b[j-1]))
            prev = cur
    return m[len(b)]

def entropia(s):
    if not s: return 0.0
    n = len(s); return -sum((c/n)*math.log2(c/n) for c in [s.count(x) for x in set(s)])

def maior_run(s, pred):
    best = cur = 0
    for ch in s:
        cur = cur+1 if pred(ch) else 0
        best = max(best, cur)
    return best

def marca(host, dom):
    tokens = [t for t in re.split(r'[.\-]', host) if t]
    extras = len(host.split('.')) > len(dom.split('.'))
    com_palavra = any(p in host for p in PALAVRAS)
    falsa = typo = 0
    for m, ofic in MARCAS.items():
        if dom in ofic: continue
        for t in tokens:
            exato = t == m and (len(m) >= 6 or com_palavra or extras)
            contem = len(m) >= 6 and len(t) > len(m) and m in t
            parecido = len(m) >= 6 and len(t) >= 5 and abs(len(t)-len(m)) <= 1 and lev(t, m) == 1
            if exato or contem: falsa = 1
            if parecido: typo = 1
    return falsa, typo

def calcular(host, tld_risco):
    host = host.lower().strip('.')
    dom = raiz(host); labels = host.split('.'); tld = labels[-1]
    sld = dom.split('.')[0] if '.' in dom else dom
    ip = bool(re.fullmatch(r'\d{1,3}(\.\d{1,3}){3}', host))
    letras = [c for c in sld if c.isalpha()]
    vog = sum(c in 'aeiou' for c in letras) / len(letras) if letras else 0.0
    trocas = sum(1 for a, b in zip(sld, sld[1:]) if a.isdigit() != b.isdigit() and (a.isalpha() or b.isalpha()))
    falsa, typo = marca(host, dom)
    tokens = [t for t in re.split(r'[.\-]', host) if t]
    return [
      len(host), len(labels), len(dom), len(sld), len(labels)-len(dom.split('.')),
      sum(c.isdigit() for c in host)/len(host), (sum(c.isdigit() for c in sld)/len(sld)) if sld else 0,
      sld.count('-'), host.count('-'), max(len(l) for l in labels), entropia(sld), vog,
      maior_run(sld, lambda c: c.isalpha() and c not in 'aeiou'), trocas,
      tld_risco.get(tld, tld_risco['__padrao__']), len(tld), int(ip), int('xn--' in host),
      int(any(host == h or host.endswith('.'+h) for h in HOSPEDAGEM)),
      sum(p in host for p in PALAVRAS), falsa, typo, len(tokens),
      sum(len(t) for t in tokens)/len(tokens) if tokens else 0, max((len(t) for t in tokens), default=0),
      maior_run(host, str.isdigit), len(set(sld))/len(sld) if sld else 0,
      int(bool(ESPIONAGEM.search(host)))]
