import { readFileSync } from "node:fs";
const css = readFileSync("public/landing/wp-content/themes/ario/assets/css/app.css","utf8");
function show(sel){
  let idx=0,n=0;
  while(true){
    const i=css.indexOf(sel,idx);
    if(i<0)break;
    n++;
    if(n<=6){
      console.log("=== "+sel+" #"+n+" @"+i+" ===");
      console.log(css.slice(Math.max(0,i-200),i+1200).replace(/\n/g," ").slice(0,1400));
      console.log();
    }
    idx=i+sel.length;
  }
  console.log(sel+" total "+n+"\n");
}
show("#mn");
show(".brg-btn");
show("#hm-in");
show("#hm-in .cntnt");
show("#hm-in .bnr");
show(".h-fh");
show(".pr-logo");
show("#hm-lg");
show(".hi ");
show(" .hi");
show(".hi-");
