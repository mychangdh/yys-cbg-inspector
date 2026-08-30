/* eslint-disable @typescript-eslint/no-require-imports -- Node 预加载脚本必须使用 CommonJS。 */
const os = require("node:os");

try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || "tsx",
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: process.env.ComSpec || null,
  });
}
