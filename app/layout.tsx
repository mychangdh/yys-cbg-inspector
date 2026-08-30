import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../src/styles/index.scss";
import "../src/styles/app-shell.scss";
import { AppProviders } from "@/components/AppProviders";
import { AppLayout } from "@/components/Layout";

export const metadata: Metadata = {
  title: "阴阳师藏宝阁看号工具",
  description: "阴阳师藏宝阁账号数据分析工具",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProviders>
          <AppLayout>{children}</AppLayout>
        </AppProviders>
      </body>
    </html>
  );
}
