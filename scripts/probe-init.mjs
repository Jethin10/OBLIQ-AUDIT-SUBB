import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
function show(re, label){
  const rx = new RegExp(re, "g");
  let m; let n=0;
  while((m=rx.exec(js))){
    n++;
    if(n<=8){
      console.log("=== "+label+" #"+n+" @"+m.index+" ===");
      console.log(js.slice(Math.max(0,m.index-600), m.index+900).replace(/\n/g," ").slice(0,1500));
      console.log();
    }
  }
  console.log(label+" total "+n+"\n");
}
show("var bh=function|const bh=|bh=function", "bh def");
show("var Wc|const Wc|Wc=function|\\bWc\\b", "Wc");
show("function dh|const dh=|dh=\\(\\)", "dh");
show("function mh|const mh=|mh=\\(\\)", "mh");
show("function ph|const ph=|ph=\\(\\)", "ph");
show("function gh|const gh=|gh=\\(\\)", "gh");
show("DOMContentLoaded", "DCL");
show("ro\\(\\)\\.init", "barba init");
show("beforeEnter\\(\\(\\{next", "beforeEnter hook ctx");
