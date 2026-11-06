const React=require('react'),RDS=require('react-dom/server'),sharp=require('sharp');const fa=require('react-icons/fa');
const L={camiseta:'FaTshirt',ingresso:'FaTicketAlt',professor:'FaChalkboardTeacher',brasil:'FaGlobeAmericas',conversa:'FaComments',gratis:'FaGift',loja:'FaStore',proibido:'FaBan',celular:'FaMobileAlt',computador:'FaLaptop',alerta:'FaExclamationTriangle'};
(async()=>{for(const [n,i] of Object.entries(L)){for(const [cor,suf] of [['#b8f5b0',''],['#f2c230','-am']]){const svg=RDS.renderToStaticMarkup(React.createElement(fa[i],{color:cor,size:512}));
 await sharp(Buffer.from(svg)).resize(256,256,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(process.argv[2]+'/i-'+n+suf+'.png');}}})();
