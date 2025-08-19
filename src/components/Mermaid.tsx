import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import { useTheme } from "@/hooks/use-theme";

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Decide theme based on current app theme and OS dark preference
function chooseMermaidTheme(
  theme: "dark" | "light" | "system",
  systemDark: boolean
): "dark" | "default" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "default";
  return systemDark ? "dark" : "default";
}

export default function Mermaid({ code }: { code: string }) {
  const { theme } = useTheme();
  const [svg, setSvg] = useState<string>("");
  const idRef = useRef<string>(
    `mermaid-${Math.random().toString(36).slice(2)}`
  );
  // Track system dark mode to react when theme === 'system'
  const mql =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : undefined;
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      if (document.documentElement.classList.contains("dark")) return true;
      return !!mql?.matches;
    }
    return false;
  });

  const cleaned = useMemo(() => code.trim(), [code]);

  // React to OS theme changes when in system mode
  useEffect(() => {
    if (theme === "system" && mql) {
      const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
      setSystemDark(mql.matches);
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [theme]);

  useEffect(() => {
    let canceled = false;
    const mermaidTheme = chooseMermaidTheme(theme, systemDark);
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: mermaidTheme,
        securityLevel: "loose",
      });
      mermaid
        .render(idRef.current, cleaned)
        .then((res: any) => {
          if (!canceled) setSvg(res.svg);
        })
        .catch((err: unknown) => {
          console.error("Mermaid render error:", err);
          if (!canceled)
            setSvg(
              `<pre class=\"bg-muted text-foreground p-3 rounded border border-border overflow-auto text-xs\">${escapeHtml(
                cleaned
              )}</pre>`
            );
        });
    } catch (e) {
      console.error("Mermaid initialize/render threw:", e);
      if (!canceled)
        setSvg(
          `<pre class=\"bg-muted text-foreground p-3 rounded border border-border overflow-auto text-xs\">${escapeHtml(
            cleaned
          )}</pre>`
        );
    }
    return () => {
      canceled = true;
    };
  }, [cleaned, theme, systemDark]);

  return (
    <div className="my-3">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
