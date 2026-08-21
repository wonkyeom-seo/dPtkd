import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "투표 범위 분석 | 최소·평균·최대 득표 예측",
  description:
    "후보 수와 이름을 설정하고 개인별 투표 가능 후보를 골라 최소표, 평균 예상표, 최대표와 종합 순위를 계산합니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "투표 범위 분석",
    description: "가능한 선택을 모아 투표의 범위와 순위를 한눈에 확인하세요.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "투표 범위 분석",
    description: "최소표부터 평균 예상표, 가능 최대표까지 한눈에.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
