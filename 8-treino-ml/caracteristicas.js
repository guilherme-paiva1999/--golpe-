// Calcula as características de cada página coletada (as mesmas que a extensão poderá calcular ao vivo).
// Uso: node caracteristicas.js coleta.jsonl extras.json saida.jsonl
// extras.json: { host: { dias, cnpj: 'ativo'|'irregular'|'nenhum'|'pf' } } vindo de RDAP/BrasilAPI.
const fs = require('fs'), vm = require('vm'), path = require('path');
const EXT = '/home/user/--golpe-/1-extensao-codigo';
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(EXT, 'modelo.js'), 'utf8') + ';this.M={carregarModelo,probGolpe};', ctx);
ctx.M.carregarModelo(JSON.parse(fs.readFileSync(path.join(EXT, 'ml/modelo.json'), 'utf8')));
// Regras de endereço da extensão (avaliarHost), sem chrome
const noop = () => {}, ev = { addListener: noop };
const bctx = { console, URL, AbortSignal, TextDecoder, fetch: async () => { throw 0; },
  chrome: { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop }, alarms: { get: async () => ({}), create: noop, onAlarm: ev },
    webNavigation: { onBeforeNavigate: ev }, storage: { local: { get: async () => ({}), set: async () => {} }, session: { get: async () => ({}), set: async () => {} } }, action: {} } };
vm.createContext(bctx);
vm.runInContext(fs.readFileSync(path.join(EXT, 'background.js'), 'utf8') + ';this.B={avaliarHost,dominioRaiz,sufixo,HOSPEDAGEM,ehIPv4};', bctx);
const B = bctx.B;

const PAGAMENTO = [/chave\s+pix/i, /pague\s+(agora|com\s+pix)/i, /finalizar\s+(a\s+)?compra/i, /boleto\s+banc[áa]rio/i,
  /n[úu]mero\s+do\s+cart[ãa]o/i, /c[óo]digo\s+de\s+seguran[çc]a|\bcvv\b/i, /pagamento\s+(via|por)\s+pix/i, /pix\s+copia\s+e\s+cola/i,
  /taxa\s+(de\s+)?(libera[cç][aã]o|desbloqueio)/i];
const PRESSAO = [/[úu]ltimas?\s+(unidades?|pe[cç]as?|horas?|vagas?)/i, /restam\s+(apenas\s+)?\d+/i, /s[óo]\s+hoje/i,
  /oferta\s+(termina|expira|acaba|por\s+tempo)/i, /por\s+tempo\s+limitado/i, /estoque\s+(limitado|acabando)/i,
  /aproveite\s+(agora|j[áa])/i, /garanta\s+(j[áa]|agora)/i, /agora\s+ou\s+nunca/i, /[úu]ltima\s+chance/i,
  /sua\s+conta\s+ser[áa]\s+(bloqueada|suspensa|cancelada)/i, /\d+\s+pessoas\s+(est[ãa]o|vendo|comprando)/i];
const POLITICAS = [/pol[íi]tica\s+de\s+privacidade|privacidade/i, /termos\s+(de\s+)?(uso|servi[cç]o|compra)/i,
  /troca[s]?\s+e\s+devolu[cç][õo]es|pol[íi]tica\s+de\s+troca|devolu[cç][ãa]o/i, /prazo\s+de\s+entrega|pol[íi]tica\s+de\s+entrega|\bfrete\b/i];
const CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
function cnpjOk(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n) => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += Number(d[i]) * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
function desconto(t) { const re = /(\d{2,3})\s*%\s*(off|de\s+desconto|desconto)|desconto\s+de\s+(\d{2,3})\s*%/gi; let m, max = 0; while ((m = re.exec(t))) max = Math.max(max, Number(m[1] || m[3])); return max; }
const lg = (x) => Math.log10(1 + (x || 0));

