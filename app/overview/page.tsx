import { redirect } from "next/navigation";

export default function OverviewPage() {
  // Server Component 的 redirect 会由 Next.js 自动应用 basePath。
  redirect("/home");
}
