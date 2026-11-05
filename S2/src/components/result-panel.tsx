import type { ReactNode } from "react"
import { CircleAlertIcon, PlayIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { WorkflowStatus } from "@/types/workflow"

interface ResultPanelProps {
  status: WorkflowStatus
  error: string | null
  idleDescription: string
  children: ReactNode
}

export function ResultPanel({ status, error, idleDescription, children }: ResultPanelProps) {
  return (
    <section aria-label="Algorithm results" aria-busy={status === "running"}>
      {status === "idle" && (
        <Empty className="border bg-muted/20 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlayIcon className="size-4" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No run yet</EmptyTitle>
            <EmptyDescription>{idleDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {status === "running" && (
        <Empty className="border bg-muted/20 py-8" role="status">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Spinner />
            </EmptyMedia>
            <EmptyTitle>Running algorithm</EmptyTitle>
            <EmptyDescription>
              Processing the selected input file. Large datasets may take longer.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {status === "error" && (
        <Alert variant="destructive">
          <CircleAlertIcon className="size-4" aria-hidden="true" />
          <AlertTitle>Unable to complete the run</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {status === "success" && (
        <div>
          <p className="sr-only" role="status">
            Algorithm completed. Results are available below.
          </p>
          {children}
        </div>
      )}
    </section>
  )
}
