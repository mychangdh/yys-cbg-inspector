# 数据库文件

该目录提供后端所需的 MySQL 5.7 静态数据快照与安装器，不包含数据库密码、
本地配置、游戏账号数据、藏宝阁登录态或商品御魂库存。

## MySQL 5.7 安装器

`mysql-installer-web-community-5.7.44.0.msi` 是 MySQL 官方的 Windows Web 安装器，
版本为 MySQL Installer Community 5.7.44.0。运行安装器后选择 MySQL Server 5.7.44；
安装过程需要联网下载组件。

- 官方下载地址：`https://dev.mysql.com/downloads/installer/`
- 文件 SHA-256：`A6E0A905DC3081C97B7C43E98377E16C9AE9DD695C5A0660B47F419FC403C0B1`
- 安装器仅是联网引导包；如需完全离线部署，请从 MySQL 官方归档另行下载完整包，不要将超过 GitHub 单文件限制的大型安装包提交到此仓库。

## 导入快照

`yys_cbg_inspector.sql` 是从当前 MySQL 5.7.44 数据库重新导出的完整快照，包含建库、表结构、数据、触发器、存储过程和事件。导入会执行 `DROP DATABASE IF EXISTS yys_cbg_inspector`，因此会覆盖同名数据库；导入前请确认其中没有需要保留的数据。

在 `cmd.exe` 中执行：

```cmd
mysql --default-character-set=utf8mb4 -u root -p < yys_cbg_inspector.sql
```

快照包含以下静态数据表：

- `heroes`：藏宝阁式神 ID、名称、英文标识、稀有度与基础面板。
- `relic_suits`：藏宝阁御魂套装 ID、名称、英文标识、两件套属性、效果与逢魔标识。

## 更新快照

在配置好 `../yys-cbg-inspector-backend/.env` 后，可使用以下命令从运行中的 MySQL 导出更新版本：

```cmd
mysqldump --default-character-set=utf8mb4 --single-transaction --routines --events --triggers --add-drop-database --databases yys_cbg_inspector > yys_cbg_inspector.sql
```

导出账号密码时使用 `-p` 交互输入密码，或由本机 `.env` 注入 `MYSQL_PWD`；不要将真实密码写进脚本、SQL、README、日志或 Git 提交。
