import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleAlertIcon,
  FileTextIcon,
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

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="rounded-xl border bg-card transition-colors hover:border-ring/40 [content-visibility:auto] [contain-intrinsic-size:auto_76px]"
    >
      <h4>
        <CollapsibleTrigger className="group flex w-full flex-wrap items-center gap-3 rounded-xl px-4 py-3.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring sm:flex-nowrap">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${result ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {result
              ? <FileTextIcon className="size-4" aria-hidden="true" />
              : <CircleAlertIcon className="size-4" aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-mono text-sm font-medium" translate="no">
                {file.fileName}
              </span>
              {result?.trace && result.trace.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">Trace</Badge>
              )}
              {!result && <Badge variant="destructive" className="text-[10px]">Failed</Badge>}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
              {result
                ? `${numberFormatter.format(result.leftDigits)} × ${numberFormatter.format(result.rightDigits)} digits`
                : "Open to view the error"}
            </span>
          </span>
          {result && (
            <span className="ml-auto text-right sm:ml-0">
              <span className="block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Time
              </span>
              <span className="mt-0.5 block font-mono text-xs font-medium tabular-nums">
                {formatDuration(result.elapsedMicros)}
              </span>
            </span>
          )}
          <ChevronDownIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-180"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
      </h4>

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
    </Collapsible>
  )
}

export function MultiplicationBatchResultView({ batch }: { batch: MultiplicationBatchResult }) {
  const allSucceeded = batch.failed === 0

  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-muted/20 p-4 sm:p-5" aria-labelledby="batch-summary-title">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${allSucceeded ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {allSucceeded
              ? <CheckCircle2Icon className="size-5" aria-hidden="true" />
              : <CircleAlertIcon className="size-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Batch report
            </p>
            <h3 id="batch-summary-title" className="mt-1 text-base font-semibold text-balance">
              {allSucceeded ? "All multiplications complete" : "Batch complete with errors"}
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
          <ResultMetric label="Files processed" value={numberFormatter.format(batch.totalFiles)} />
          <ResultMetric label="Successful" value={numberFormatter.format(batch.succeeded)} />
          <ResultMetric label="Total algorithm time" value={formatDuration(batch.totalElapsedMicros)} />
        </dl>
      </section>

      <section aria-labelledby="dataset-results-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="dataset-results-title" className="text-sm font-medium">Dataset results</h3>
          <span className="text-xs text-muted-foreground">Open a file to inspect its product</span>
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
