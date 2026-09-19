import { readFileSync } from "node:fs";
const css = readFileSync("public/landing/wp-content/themes/ario/assets/css/app.css","utf8");
function show(sel){
  let idx=0,n=0;
  while(true){
    const i=css.indexOf(sel,idx);
    if(i<0)break;
    n++;
    if(n<=10){
      console.log("=== "+sel+" #"+n+" @"+i+" ===");
      console.log(css.slice(Math.max(0,i-150),i+900).replace(/\n/g," ").slice(0,1050));
      console.log();
    }
    idx=i+sel.length;
  }
  console.log(sel+" total "+n+"\n");
}
show("section#mn");
show("#mn{");
show("#mn ");
show("#mn,");
show("#mn.");
show("header .brg-btn");
show(".brg-btn");
show("#hm-lg");
show(".pr-logo");
show("#hm-in .bnr");
show("#hm-in .cntnt");
show(".h-fh");
show("body{overflow");
show("body{");
show('[data-ia]');
show('[data-sa]');
