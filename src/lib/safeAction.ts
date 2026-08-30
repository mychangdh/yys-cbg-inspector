import { createSafeActionClient } from "next-safe-action";

import type { AppServerError } from "./safeAction.types";

export const actionClient = createSafeActionClient({
  handleServerError(error): AppServerError {
    console.error("Server Action 执行失败:", error.message);

    return {
      code: "INTERNAL",
      message: "服务暂时不可用，请稍后重试",
    };
  },
});
