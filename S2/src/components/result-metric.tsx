export function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 break-all font-mono text-sm font-medium">
        {value}
      </dd>
    </div>
  )
}

export function formatDuration(micros: number) {
  if (micros < 1_000) return `${micros.toLocaleString()} µs`
  if (micros < 1_000_000) return `${(micros / 1_000).toFixed(2)} ms`
  return `${(micros / 1_000_000).toFixed(2)} s`
}
