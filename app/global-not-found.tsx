/**
 * 子路径之外的全局 404 文档。
 *
 * 该文件不会经过 app/layout.tsx，因此域名根路径或其他未匹配路径不会
 * 带出应用 Provider、菜单和业务页面，只返回一个独立的 404 页面。
 */
export default function GlobalNotFound() {
  return (
    <html lang="zh-CN">
      <head>
        <title>404 - 页面不存在</title>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f5f6f8",
          color: "#252a34",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <main style={{ textAlign: "center", padding: "32px" }}>
          <p style={{ margin: 0, fontSize: "64px", fontWeight: 700 }}>404</p>
          <p style={{ margin: "12px 0 0", fontSize: "16px" }}>
            页面不存在
          </p>
        </main>
      </body>
    </html>
  );
}
