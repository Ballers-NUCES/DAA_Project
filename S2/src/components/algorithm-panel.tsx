import type { ReactNode } from "react"
import { PlayIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { DatasetDisclosure } from "@/components/dataset-disclosure"
import { FilePicker } from "@/components/file-picker"
import { ResultPanel } from "@/components/result-panel"
import type { DatasetRow } from "@/data/datasets"
import type { WorkflowStatus } from "@/types/workflow"

interface AlgorithmPanelProps {
  id: string
  title: string
  description: string
  complexity: string
  actionLabel: string
  idleDescription: string
  datasets: DatasetRow[]
  datasetTitle: string
  datasetDescription: string
  file: File | null
  status: WorkflowStatus
  error: string | null
  onFileChange: (file: File | null) => void
  onRun: () => void
  children: ReactNode
}

export function AlgorithmPanel({
  id,
  title,
  description,
  complexity,
  actionLabel,
  idleDescription,
  datasets,
  datasetTitle,
  datasetDescription,
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
      <Card className="shadow-xs">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle>
                <h2 className="text-lg tracking-tight">{title}</h2>
              </CardTitle>
              <CardDescription className="mt-1.5 leading-relaxed">
                {description}
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-6 shrink-0 font-mono text-[11px]">
              {complexity}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <FilePicker id={`${id}-file`} file={file} disabled={running} onFileChange={onFileChange} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" className="h-10 px-5" disabled={!file || running} onClick={onRun}>
              {running ? <Spinner /> : <PlayIcon />}
              {running ? "Running…" : actionLabel}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Small inputs include a trace. Large inputs return the result and running time.
            </p>
          </div>
          <Separator />
          <ResultPanel status={status} error={error} idleDescription={idleDescription}>
            {children}
          </ResultPanel>
        </CardContent>
      </Card>

      <DatasetDisclosure title={datasetTitle} description={datasetDescription} rows={datasets} />
    </div>
  )
}
