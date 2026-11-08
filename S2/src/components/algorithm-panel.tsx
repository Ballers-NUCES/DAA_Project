import { useRef } from "react"
import type { ReactNode } from "react"
import { FilesIcon, FolderOpenIcon, PlayIcon } from "lucide-react"
import { AlgorithmBatchResultView } from "@/components/algorithm-batch-results"
import { DatasetDisclosure } from "@/components/dataset-disclosure"
import { FilesPicker } from "@/components/file-picker"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { DatasetRow } from "@/data/datasets"
import type { AlgorithmWorkflow } from "@/hooks/use-algorithm-workflow"
import { pickFolder } from "@/lib/backend"
import type { AlgorithmResult, AlgorithmSourceMode } from "@/types/workflow"

interface AlgorithmPanelProps<T extends AlgorithmResult> {
  id: string
  badge: string
  subtitle: string
  title: string
  description: string
  complexity: string
  datasets: DatasetRow[]
  datasetTitle: string
  datasetDescription: string
  folderLabel: string
  folderDescription: ReactNode
  extraControls?: ReactNode
  runningTitle: string
  runningFolderDescription: string
  batchRunningTitle: string
  batchSuccessTitle: string
  runHint: string
  workflow: AlgorithmWorkflow<T>
  getFileSubtitle: (result: T) => string
  hasTrace: (result: T) => boolean
  renderResult: (result: T) => ReactNode
}

export function AlgorithmPanel<T extends AlgorithmResult>({
  id,
  badge,
  subtitle,
  title,
  description,
  complexity,
  datasets,
  datasetTitle,
  datasetDescription,
  folderLabel,
  folderDescription,
  extraControls,
  runningTitle,
  runningFolderDescription,
  batchRunningTitle,
  batchSuccessTitle,
  runHint,
  workflow,
  getFileSubtitle,
  hasTrace,
  renderResult,
}: AlgorithmPanelProps<T>) {
  const {
    sourceMode,
    directory,
    files,
    status,
    result,
    error,
    directoryError,
    canRun,
    selectSourceMode,
    updateDirectory,
    selectFiles,
    run,
  } = workflow
  const directoryInputRef = useRef<HTMLInputElement>(null)
  const running = status === "running"
  const runLabel =
    sourceMode === "folder"
      ? "Run All 10 Datasets"
      : files.length === 0
        ? "Run Selected Files"
        : files.length === 1
          ? "Run Selected File"
          : `Run ${files.length} Selected Files`

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
              void run().then((invalidField) => {
                if (invalidField === "directory") {
                  directoryInputRef.current?.focus()
                }
              })
            }}
          >
            <div
              className={
                extraControls
                  ? "grid gap-4 sm:grid-cols-2 sm:items-start"
                  : undefined
              }
            >
              <Field>
                <FieldTitle id={`${id}-source-label`}>Input Source</FieldTitle>
                <ToggleGroup
                  value={[sourceMode]}
                  onValueChange={(values) => {
                    const next = values[0] as AlgorithmSourceMode | undefined
                    if (next) selectSourceMode(next)
                  }}
                  aria-labelledby={`${id}-source-label`}
                  className={
                    extraControls
                      ? "grid w-full grid-cols-2 rounded-xl border bg-muted/40 p-1"
                      : "grid w-full grid-cols-2 rounded-xl border bg-muted/40 p-1 sm:max-w-md"
                  }
                >
                  <ToggleGroupItem
                    value="folder"
                    disabled={running}
                    className="h-9 gap-2 rounded-lg data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs"
                  >
                    <FolderOpenIcon aria-hidden="true" />
                    Generated Folder
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="files"
                    disabled={running}
                    className="h-9 gap-2 rounded-lg data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs"
                  >
                    <FilesIcon aria-hidden="true" />
                    Choose Files
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {extraControls}
            </div>

            {sourceMode === "folder" ? (
              <Field data-invalid={directoryError ? true : undefined}>
                <FieldLabel htmlFor={`${id}-directory`}>{folderLabel}</FieldLabel>
                <InputGroup className="h-11 bg-background">
                  <InputGroupInput
                    ref={directoryInputRef}
                    id={`${id}-directory`}
                    name={`${id}-directory`}
                    value={directory}
                    onChange={(event) => updateDirectory(event.target.value)}
                    placeholder="Generate datasets or enter an absolute folder path…"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={running}
                    aria-invalid={directoryError ? true : undefined}
                    aria-describedby={`${id}-directory-description${directoryError ? ` ${id}-directory-error` : ""}`}
                  />
                  <InputGroupAddon align="inline-start">
                    <FolderOpenIcon className="size-4" aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="sm"
                      variant="secondary"
                      disabled={running}
                      onClick={async () => {
                        const selected = await pickFolder(directory).catch(() => null)
                        if (selected) updateDirectory(selected)
                      }}
                    >
                      <FolderOpenIcon aria-hidden="true" />
                      Browse
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription id={`${id}-directory-description`} className="text-xs leading-relaxed">
                  {folderDescription}
                </FieldDescription>
                {directoryError && <FieldError id={`${id}-directory-error`}>{directoryError}</FieldError>}
              </Field>
            ) : (
              <FilesPicker
                id={`${id}-files`}
                files={files}
                disabled={running}
                onFilesChange={selectFiles}
              />
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                size="lg"
                className="h-10 px-5"
                disabled={!canRun || running}
              >
                {running ? <Spinner /> : <PlayIcon aria-hidden="true" />}
                {running ? "Running Batch…" : runLabel}
              </Button>
              <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
                {runHint}
              </p>
            </div>
          </form>

          <Separator className="my-6" />

          <ResultPanel
            status={status}
            error={error}
            idleDescription={
              sourceMode === "folder"
                ? "Run the generated collection to compare all 10 datasets, or choose your own files."
                : "Choose one or more files to inspect their results and running times."
            }
            runningTitle={runningTitle}
            runningDescription={
              sourceMode === "folder"
                ? runningFolderDescription
                : `Processing ${files.length} selected ${files.length === 1 ? "file" : "files"}. Each file updates in the batch report as it finishes.`
            }
          >
            {result && (
              <AlgorithmBatchResultView
                batch={result}
                running={running}
                runningTitle={batchRunningTitle}
                successTitle={batchSuccessTitle}
                getFileSubtitle={getFileSubtitle}
                hasTrace={hasTrace}
                renderResult={renderResult}
              />
            )}
          </ResultPanel>
        </CardContent>
      </Card>

      <DatasetDisclosure title={datasetTitle} description={datasetDescription} rows={datasets} />
    </div>
  )
}
