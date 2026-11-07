"""Gera amostra_alfabetos.json: casos de endereço e de texto com letras cirílicas, calculados em Python,
para conferir que alfabetos.js e modelo.js dão o mesmo resultado (node testar_alfabetos.js)."""
import json, alfabetos as A, recursos as R
def puny(h): return '.'.join(('xn--' + l.encode('punycode').decode()) if any(ord(c) > 127 for c in l) else l for l in h.split('.'))
hosts_uni = ['аррӏе.com', 'gоogle.cf', 'nubаnk.com.br', 'secure-itаu.com.br', 'mercadоlivre.com.br', 'мвд.рф', 'дом.рф',
  'суджанские-вести.рф', 'роббиуильямс.robbiewilliamsmusic.ru', 'волос.online', 'рауреаl.com', 'раураl-login.xyz',
  'сосасоlа.com', 'netflix.com', 'nubank.com.br', 'loja-boa.com.br', 'maçã.com.br', 'münchen.de', 'xn--zzzz-.com',
  'login.аmazon.com.br.verify.top', 'ѕteam.com', 'ԝhatsapp.com', 'вконтакте24.рф', 'мыло-опт.com.ua', '中国.cn']
hosts = [puny(h) if 'xn--' not in h else h for h in hosts_uni]
textos = ['Entre na sua conta Nеtfliх agora', 'REVISITАМ', 'Напишите нам Личный кабинет', 'Pаgue com Рix já: chave pіx abaixo',
  'Promoção relâmpago! Últimas unidades com 70% de desconto', 'Русский Български Српски English Português', 'Сoins grátis',
  'аррӏе ID bloqueado', 'número do саrtão e сvv', '', 'çãõ ÁÉÍ ñ ß ŀ ǅ Ѐ ԯ']
tld = {'com': 0.4, 'br': 0.1, 'cf': 0.9, '__padrao__': 0.5}
json.dump({'tld': tld, 'hosts': [{'host': h, 'alf': A.host(h), 'x': R.calcular(h, tld)} for h in hosts],
           'textos': [{'t': t, 'alf': A.texto(t)} for t in textos]}, open('amostra_alfabetos.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(hosts), 'endereços,', len(textos), 'textos')
