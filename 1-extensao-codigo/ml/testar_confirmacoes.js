// v3.17: duas listas (contra e a favor) e as confirmações abertas (Tranco, Internet Archive, crt.sh): só a lógica, sem rede.
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {}, ev = { addListener: noop };
const chrome = { runtime: { onInstalled: ev, onStartup: ev, onMessage: ev, id: 'x', getPlatformInfo: noop }, alarms: { get: async () => ({}), create: noop, onAlarm: ev },
  webNavigation: { onBeforeNavigate: ev }, storage: { local: { get: async () => ({}), set: async () => {} }, session: { get: async () => ({}), set: async () => {} } }, action: {} };
const ctx = { chrome, console, AbortSignal, URL, TextDecoder, fetch: async () => { throw 0; } }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../alfabetos.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8') +
  ';this.T={separarMotivos,classificarLinha,linhaTranco,linhaWayback,linhaCrt,pontuarConfianca};', ctx);
const T = ctx.T;
let ok = 0, n = 0;
const chk = (nome, cond, extra) => { n++; ok += !!cond; console.log((cond ? 'OK  ' : 'ERRO'), nome.padEnd(70), extra === undefined ? '' : extra); };
// --- listas ---
const s = T.separarMotivos(['A página usa mensagens de pressão.', 'A favor: consumidor.gov.br: 90% respondidas.', 'Contra: sem CNPJ ativo.', 'A favor: empresa ativa na Receita Federal (X), aberta há 3 anos.'],
  ['Usa conexão segura (cadeado).'], ['CNPJ 11.222.333/0001-81 (mostrado na página) conferido na Receita Federal: X, ativa.', 'Atenção: o CNPJ da página (1) não é o da empresa dona do endereço do site (2).']);
chk('"A favor:" vai para a lista verde, sem o prefixo', s.favor.includes('consumidor.gov.br: 90% respondidas.') && s.favor.includes('Usa conexão segura (cadeado).'));
chk('o resto vai para a lista vermelha, e "Contra:" perde o prefixo', s.contra.includes('A página usa mensagens de pressão.') && s.contra.includes('sem CNPJ ativo.'));
chk('"empresa ativa..." não repete (a linha do CNPJ já diz isso)', !s.favor.concat(s.contra).some((x) => /^empresa ativa na Receita/.test(x)));
chk('linha do CNPJ conferido vai para a verde; divergência de CNPJ para a vermelha', s.favor.some((x) => /conferido na Receita/.test(x)) && s.contra.some((x) => /não é o da empresa dona/.test(x)));
// --- pontuarConfianca devolve o que a loja tem a favor ---
const c = T.pontuarConfianca({ cnpjValido: true, contato: true, politicas: true, gateway: true, emailMesmoDominio: true }, 4000, 'https:', 0, false);
chk('a lista verde traz cadeado, CNPJ, contato, políticas, pagamento e idade', c.favoraveis.length === 7, c.favoraveis.length + ' itens');
const c2 = T.pontuarConfianca({}, null, 'http:', 0, false);
chk('loja sem provas: lista verde vazia e a vermelha cheia', c2.favoraveis.length === 0 && c2.motivos.length >= 4, c2.motivos.length + ' contra');
// --- Tranco ---
chk('Tranco: 3.349 está entre os 10 mil', /entre os 10 mil sites/.test(T.linhaTranco(3349)), T.linhaTranco(3349));
chk('Tranco: 500 está entre os 1.000', /entre os 1\.000 sites/.test(T.linhaTranco(500)));
chk('Tranco: fora dos 100 mil não vira linha', T.linhaTranco(undefined) === null);
// --- Internet Archive ---
const ano = new Date().getUTCFullYear();
chk('Internet Archive: com histórico', /desde 1999 \(\d+ anos de histórico\)/.test(T.linhaWayback({ archived_snapshots: { closest: { timestamp: '19990125101003' } } })));
chk('Internet Archive: sem histórico', /não achamos histórico/.test(T.linhaWayback({ archived_snapshots: {} })));
chk('Internet Archive: resposta estranha não derruba', /não achamos histórico/.test(T.linhaWayback(null)));
// --- crt.sh ---
const antigo = [{ not_before: '2012-05-01T00:00:00' }, { not_before: '2026-10-07T05:00:23' }];
chk('crt.sh: pega o certificado mais antigo', /é de 2012/.test(T.linhaCrt(antigo)), T.linhaCrt(antigo));
const recente = [{ not_before: new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 19) }];
chk('crt.sh: certificado de 12 dias é "recente"', /12 dias atrás \(recente\)/.test(T.linhaCrt(recente)), T.linhaCrt(recente));
chk('crt.sh: sem certificados', /não achamos certificados/.test(T.linhaCrt([])));
// --- cada linha cai na lista certa ---
chk('"aparece nos arquivos desde" é a favor', T.classificarLinha('Internet Archive: o site aparece nos arquivos desde 1999 (27 anos de histórico).') === 'favor');
chk('"não achamos histórico" é contra', T.classificarLinha('Internet Archive: não achamos histórico deste site (site novo ou pouco visitado).') === 'contra');
chk('crt.sh antigo é a favor; recente é contra', T.classificarLinha(T.linhaCrt(antigo)) === 'favor' && T.classificarLinha(T.linhaCrt(recente)) === 'contra');
console.log(ok + '/' + n + ' como esperado');
process.exitCode = ok === n ? 0 : 1;
