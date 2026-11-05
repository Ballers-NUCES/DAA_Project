import type { ReactNode } from "react"
import { CircleAlertIcon, Clock3Icon, PlayIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { WorkflowStatus } from "@/types/workflow"

interface ResultPanelProps {
  status: WorkflowStatus
  error: string | null
  idleDescription: string
  runningTitle?: string
  runningDescription?: string
  children: ReactNode
}

export function ResultPanel({
  status,
  error,
  idleDescription,
  runningTitle = "Run in progress",
  runningDescription = "Processing the selected input. Large datasets may take longer.",
  children,
}: ResultPanelProps) {
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status === "running"
          ? `${runningTitle}. ${runningDescription}`
          : status === "success"
            ? "Algorithm completed. Results are available below."
            : ""}
      </p>
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
          <Empty className="border-primary/20 bg-muted/20 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-secondary text-secondary-foreground">
                <Clock3Icon className="size-4" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{runningTitle}</EmptyTitle>
              <EmptyDescription>{runningDescription}</EmptyDescription>
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

        {status === "success" && <div>{children}</div>}
      </section>
    </>
  )
}
