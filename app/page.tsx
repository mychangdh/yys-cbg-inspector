import { redirect } from "next/navigation";

export default function Page() {
  // 开发环境跳到 /home，生产环境由 Next.js 自动补上 basePath。
  redirect("/home");
}
