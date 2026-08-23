# 后端数据库配置

静态数据接口直接从 MySQL 读取，不再在运行时读取 `data` 目录中的 JSON。

1. 先运行 `../yys-cbg-inspector-database/mysql-installer-web-community-5.7.44.0.msi` 安装 MySQL Server 5.7.44。该官方 Web 安装器需要联网下载所选组件。

2. 再导入数据库快照：

```cmd
mysql --default-character-set=utf8mb4 -u root -p < ..\yys-cbg-inspector-database\yys_cbg_inspector.sql
```

3. 在本目录创建 `.env`，参考 `.env.example` 填写实际 MySQL 密码：

```env
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=http://127.0.0.1:12831

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=你的数据库密码
MYSQL_DATABASE=yys_cbg_inspector
```

`MYSQL_PASSWORD` 只可保存在本机 `.env` 或部署环境的密钥管理服务中，不能提交到 Git、写入 README、前端 `.env.*`、日志或截图。以 `VITE_` 开头的变量会被打包到浏览器端，绝不能用于存放数据库密码。

4. 启动服务：

```bash
npm start
```

可通过 `GET /health` 确认数据库是否已连接。接口返回
`database: "connected"` 表示连接正常。
