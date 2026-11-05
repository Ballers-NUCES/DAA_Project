const integerFormatter = new Intl.NumberFormat()
const decimalFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 break-all font-mono text-sm font-medium tabular-nums">
        {value}
      </dd>
    </div>
  )
}

export function formatDuration(micros: number) {
  if (micros < 1_000) return `${integerFormatter.format(micros)}\u00a0µs`
  if (micros < 1_000_000) return `${decimalFormatter.format(micros / 1_000)}\u00a0ms`
  return `${decimalFormatter.format(micros / 1_000_000)}\u00a0s`
}
