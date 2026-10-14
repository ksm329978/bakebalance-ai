import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'BakeBalance AI · 이팝청춘', description:'매일의 기록을 더 나은 생산계획으로. 베이커리 생산관리 대시보드.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {return <html lang="ko"><body>{children}</body></html>}
