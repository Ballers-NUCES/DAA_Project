import { useRef } from "react"
import { FilesIcon, FolderOpenIcon, PlayIcon } from "lucide-react"
import { DatasetDisclosure } from "@/components/dataset-disclosure"
import { FilesPicker } from "@/components/file-picker"
import { MultiplicationBatchResultView } from "@/components/multiplication-batch-results"
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
import { multiplicationDatasets } from "@/data/datasets"
import type {
  MultiplicationSourceMode,
  useMultiplicationWorkflow,
} from "@/hooks/use-multiplication-workflow"
import { pickFolder } from "@/lib/backend"

interface MultiplicationPanelProps {
  workflow: ReturnType<typeof useMultiplicationWorkflow>
}

export function MultiplicationPanel({ workflow }: MultiplicationPanelProps) {
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
              Karatsuba Batch
            </Badge>
            <span className="text-xs text-muted-foreground">Generated Folder by Default</span>
          </div>
          <CardTitle>
            <h2 className="text-lg tracking-tight text-balance">Integer Multiplication</h2>
          </CardTitle>
          <CardDescription className="max-w-2xl leading-relaxed text-pretty">
            Multiply non-negative integers using Karatsuba recursion, then inspect each product and running time.
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="h-6 font-mono text-[11px]">
              O(n¹·⁵⁸⁵)
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
            <Field>
              <FieldTitle id="karatsuba-source-label">Input Source</FieldTitle>
              <ToggleGroup
                value={[sourceMode]}
                onValueChange={(values) => {
                  const next = values[0] as MultiplicationSourceMode | undefined
                  if (next) selectSourceMode(next)
                }}
                aria-labelledby="karatsuba-source-label"
                className="grid w-full grid-cols-2 rounded-xl border bg-muted/40 p-1 sm:max-w-md"
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

            {sourceMode === "folder" ? (
              <Field data-invalid={directoryError ? true : undefined}>
                <FieldLabel htmlFor="karatsuba-directory">Karatsuba Dataset Folder</FieldLabel>
                <InputGroup className="h-11 bg-background">
                  <InputGroupInput
                    ref={directoryInputRef}
                    id="karatsuba-directory"
                    name="karatsuba-directory"
                    value={directory}
                    onChange={(event) => updateDirectory(event.target.value)}
                    placeholder="Generate datasets or enter an absolute folder path…"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={running}
                    aria-invalid={directoryError ? true : undefined}
                    aria-describedby={`karatsuba-directory-description${directoryError ? " karatsuba-directory-error" : ""}`}
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
                <FieldDescription id="karatsuba-directory-description" className="text-xs leading-relaxed">
                  Runs <code translate="no">im01.txt</code> through <code translate="no">im10.txt</code> in order. Generating datasets fills this path automatically.
                </FieldDescription>
                {directoryError && <FieldError id="karatsuba-directory-error">{directoryError}</FieldError>}
              </Field>
            ) : (
              <FilesPicker
                id="karatsuba-files"
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
                Small inputs include a trace. Large products stay collapsed and show a bounded preview when opened.
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
                : "Choose one or more files and run Karatsuba to see their products and running times."
            }
            runningTitle="Karatsuba Batch in Progress"
            runningDescription={
              sourceMode === "folder"
                ? "Multiplying im01 through im10. Each file updates in the batch report as it finishes."
                : `Processing ${files.length} selected ${files.length === 1 ? "file" : "files"}. Each file updates in the batch report as it finishes.`
            }
          >
            {result && <MultiplicationBatchResultView batch={result} running={running} />}
          </ResultPanel>
        </CardContent>
      </Card>

      <DatasetDisclosure
        title="Multiplication Datasets"
        description="Operand sizes and edge cases for im01–im10. Generated files live in the karatsuba folder."
        rows={multiplicationDatasets}
      />
    </div>
  )
}
