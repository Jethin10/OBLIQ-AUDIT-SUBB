import { readFileSync } from "node:fs";
const js = readFileSync("public/landing/wp-content/themes/ario/assets/js/app.js","utf8");
const keys = ["Smoother.create", "smoothTouch", "effects(", ".scroll", "ScrollTrigger.refresh", "function Vi", "Vi=(", "Vi =", "pinSpacing", "barba.init", "beforeEnter", "namespace"];
for (const k of keys) {
  let idx = 0, n = 0;
  while (true) {
    const i = js.indexOf(k, idx);
    if (i < 0) break;
    n++;
    console.log("=== " + k + " #" + n + " @" + i + " ===");
    console.log(js.slice(Math.max(0, i - 500), i + 900).replace(/\n/g, " ").slice(0, 1500));
    console.log();
    idx = i + k.length;
    if (n >= 4) break;
  }
  if (!n) console.log(k + " NOT FOUND\n");
}
