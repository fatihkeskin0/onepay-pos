import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "@/styles/index.css";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "OnePOS — Güvenli Kart Ödemesi",
  description: "Kredi kartı ile güvenle ödeme alın. 3D Secure, SSL şifreleme ve anlık sonuç bildirimi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={GeistSans.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('rf_theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body className={GeistSans.className}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
