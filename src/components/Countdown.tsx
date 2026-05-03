import { useEffect, useState } from "react";
import { countdownParts, pad2 } from "@/lib/format";

export function Countdown({ to, onZero, compact }: { to: string | Date; onZero?: () => void; compact?: boolean }) {
  const [parts, setParts] = useState(() => countdownParts(to));

  useEffect(() => {
    const id = setInterval(() => {
      const p = countdownParts(to);
      setParts(p);
      if (p.total === 0) {
        clearInterval(id);
        onZero?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [to, onZero]);

  if (parts.total === 0) {
    return <span className="text-live font-semibold">LIVE</span>;
  }

  if (compact) {
    return (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {parts.d > 0 && `${pad2(parts.d)}:`}
        {pad2(parts.h)}:{pad2(parts.m)}:{pad2(parts.s)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 font-mono text-sm tabular-nums">
      <Box label="D" value={parts.d} />:<Box label="H" value={parts.h} />:<Box label="M" value={parts.m} />:<Box label="S" value={parts.s} />
    </div>
  );
}

function Box({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex flex-col items-center rounded bg-secondary px-1.5 py-0.5 leading-none">
      <span className="text-foreground">{pad2(value)}</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </span>
  );
}
