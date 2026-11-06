"""Gera amostra_paridade.json: probabilidade calculada em Python (recursos.py + modelo.json)
para conferir que modelo.js (JavaScript, dentro da extensão) dá o mesmo resultado.
Uso: python3 gerar_paridade.py"""
import json, math, os
import recursos as R
AQUI = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(AQUI, 'modelo.json')))
tld = dict(M['tld']); tld['__padrao__'] = M['tld_padrao']

def prob(host):
    x = R.calcular(host, tld)
    s = M['init']
    for a in M['arvores']:
        n = 0
        while a['e'][n] != -1:
            n = a['e'][n] if x[a['f'][n]] <= a['t'][n] else a['d'][n]
        s += M['taxa'] * a['v'][n]
    return 1 / (1 + math.exp(-s))

HOSTS = ['google.com', 'www.nubank.com.br', 'nubank-atualizar-cadastro.xyz', 'reclameaqui.com.br', 'g1.globo.com',
 'mercadolivre.com.br', 'secure-login-itau.top', 'magazineluiza.com.br', 'magaziineluiza.com', 'resgate-valores-gov.me',
 'paypal.com.verify-account.info', 'login.microsoftonline.com', 'microsoft-office365-login.web.app', 'deckegroup.com',
 'www.americanas.com.br', 'americanas-ofertas.shop', 'kabum.com.br', 'shopee.com.br', 'shopee-promo-relampago.online',
 '192.168.0.10', 'xn--nbank-wva.com', 'wa-spy-app.net', 'loja-ceramica-artesanal.com.br', 'casasbahia-black-friday.top',
 'bit.ly', 'banco-do-brasil-2via-boleto.com', 'uol.com.br', 'estadao.com.br', 'correios-rastreio-taxa.site',
 'meu-inss-beneficio.com', 'github.io', 'mitchellkrogza.github.io', 'abc123xyz987.tk', 'santander.com.br',
 'a.b.c.d.e.f.example.com', 'detran-sp-multas.org', 'apple-id-unlock.icloud-support.co', 'netflx.com']
json.dump([{'host': h, 'p': prob(h)} for h in HOSTS], open(os.path.join(AQUI, 'amostra_paridade.json'), 'w'), indent=1)
print(len(HOSTS), 'hosts')
