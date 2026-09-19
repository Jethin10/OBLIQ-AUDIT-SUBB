import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
function showCtx(label, pat){
  let idx=0,n=0;
  while(true){
    const i=js.indexOf(pat,idx);
    if(i<0)break;
    n++;
    if(n<=6){
      console.log("=== "+label+" #"+n+" @"+i+" ===");
      console.log(js.slice(Math.max(0,i-700),i+700).replace(/\n/g," ").slice(0,1400));
      console.log();
    }
    idx=i+pat.length;
  }
  console.log(label+" <"+pat+"> total "+n+"\n");
}
showCtx("menu", '"#mn"');
showCtx("menu2", "'#mn'");
showCtx("menu3", "#mn");
showCtx("burger", "brg-btn");
showCtx("pl fn", "pl=");
showCtx("fl fn", "fl=");
showCtx("Jc", "Jc=");
showCtx("hl", "hl=");
showCtx("menu timeline", ".brg");
