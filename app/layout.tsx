import type { Metadata } from "next";
import "./globals.css";

/**
 * Some browser extensions (password managers, form fillers, shopping
 * assistants) stamp marker attributes such as `bis_skin_checked`,
 * `bis_register` and `__processed_*` onto elements. Those foreign attributes
 * confuse the landing page's animation runtime and React hydration, so this
 * pre-paint script strips them and keeps stripping any the extension adds
 * later. It must stay dependency-free and must never throw: a parse or
 * runtime error here would abort the page's remaining scripts.
 */
const EXTENSION_SANITIZER_JS = `(function () {
  var PREFIX = "__processed_";
  function isJunk(name) {
    return (
      name === "bis_skin_checked" ||
      name === "bis_register" ||
      (name && name.indexOf(PREFIX) === 0)
    );
  }
  function stripElement(el) {
    if (!el || el.nodeType !== 1) return;
    try {
      for (var i = el.attributes.length - 1; i >= 0; i--) {
        if (isJunk(el.attributes[i].name)) el.removeAttribute(el.attributes[i].name);
      }
    } catch (e) {}
    var kids = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (var j = 0; j < kids.length; j++) {
      var node = kids[j];
      try {
        for (var k = node.attributes.length - 1; k >= 0; k--) {
          if (isJunk(node.attributes[k].name)) node.removeAttribute(node.attributes[k].name);
        }
      } catch (e) {}
    }
  }
  function sweep() {
    if (document.documentElement) stripElement(document.documentElement);
  }
  function watch() {
    try {
      var mo = new MutationObserver(function (recs) {
        for (var r = 0; r < recs.length; r++) {
          var rec = recs[r];
          if (rec.type === "attributes" && isJunk(rec.attributeName)) {
            try {
              rec.target.removeAttribute(rec.attributeName);
            } catch (e) {}
          }
          var added = rec.addedNodes || [];
          for (var x = 0; x < added.length; x++) stripElement(added[x]);
        }
      });
      mo.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
      });
    } catch (e) {}
  }
  sweep();
  if (document.documentElement) watch();
  else
    document.addEventListener("DOMContentLoaded", function () {
      sweep();
      watch();
    });
  document.addEventListener("DOMContentLoaded", sweep);
  window.addEventListener("load", sweep);
})();`;

export const metadata: Metadata = {
  title: "OBLIQ Audit | Document Review",
  description: "Mini audit document review system for CA firms",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EXTENSION_SANITIZER_JS }} />
      </head>
      <body className="antialiased" data-barba="wrapper" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
