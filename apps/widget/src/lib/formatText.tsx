import type { ReactNode } from "react";

/** Minimal formatter for the small subset of markdown the model tends to use
 * (bold, dash bullets, line breaks) — intentionally not a full markdown parser. */
function renderInline(line: string, keyPrefix: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

export function formatMessageText(text: string): ReactNode {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trimStart();
        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
        const content = isBullet ? trimmed.slice(2) : line;
        return (
          <div key={i} style={isBullet ? { paddingLeft: 14, position: "relative" } : undefined}>
            {isBullet && <span style={{ position: "absolute", left: 0 }}>•</span>}
            {renderInline(content, `l${i}`)}
          </div>
        );
      })}
    </>
  );
}
