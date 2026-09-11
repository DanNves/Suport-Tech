import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function FilterBar({ searchPlaceholder = "Buscar...", value, onValueChange, children }: { searchPlaceholder?: string; value?: string; onValueChange?: (value: string) => void; children?: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center">
    <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={value} onChange={(event) => onValueChange?.(event.target.value)} placeholder={searchPlaceholder} className="h-10 rounded-xl bg-muted/30 pl-9" /></div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </div>;
}
