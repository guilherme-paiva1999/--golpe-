const {chromium}=require('playwright');
const T={motivo:'Essa dúvida tem motivo',criativa:'Indústria criativa',quem:'Quem somos',funciona:'E isso já funciona',alem:'A gente vai além',selo:'Selo “Isso não é golpe”',obrigado:'Obrigado!'};
(async()=>{const b=await chromium.launch();const p=await b.newPage({deviceScaleFactor:2});
for(const [k,t] of Object.entries(T)){
 await p.setContent(`<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@700&display=swap"></head><body style="margin:0;background:transparent"><div id="t" style="display:inline-block;padding:24px 34px;font-family:Silkscreen;font-weight:700;font-size:84px;line-height:1.1;color:#cdf7c5;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 6px rgba(205,247,197,.9),0 0 22px rgba(80,230,90,.85),0 0 46px rgba(60,200,70,.55)">${t}</div></body></html>`,{waitUntil:'networkidle'});
 await p.evaluate(()=>document.fonts.ready);
 await (await p.$('#t')).screenshot({path:process.argv[2]+'/t-'+k+'.png',omitBackground:true});}
await b.close();})();
