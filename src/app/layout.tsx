import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '宗親普查系統',
  description: '宗親普查資料管理系統',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <body>
        {/* 字體大小初始化腳本 — 避免 FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('clan-font-size');if(s&&['16','18','20','22','24'].includes(s)){document.documentElement.setAttribute('data-font-size',s)}else{document.documentElement.setAttribute('data-font-size','20')}}catch(e){document.documentElement.setAttribute('data-font-size','20')}})()`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
