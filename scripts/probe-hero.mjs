import { readFileSync } from "node:fs";
const css = readFileSync("public/landing/wp-content/themes/ario/assets/css/app.css","utf8");
function show(sel, max=4){
  let idx=0,n=0;
  while(true){
    const i=css.indexOf(sel,idx);
    if(i<0)break;
    n++;
    if(n<=max){
      console.log("=== "+sel+" #"+n+" @"+i+" ===");
      console.log(css.slice(Math.max(0,i-100),i+800).replace(/\n/g," ").slice(0,900));
      console.log();
    }
    idx=i+sel.length;
  }
  console.log(sel+" total "+n+"\n");
}
show("#hm-in");
show("#hm-lg");
show(".pr-logo");
show(".bnr");
show("#mn{");
show("section#mn");
show("#mn .lt");
show("header");
show(".brg-btn");
show(".c-lg");
show("body>section");
