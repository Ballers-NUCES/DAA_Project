import { FilesIcon, FolderOpenIcon, PlayIcon } from "lucide-react"
import { DatasetDisclosure } from "@/components/dataset-disclosure"
import { FilesPicker } from "@/components/file-picker"
import { MultiplicationBatchResultView } from "@/components/multiplication-batch-results"
import { ResultPanel } from "@/components/result-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { multiplicationDatasets } from "@/data/datasets"
import type { useMultiplicationWorkflow } from "@/hooks/use-multiplication-workflow"
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
    canRun,
    selectSourceMode,
    updateDirectory,
    selectFiles,
    run,
  } = workflow
  const running = status === "running"
  const runLabel = sourceMode === "folder"
    ? "Run All 10 Datasets"
    : files.length === 1
      ? "Run Selected File"
      : `Run ${files.length} Files`

  return (
    <div className="space-y-5">
      <Card className="gap-0 py-0 shadow-sm">
        <CardHeader className="border-b bg-muted/20 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-medium">Karatsuba batch</Badge>
                <span className="text-xs text-muted-foreground">Generated folder by default</span>
              </div>
              <CardTitle>
                <h2 className="text-lg tracking-tight text-balance">Integer multiplication</h2>
              </CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl leading-relaxed text-pretty">
                Multiply non-negative integers using Karatsuba recursion, then inspect each product and running time.
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-6 shrink-0 font-mono text-[11px]">
              O(n¹·⁵⁸⁵)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="py-6">
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              void run()
            }}
          >
            <div>
              <span className="mb-2 block text-sm font-medium" id="karatsuba-source-label">
                Input source
              </span>
              <div
                className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1 sm:max-w-md"
                role="group"
                aria-labelledby="karatsuba-source-label"
              >
                <Button
                  type="button"
                  variant={sourceMode === "folder" ? "secondary" : "ghost"}
                  className="h-9"
                  aria-pressed={sourceMode === "folder"}
                  disabled={running}
                  onClick={() => selectSourceMode("folder")}
                >
                  <FolderOpenIcon aria-hidden="true" />
                  Generated Folder
                </Button>
                <Button
                  type="button"
                  variant={sourceMode === "files" ? "secondary" : "ghost"}
                  className="h-9"
                  aria-pressed={sourceMode === "files"}
                  disabled={running}
                  onClick={() => selectSourceMode("files")}
                >
                  <FilesIcon aria-hidden="true" />
                  Choose Files
                </Button>
              </div>
            </div>

            {sourceMode === "folder" ? (
              <Field>
                <FieldLabel htmlFor="karatsuba-directory">Karatsuba dataset folder</FieldLabel>
                <InputGroup className="h-11 bg-background">
                  <InputGroupInput
                    id="karatsuba-directory"
                    name="karatsuba-directory"
                    value={directory}
                    onChange={(event) => updateDirectory(event.target.value)}
                    placeholder="Generate datasets or enter an absolute folder path…"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={running}
                    aria-describedby="karatsuba-directory-description"
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
                        const selected = await pickFolder(directory)
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
            idleDescription={sourceMode === "folder"
              ? "Run the generated collection to compare all 10 datasets, or choose your own files."
              : "Choose one or more files and run Karatsuba to see their products and running times."}
            runningTitle="Karatsuba batch in progress"
            runningDescription={sourceMode === "folder"
              ? "Multiplying im01 through im10. Each file updates in the batch report as it finishes."
              : `Processing ${files.length} selected ${files.length === 1 ? "file" : "files"}. Each file updates in the batch report as it finishes.`}
          >
            {result && <MultiplicationBatchResultView batch={result} running={running} />}
          </ResultPanel>
        </CardContent>
      </Card>

      <DatasetDisclosure
        title="Multiplication datasets"
        description="Operand sizes and edge cases for im01–im10. Generated files live in the karatsuba folder."
        rows={multiplicationDatasets}
      />
    </div>
  )
}
