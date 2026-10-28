import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { CbgChannel } from "@/types";
import "./index.scss";

const channels: CbgChannel[] = ["official", "huawei", "oppo", "vivo", "xiaomi"];

function parseChannel(value: string | null): CbgChannel {
  return channels.find((channel) => channel === value) || "official";
}

export function CbgWindowPage() {
  const location = useLocation();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [channel, setChannel] = useState<CbgChannel>(() =>
    parseChannel(new URLSearchParams(location.search).get("channel")),
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<string>("cbg-window:channel", ({ payload }) => {
      setChannel(parseChannel(payload));
      setReady(false);
      setError("");
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    const desktop = window.desktop;
    if (!viewport || !desktop) return;

    let stopped = false;
    let frame = 0;
    let synchronizing = false;
    let pending = false;
    const syncBounds = () => {
      if (synchronizing) {
        pending = true;
        return;
      }
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = viewport.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        synchronizing = true;
        void desktop
          .setCbgWebview(channel, {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          })
          .then(() => {
            if (!stopped) {
              setReady(true);
              setError("");
            }
          })
          .catch((reason: unknown) => {
            if (!stopped) {
              setError(
                reason instanceof Error ? reason.message : "无法打开藏宝阁页面",
              );
            }
          })
          .finally(() => {
            synchronizing = false;
            if (!stopped && pending) {
              pending = false;
              syncBounds();
            }
          });
      });
    };
    const observer = new ResizeObserver(syncBounds);
    observer.observe(viewport);
    syncBounds();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [channel]);

  return (
    <main className="cbg-window">
      <div ref={viewportRef} className="cbg-window__viewport">
        {(!ready || error) && (
          <div
            className={
              error ? "cbg-window__message is-error" : "cbg-window__message"
            }
            role={error ? "alert" : "status"}
          >
            {error || "正在打开藏宝阁…"}
          </div>
        )}
      </div>
    </main>
  );
}
