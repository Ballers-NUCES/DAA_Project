import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleAlertIcon,
  Clock3Icon,
} from "lucide-react"
import { MultiplicationResultView } from "@/components/algorithm-results"
import { formatDuration, ResultMetric } from "@/components/result-metric"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Spinner } from "@/components/ui/spinner"
import type {
  AlgorithmFileResult,
  MultiplicationBatchResult,
  MultiplicationResult,
} from "@/types/workflow"

const numberFormatter = new Intl.NumberFormat()

function MultiplicationFileRecord({
  file,
  defaultOpen,
}: {
  file: AlgorithmFileResult<MultiplicationResult>
  defaultOpen: boolean
}) {
  const result = file.result
  const fileStatus = file.status ?? "completed"
  const isRunning = fileStatus === "running"
  const isPending = fileStatus === "pending"
  const isCompleted = fileStatus === "completed"

  const iconContainerClass = isRunning
    ? "bg-primary/10 text-primary"
    : isPending
      ? "bg-muted text-muted-foreground"
      : result
        ? "bg-success/10 text-success"
        : "bg-destructive/10 text-destructive"

  const subtitle = isRunning
    ? "Multiplying operands…"
    : isPending
      ? "Queued in batch"
      : result
        ? `${numberFormatter.format(result.leftDigits)} × ${numberFormatter.format(result.rightDigits)} digits`
        : "Open to view the error"

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      disabled={!isCompleted}
      className="rounded-xl border bg-card transition-colors hover:border-ring/40 data-disabled:opacity-75 [content-visibility:auto] [contain-intrinsic-size:auto_76px]"
    >
      <h4>
        <CollapsibleTrigger className="group flex w-full flex-wrap items-center gap-3 rounded-xl px-4 py-3.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring data-disabled:cursor-default sm:flex-nowrap">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${iconContainerClass}`}>
            {isRunning ? (
              <Spinner className="size-4" />
            ) : isPending ? (
              <Clock3Icon className="size-4" aria-hidden="true" />
            ) : result ? (
              <CheckCircle2Icon className="size-4" aria-hidden="true" />
            ) : (
              <CircleAlertIcon className="size-4" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-mono text-sm font-medium" translate="no">
                {file.fileName}
              </span>
              {isRunning && (
                <Badge variant="secondary" className="text-[10px]">Running</Badge>
              )}
              {isCompleted && result?.trace && result.trace.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">Trace</Badge>
              )}
              {isCompleted && !result && (
                <Badge variant="destructive" className="text-[10px]">Failed</Badge>
              )}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
              {subtitle}
            </span>
          </span>
          {isCompleted && result && (
            <span className="ml-auto text-right sm:ml-0">
              <span className="block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Time
              </span>
              <span className="mt-0.5 block font-mono text-xs font-medium tabular-nums">
                {formatDuration(result.elapsedMicros)}
              </span>
            </span>
          )}
          {isCompleted && (
            <ChevronDownIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-180"
              aria-hidden="true"
            />
          )}
        </CollapsibleTrigger>
      </h4>

      {isCompleted && (
        <CollapsibleContent>
          <div className="border-t px-4 py-5 sm:px-5">
            {result ? (
              <MultiplicationResultView result={result} showMetrics={false} />
            ) : (
              <Alert variant="destructive">
                <CircleAlertIcon className="size-4" aria-hidden="true" />
                <AlertTitle>{file.fileName} could not be multiplied</AlertTitle>
                <AlertDescription>{file.error ?? "The file did not produce a result."}</AlertDescription>
              </Alert>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

export function MultiplicationBatchResultView({
  batch,
  running = false,
}: {
  batch: MultiplicationBatchResult
  running?: boolean
}) {
  const allSucceeded = batch.failed === 0
  const completedCount = batch.succeeded + batch.failed

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-muted/20 p-4 sm:p-5" aria-labelledby="batch-summary-title">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
              running
                ? "bg-primary/10 text-primary"
                : allSucceeded
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
            }`}
          >
            {running ? (
              <Spinner className="size-5" />
            ) : allSucceeded ? (
              <CheckCircle2Icon className="size-5" aria-hidden="true" />
            ) : (
              <CircleAlertIcon className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Batch report
            </p>
            <h3 id="batch-summary-title" className="mt-1 text-base font-semibold text-balance">
              {running
                ? `Running multiplications (${numberFormatter.format(completedCount)} of ${numberFormatter.format(batch.totalFiles)})`
                : allSucceeded
                  ? "All multiplications complete"
                  : "Batch complete with errors"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {numberFormatter.format(batch.succeeded)} succeeded
              {batch.failed > 0 && ` · ${numberFormatter.format(batch.failed)} failed`}
            </p>
            <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-muted-foreground" translate="no">
              {batch.source}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <ResultMetric
            label="Files processed"
            value={
              running
                ? `${numberFormatter.format(completedCount)} / ${numberFormatter.format(batch.totalFiles)}`
                : numberFormatter.format(batch.totalFiles)
            }
          />
          <ResultMetric label="Successful" value={numberFormatter.format(batch.succeeded)} />
          <ResultMetric label="Total algorithm time" value={formatDuration(batch.totalElapsedMicros)} />
        </dl>
      </section>

      <section aria-labelledby="dataset-results-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="dataset-results-title" className="text-sm font-medium">Dataset results</h3>
          <span className="text-xs text-muted-foreground">Open a completed file to inspect its product</span>
        </div>
        {batch.files.length > 0 ? (
          <div className="space-y-2.5">
            {batch.files.map((file) => (
              <MultiplicationFileRecord
                key={file.fileName}
                file={file}
                defaultOpen={batch.totalFiles === 1}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            No files were included in this batch.
          </p>
        )}
      </section>
    </div>
  )
}
