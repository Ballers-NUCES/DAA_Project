import { useId } from "react"
import type { ReactNode } from "react"
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleAlertIcon,
  Clock3Icon,
} from "lucide-react"
import { formatDuration, ResultMetric } from "@/components/result-metric"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import type { AlgorithmBatchResult, AlgorithmFileResult, AlgorithmResult } from "@/types/workflow"

const numberFormatter = new Intl.NumberFormat()

interface AlgorithmFileRecordProps<T extends AlgorithmResult> {
  file: AlgorithmFileResult<T>
  defaultOpen: boolean
  getFileSubtitle: (result: T) => string
  hasTrace: (result: T) => boolean
  renderResult: (result: T) => ReactNode
}

function AlgorithmFileRecord<T extends AlgorithmResult>({
  file,
  defaultOpen,
  getFileSubtitle,
  hasTrace,
  renderResult,
}: AlgorithmFileRecordProps<T>) {
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
    ? "Processing input…"
    : isPending
      ? "Queued in batch"
      : result
        ? getFileSubtitle(result)
        : "Open to view the error"

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      disabled={!isCompleted}
      className="rounded-xl border bg-card transition-colors hover:border-ring/40 data-disabled:opacity-75 [content-visibility:auto] [contain-intrinsic-size:auto_76px]"
    >
      <h4>
        <CollapsibleTrigger className="group flex w-full flex-wrap items-center gap-3 rounded-xl px-4 py-3.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-default sm:flex-nowrap">
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
              {isCompleted && result && hasTrace(result) && (
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
              renderResult(result)
            ) : (
              <Alert variant="destructive">
                <CircleAlertIcon className="size-4" aria-hidden="true" />
                <AlertTitle>{file.fileName} Could Not Be Processed</AlertTitle>
                <AlertDescription>{file.error ?? "The file did not produce a result."}</AlertDescription>
              </Alert>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

interface AlgorithmBatchResultViewProps<T extends AlgorithmResult> {
  batch: AlgorithmBatchResult<T>
  running?: boolean
  runningTitle: string
  successTitle: string
  getFileSubtitle: (result: T) => string
  hasTrace: (result: T) => boolean
  renderResult: (result: T) => ReactNode
}

export function AlgorithmBatchResultView<T extends AlgorithmResult>({
  batch,
  running = false,
  runningTitle,
  successTitle,
  getFileSubtitle,
  hasTrace,
  renderResult,
}: AlgorithmBatchResultViewProps<T>) {
  const summaryId = useId()
  const resultsId = useId()
  const allSucceeded = batch.failed === 0
  const completedCount = batch.succeeded + batch.failed
  const progressValue =
    batch.totalFiles > 0 ? Math.round((completedCount / batch.totalFiles) * 100) : 0

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-muted/20 p-4 sm:p-5" aria-labelledby={summaryId}>
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
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Batch Report
            </p>
            <h3 id={summaryId} className="mt-1 text-base font-semibold text-balance">
              {running
                ? `${runningTitle} (${numberFormatter.format(completedCount)} of ${numberFormatter.format(batch.totalFiles)})`
                : allSucceeded
                  ? successTitle
                  : "Batch Complete with Errors"}
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

        <Progress
          value={progressValue}
          aria-label="Batch Progress"
          className="mt-4"
        />

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <ResultMetric
            label="Files Processed"
            value={
              running
                ? `${numberFormatter.format(completedCount)} / ${numberFormatter.format(batch.totalFiles)}`
                : numberFormatter.format(batch.totalFiles)
            }
          />
          <ResultMetric label="Successful" value={numberFormatter.format(batch.succeeded)} />
          <ResultMetric label="Total Algorithm Time" value={formatDuration(batch.totalElapsedMicros)} />
        </dl>
      </section>

      <section aria-labelledby={resultsId}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id={resultsId} className="text-sm font-medium">Dataset Results</h3>
          <span className="text-xs text-muted-foreground">Open a completed file to inspect its result</span>
        </div>
        {batch.files.length > 0 ? (
          <div className="space-y-2.5">
            {batch.files.map((file) => (
              <AlgorithmFileRecord
                key={file.fileName}
                file={file}
                defaultOpen={batch.totalFiles === 1}
                getFileSubtitle={getFileSubtitle}
                hasTrace={hasTrace}
                renderResult={renderResult}
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
