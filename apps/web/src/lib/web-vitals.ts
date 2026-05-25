import type { Metric } from "web-vitals";

export function reportWebVitals(): void {
  if (process.env.NEXT_PUBLIC_WEB_VITALS !== "true") return;

  void import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    const send = (metric: Metric): void => {
      void fetch("/api/web-vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: metric.name,
          value: metric.value,
          id: metric.id,
          navigationType: metric.navigationType,
        }),
        keepalive: true,
      }).catch(() => undefined);
    };

    onCLS(send);
    onFCP(send);
    onINP(send);
    onLCP(send);
    onTTFB(send);
  });
}
