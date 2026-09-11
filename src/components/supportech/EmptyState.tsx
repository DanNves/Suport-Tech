import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: { label: string; onClick: () => void }; icon?: ReactNode }) {
  return <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">{icon ?? <Inbox className="h-5 w-5" />}</div>
    <h3 className="text-sm font-semibold">{title}</h3>
    {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
    {action && <Button className="mt-4" onClick={action.onClick}>{action.label}</Button>}
  </div>;
}
