export default function Loading() {
  return (
    <div
      className="page-loading page-route-loading"
      role="status"
      aria-live="polite"
    >
      <span className="page-loading-spinner" aria-hidden="true" />
      <span>正在加载页面…</span>
    </div>
  );
}
