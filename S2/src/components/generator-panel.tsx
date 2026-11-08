import { useRef } from "react"
import {
  CalculatorIcon,
  CheckCircle2Icon,
  CrosshairIcon,
  DatabaseIcon,
  FolderOpenIcon,
  ShuffleIcon,
} from "lucide-react"
import { ResultMetric } from "@/components/result-metric"
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
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import type { useGeneratorWorkflow } from "@/hooks/use-generator-workflow"
import { pickFolder } from "@/lib/backend"

interface GeneratorPanelProps {
  workflow: ReturnType<typeof useGeneratorWorkflow>
}

export function GeneratorPanel({ workflow }: GeneratorPanelProps) {
  const {
    baseSeed,
    outputDirectory,
    status,
    result,
    error,
    seedError,
    directoryError,
    updateBaseSeed,
    updateOutputDirectory,
    generate,
  } = workflow
  const directoryInputRef = useRef<HTMLInputElement>(null)
  const seedInputRef = useRef<HTMLInputElement>(null)
  const running = status === "running"

  const randomizeSeed = () => {
    const buffer = new Uint32Array(2)
    crypto.getRandomValues(buffer)
    const nextSeed = (BigInt(buffer[0]) << 32n) | BigInt(buffer[1])
    updateBaseSeed(nextSeed.toString())
  }

  return (
    <div className="space-y-5">
      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="border-b bg-muted/20 py-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-medium">
              SplitMix64 PRNG
            </Badge>
            <span className="text-xs text-muted-foreground">Deterministic Seed Manifest</span>
          </div>
          <CardTitle>
            <h2 className="text-lg tracking-tight text-balance">Dataset Generator</h2>
          </CardTitle>
          <CardDescription className="max-w-2xl leading-relaxed text-pretty">
            Generate all 20 benchmark datasets and record their exact per-file seeds in a JSON manifest.
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="h-6 font-mono text-[11px]">
              20 Files
            </Badge>
          </CardAction>
        </CardHeader>

        <CardContent className="py-6">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void generate().then((firstInvalidField) => {
                if (firstInvalidField === "directory") {
                  directoryInputRef.current?.focus()
                } else if (firstInvalidField === "seed") {
                  seedInputRef.current?.focus()
                }
              })
            }}
          >
            <FieldGroup>
              <Field data-invalid={directoryError ? true : undefined}>
                <FieldLabel htmlFor="output-directory">Output Directory</FieldLabel>
                <InputGroup className="h-11 bg-background">
                  <InputGroupInput
                    ref={directoryInputRef}
                    id="output-directory"
                    name="output-directory"
                    autoComplete="off"
                    spellCheck={false}
                    value={outputDirectory}
                    onChange={(event) => updateOutputDirectory(event.target.value)}
                    placeholder="C:\Users\You\Desktop\datasets"
                    aria-invalid={directoryError ? true : undefined}
                    aria-describedby={`output-directory-description${directoryError ? " output-directory-error" : ""}`}
                    disabled={running}
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
                      const selected = await pickFolder(outputDirectory).catch(() => null)
                      if (selected) updateOutputDirectory(selected)
                    }}
                    >
                      <FolderOpenIcon aria-hidden="true" />
                      Browse
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription id="output-directory-description" className="text-xs">
                  Absolute path where the dataset files and seed manifest will be saved.
                </FieldDescription>
                {directoryError && <FieldError id="output-directory-error">{directoryError}</FieldError>}
              </Field>

              <Field data-invalid={seedError ? true : undefined}>
                <FieldLabel htmlFor="base-seed">Base Seed</FieldLabel>
                <InputGroup className="h-11 bg-background">
                  <InputGroupInput
                    ref={seedInputRef}
                    id="base-seed"
                    name="base-seed"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    value={baseSeed}
                    onChange={(event) => updateBaseSeed(event.target.value)}
                    aria-invalid={seedError ? true : undefined}
                    aria-describedby={`base-seed-description${seedError ? " base-seed-error" : ""}`}
                    disabled={running}
                    className="font-mono"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="sm"
                      variant="secondary"
                      disabled={running}
                      onClick={randomizeSeed}
                      aria-label="Generate Random 64-Bit Seed"
                    >
                      <ShuffleIcon aria-hidden="true" />
                      Randomize
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription id="base-seed-description" className="text-xs">
                  Unsigned 64-bit integer from 0 to 18,446,744,073,709,551,615 for reproducible files.
                </FieldDescription>
                {seedError && <FieldError id="base-seed-error">{seedError}</FieldError>}
              </Field>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button type="submit" size="lg" className="h-10 px-5" disabled={running}>
                  {running ? <Spinner /> : <DatabaseIcon aria-hidden="true" />}
                  {running ? "Generating…" : "Generate All Datasets"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Writes 10 closest-pair and 10 multiplication files with their seed manifest.
                </p>
              </div>
            </FieldGroup>
          </form>

          <Separator className="my-6" />

          <ResultPanel
            status={status}
            error={error}
            idleDescription="Choose an output directory and base seed to generate all 20 datasets and their seed manifest."
            runningTitle="Generating Dataset Collection"
            runningDescription="Writing 20 files and recording their seeds. Million-element files may take a moment."
          >
            {result && (
              <section
                className="rounded-xl border bg-muted/20 p-4 sm:p-5"
                aria-labelledby="generation-summary-title"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                    <CheckCircle2Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                      Generation Report
                    </p>
                    <h3 id="generation-summary-title" className="mt-1 text-base font-semibold">
                      {result.filesGenerated} Datasets Generated
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Both the Closest-Pair and Karatsuba batch directories have been linked automatically for immediate execution.
                    </p>
                  </div>
                </div>

                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ResultMetric label="Output Directory" value={result.outputDirectory} />
                  <ResultMetric label="Seed Manifest" value={result.manifestPath} />
                  <ResultMetric label="Karatsuba Folder" value={result.karatsubaDirectory} />
                  <ResultMetric label="Closest-Pair Folder" value={result.closestPairDirectory} />
                </dl>
              </section>
            )}
          </ResultPanel>
        </CardContent>
      </Card>

      <ItemGroup className="grid gap-3 sm:grid-cols-2">
        <Item variant="outline" role="listitem" className="rounded-xl bg-card">
          <ItemMedia variant="icon" className="size-10 rounded-xl bg-accent text-accent-foreground">
            <CrosshairIcon className="size-5" aria-hidden="true" />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>Closest-Pair Inputs</ItemTitle>
            <ItemDescription className="line-clamp-none text-xs">
              Uniform, clustered, duplicate, vertical, grid, split-line, and trace cases.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="secondary">10 Files</Badge>
          </ItemActions>
        </Item>
        <Item variant="outline" role="listitem" className="rounded-xl bg-card">
          <ItemMedia variant="icon" className="size-10 rounded-xl bg-accent text-accent-foreground">
            <CalculatorIcon className="size-5" aria-hidden="true" />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>Multiplication Inputs</ItemTitle>
            <ItemDescription className="line-clamp-none text-xs">
              Random, unbalanced, all-9s, zeros, powers-of-10, and trace cases.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="secondary">10 Files</Badge>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  )
}
