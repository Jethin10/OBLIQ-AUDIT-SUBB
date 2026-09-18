import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

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
      <body className="antialiased" suppressHydrationWarning>
        <Script id="extension-attribute-sanitizer" strategy="beforeInteractive">
          {`(() => {
            const injected = name => name === 'bis_skin_checked' || name === 'bis_register' || name.startsWith('__processed_');
            const clean = root => {
              if (!root || root.nodeType !== 1) return;
              for (const attr of [...root.attributes]) if (injected(attr.name)) root.removeAttribute(attr.name);
              for (const el of root.querySelectorAll('*')) {
                for (const attr of [...el.attributes]) if (injected(attr.name)) el.removeAttribute(attr.name);
              }
            };
            clean(document.documentElement);
            const observer = new MutationObserver(records => {
              for (const record of records) {
                if (record.type === 'attributes' && injected(record.attributeName || '')) {
                  record.target.removeAttribute(record.attributeName);
                }
                for (const node of record.addedNodes) clean(node);
              }
            });
            observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true});
          })();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
