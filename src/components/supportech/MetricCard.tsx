import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({ label, value, detail, icon, trend, className }: { label: string; value: string | number; detail?: string; icon?: ReactNode; trend?: "positive" | "negative" | "neutral"; className?: string }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>{detail && <p className={cn("mt-1 text-xs", trend === "positive" ? "text-emerald-600" : trend === "negative" ? "text-red-600" : "text-muted-foreground")}>{detail}</p>}</div>
      {icon && <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">{icon}</div>}
    </div>
  </div>;
}
