// Testa só a lógica das regras de imitação do governo e de marca falsa na página.
const fs=require('fs'),vm=require('vm'),path=require('path');
const noop=()=>{},ev={addListener:noop};
const chrome={runtime:{onInstalled:ev,onStartup:ev,onMessage:ev,id:'x',getPlatformInfo:noop},alarms:{get:async()=>({}),create:noop,onAlarm:ev},webNavigation:{onBeforeNavigate:ev},storage:{local:{get:async()=>({}),set:async()=>{}},session:{get:async()=>({}),set:async()=>{}}},action:{}};
const ctx={chrome,console,AbortSignal,URL,TextDecoder,fetch:async()=>{throw 0}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../alfabetos.js'),'utf8')+fs.readFileSync(path.join(__dirname,'../background.js'),'utf8')+';this.T={imitaGoverno,avaliarHost,nivelDe,marcaFalsaNaPagina}',ctx);
const T=ctx.T; let ok=0,n=0;
const t=(nome,obtido,esperado)=>{n++;const b=JSON.stringify(obtido)===JSON.stringify(esperado);ok+=b;console.log((b?'OK  ':'ERRO'),nome.padEnd(46),JSON.stringify(obtido));};
console.log('--- imitação do governo (pontos) ---');
for(const [h,e] of [['resgate-valores-gov.me',60],['gov.br.resgate-agora.com',60],['meuinss-beneficio.com',60],['receitafederal-restituicao.online',60],['consultagov.com',60],['restituicao-irpf-consulta.com',60],['govbr-acesso.xyz',60],
  ['www.gov.br',0],['receita.fazenda.gov.br',0],['detran.sp.gov.br',0],['www.gov.uk',0],['usa.gov',0],['receitas.globo.com',0],['tudogostoso.com.br',0],['contabilidade-irpf.com.br',20],['nubank.com.br',0]])
  t(h,T.imitaGoverno(h),e);
console.log('--- nível do endereço sozinho ---');
for(const [h,p,e] of [['resgate-valores-gov.me','https:','perigo'],['resgate-valores-gov.me','http:','perigo']])
  t(h+' '+p,T.nivelDe(T.avaliarHost(h).pontos+(p==='http:'?10:0)),e);
console.log('--- letras cirílicas no endereço (v3.13) ---');
for(const [h,e] of [['xn--80ak6aa92e.com','perigo'],['xn--gogle-jye.cf','perigo'],['xn--nubnk-6ve.com.br','perigo']]) t(h,T.nivelDe(T.avaliarHost(h).pontos),e);
t('аррӏе.com imita apple',T.avaliarHost('xn--80ak6aa92e.com').motivos.some((m)=>/imita "apple".*russas/.test(m)),true);
t('мвд.рф (russo de verdade) só 10 pontos',T.avaliarHost('xn--b1aew.xn--p1ai').pontos,10);
t('дом.рф (russo de verdade) não é perigo',T.nivelDe(T.avaliarHost('xn--d1aqf.xn--p1ai').pontos)!=='perigo',true);
t('maçã.com.br (acento) sem pontos de alfabeto',T.avaliarHost('xn--ma-tiap.com.br').pontos,0);
console.log('--- marca falsa na página ---');
const S=(o)=>Object.assign({senha:false,pagamento:false},o);
t('Microsoft + senha em domínio estranho',!!T.marcaFalsaNaPagina('login-msft-check.com',['microsoft'],S({senha:true})),true);
t('Microsoft + senha em login.microsoftonline.com',T.marcaFalsaNaPagina('login.microsoftonline.com',['microsoft'],S({senha:true})),null);
t('Gov.br + senha em resgate-valores-gov.me',!!T.marcaFalsaNaPagina('resgate-valores-gov.me',['govbr'],S({senha:true})),true);
t('Gov.br + senha em sso.acesso.gov.br',T.marcaFalsaNaPagina('sso.acesso.gov.br',['govbr'],S({senha:true})),null);
t('Microsoft citado, mas sem senha nem pagamento',T.marcaFalsaNaPagina('blog-de-tecnologia.com',['microsoft'],S({})),null);
console.log(ok+'/'+n+' como esperado');