function caracteristicas(r, extras) {
  const pg = r.pagina || {};
  const t = pg.texto || '';
  const host = (pg.host || (() => { try { return new URL(r.final || r.url).hostname; } catch (e) { return ''; } })()).toLowerCase().replace(/^www\./, '');
  const dom = B.dominioRaiz(host);
  const h = B.avaliarHost(host);
  const p = B.ehIPv4(dom) ? 0.5 : (ctx.M.probGolpe(dom) ?? 0.5);
  const cnpjs = [...t.matchAll(CNPJ)].map((m) => m[0].replace(/\D/g, ''));
  const ex = extras[r.url] || extras[dom] || {};
  const url = (() => { try { return new URL(r.final || r.url); } catch (e) { return null; } })();
  return {
    // endereço
    https: url && url.protocol === 'https:' ? 1 : 0, br: dom.endsWith('.br') ? 1 : 0, pontosHost: Math.min(h.pontos, 100) / 100, ml: p,
    gratis: B.sufixo(host, B.HOSPEDAGEM) ? 1 : 0, subdominios: Math.min(host.split('.').length - dom.split('.').length, 4),
    caminho: url ? Math.min(url.pathname.length + url.search.length, 200) / 200 : 0, ip: B.ehIPv4(dom) ? 1 : 0,
    // idade e empresa (RDAP / BrasilAPI)
    idadeLog: ex.dias != null ? lg(ex.dias) : 0, idadeDesconhecida: ex.dias == null ? 1 : 0, idadeMenos90: ex.dias != null && ex.dias < 90 ? 1 : 0,
    cnpjAtivo: ex.cnpj === 'ativo' ? 1 : 0, cnpjIrregular: ex.cnpj === 'irregular' ? 1 : 0, pessoaFisica: ex.cnpj === 'pf' ? 1 : 0,
    // página
    textoLog: lg(pg.nTexto), htmlLog: lg(pg.html), linksLog: lg(pg.nLinks), linksExternos: pg.nLinks ? pg.extLinks / pg.nLinks : 0,
    forms: Math.min(pg.nForms || 0, 5), inputsLog: lg(pg.nInputs), senha: pg.senha ? 1 : 0, iframes: Math.min(pg.nIframes || 0, 5),
    imgsLog: lg(pg.nImgs), scriptsLog: lg(pg.nScripts), pt: /^pt/i.test(pg.lang || '') ? 1 : 0, semTitulo: (pg.title || '').trim() ? 0 : 1,
    precosLog: lg((t.match(/R\$\s?\d/g) || []).length), comprar: /adicionar\s+ao\s+carrinho|comprar\s+agora|\bcomprar\b|carrinho|finalizar\s+compra/i.test(t) ? 1 : 0,
    pix: /\bpix\b/i.test(t) ? 1 : 0, pagamento: PAGAMENTO.some((x) => x.test(t)) ? 1 : 0, pressao: PRESSAO.filter((x) => x.test(t)).length,
    descontoMax: desconto(t) / 100, cnpjNaPagina: cnpjs.some(cnpjOk) ? 1 : 0, cnpjInvalidoNaPagina: cnpjs.length && !cnpjs.some(cnpjOk) ? 1 : 0,
    politicas: POLITICAS.filter((x) => x.test(t)).length, contato: /fale\s+conosco|contato|atendimento|\bsac\b|quem\s+somos/i.test(t) ? 1 : 0,
    whatsapp: /whats\s?app/i.test(t) ? 1 : 0, assinatura: /\bassin(e|atura|ante)/i.test(t) ? 1 : 0,
    noticias: /not[íi]cias|reportagem|colunistas|[úu]ltimas\s+not/i.test(t) ? 1 : 0,
    login: /\b(entrar|login|acessar\s+(sua\s+)?conta|fa[çc]a\s+login|sign\s?in|log\s?in)\b/i.test(t) ? 1 : 0,
    urgenciaConta: /(conta|cart[ãa]o|cpf)\s+(ser[áa]\s+)?(bloquead|suspens|cancelad)|atualiz(e|ar)\s+(seus\s+)?dados|regulariz/i.test(t) ? 1 : 0,
    premio: /parab[ée]ns|voc[êe]\s+(foi\s+)?(ganhou|sorteado|selecionad)|resgat(e|ar)\s+(seu|o)\s+(pr[êe]mio|saldo|valor)/i.test(t) ? 1 : 0,
    ingles: /\b(the|your|account|password|verify|sign in)\b/i.test(t) && !/\b(você|não|para|com|sua)\b/i.test(t) ? 1 : 0
  };
}
module.exports = { caracteristicas };
if (require.main === module) {
  const [ent, extrasArq, sai] = process.argv.slice(2);
  const extras = fs.existsSync(extrasArq) ? JSON.parse(fs.readFileSync(extrasArq, 'utf8')) : {};
  const out = fs.readFileSync(ent, 'utf8').split('\n').filter(Boolean).map((l) => {
    const r = JSON.parse(l);
    return JSON.stringify({ rotulo: r.rotulo, url: r.url, host: (r.pagina && r.pagina.host) || '', x: r.pagina ? caracteristicas(r, extras) : null });
  });
  fs.writeFileSync(sai, out.join('\n') + '\n');
  console.log(out.length, 'linhas');
}
