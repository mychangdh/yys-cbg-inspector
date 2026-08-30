import { redirect } from "next/navigation";
import { APP_BASE_PATH } from "@/config/paths";

export default function Page() {
  // Server Component 的 redirect 显式带上子路径，避免根入口跳到域名根目录。
  redirect(`${APP_BASE_PATH}/home`);
}
