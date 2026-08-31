import { redirect } from "next/navigation";

export default function Page() {
  // Next.js 会根据 basePath 自动补上公开子目录，避免手动拼接后出现
  // /yys-cbg-inspector/yys-cbg-inspector 的重复路径。
  redirect("/home");
}
