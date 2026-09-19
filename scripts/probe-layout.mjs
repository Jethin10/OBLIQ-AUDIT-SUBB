import { readFileSync } from "node:fs";
const css = readFileSync("public/landing/wp-content/themes/ario/assets/css/app.css","utf8");
function show(sel){
  let idx=0,n=0;
  while(true){
    const i=css.indexOf(sel,idx);
    if(i<0)break;
    n++;
    if(n<=12){
      console.log("=== "+sel+" #"+n+" @"+i+" ===");
      console.log(css.slice(Math.max(0,i-120),i+700).replace(/\n/g," ").slice(0,820));
      console.log();
    }
    idx=i+sel.length;
  }
  console.log(sel+" total "+n+"\n");
}
show(".si-fwh");
show(".si-fw");
show(".z-2");
show(".z-3");
show(".z-5");
show("header{");
show("header ");
show("#mn");
