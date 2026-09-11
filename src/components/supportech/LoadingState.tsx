export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return <div className="flex min-h-56 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground"><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />{label}</div>;
}
