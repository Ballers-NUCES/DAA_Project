import type { ReactNode } from "react"
import { PlayIcon } from "lucide-react"
import { DatasetDisclosure } from "@/components/dataset-disclosure"
import { FilePicker } from "@/components/file-picker"
import { ResultPanel } from "@/components/result-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import type { DatasetRow } from "@/data/datasets"
import type { WorkflowStatus } from "@/types/workflow"

interface AlgorithmPanelProps {
  id: string
  badge: string
  subtitle: string
  title: string
  description: string
  complexity: string
  actionLabel: string
  idleDescription: string
  datasets: DatasetRow[]
  datasetTitle: string
  datasetDescription: string
  fileHint: string
  file: string | null
  status: WorkflowStatus
  error: string | null
  onFileChange: (file: string | null) => void
  onRun: () => void
  children: ReactNode
}

export function AlgorithmPanel({
  id,
  badge,
  subtitle,
  title,
  description,
  complexity,
  actionLabel,
  idleDescription,
  datasets,
  datasetTitle,
  datasetDescription,
  fileHint,
  file,
  status,
  error,
  onFileChange,
  onRun,
  children,
}: AlgorithmPanelProps) {
  const running = status === "running"

  return (
    <div className="space-y-5">
      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="border-b bg-muted/20 py-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-medium">
              {badge}
            </Badge>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          </div>
          <CardTitle>
            <h2 className="text-lg tracking-tight text-balance">{title}</h2>
          </CardTitle>
          <CardDescription className="max-w-2xl leading-relaxed text-pretty">
            {description}
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="h-6 font-mono text-[11px]">
              {complexity}
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="py-6">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              onRun()
            }}
          >
            <FilePicker
              id={`${id}-file`}
              file={file}
              fileHint={fileHint}
              disabled={running}
              onFileChange={onFileChange}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                size="lg"
                className="h-10 px-5"
                disabled={!file || running}
              >
                {running ? <Spinner /> : <PlayIcon aria-hidden="true" />}
                {running ? "Running…" : actionLabel}
              </Button>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                Small inputs include a trace. Large inputs return the result and running time.
              </p>
            </div>
          </form>

          <Separator className="my-6" />

          <ResultPanel status={status} error={error} idleDescription={idleDescription}>
            {children}
          </ResultPanel>
        </CardContent>
      </Card>

      <DatasetDisclosure title={datasetTitle} description={datasetDescription} rows={datasets} />
    </div>
  )
}
