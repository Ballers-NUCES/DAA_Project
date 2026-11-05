import { useRef } from "react"
import {
  CalculatorIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  CrosshairIcon,
  DatabaseIcon,
  FolderOpenIcon,
  InfoIcon,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
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

  return (
    <div className="space-y-5">
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg tracking-tight">Dataset generator</h2>
          </CardTitle>
          <CardDescription className="mt-1.5 leading-relaxed">
            Generate all 20 assignment datasets and their seed manifest.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <FieldLabel htmlFor="output-directory">Output directory</FieldLabel>
                <InputGroup className="h-11 bg-background">
                  <InputGroupInput
                    ref={directoryInputRef}
                    id="output-directory"
                    name="output-directory"
                    autoComplete="off"
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
                </InputGroup>
                <FieldDescription id="output-directory-description" className="text-xs">
                  Absolute path where the dataset files and seed manifest will be saved.
                </FieldDescription>
                {directoryError && <FieldError id="output-directory-error">{directoryError}</FieldError>}
              </Field>

              <Field data-invalid={seedError ? true : undefined}>
                <FieldLabel htmlFor="base-seed">Base seed</FieldLabel>
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
                  />
                </InputGroup>
                <FieldDescription id="base-seed-description" className="text-xs">
                  A whole number from 0 to 18,446,744,073,709,551,615 for reproducible files.
                </FieldDescription>
                {seedError && <FieldError id="base-seed-error">{seedError}</FieldError>}
              </Field>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button type="submit" size="lg" className="h-10 px-5" disabled={running}>
                  {running ? <Spinner /> : <DatabaseIcon aria-hidden="true" />}
                  {running ? "Generating…" : "Generate all datasets"}
                </Button>
                <p className="text-xs text-muted-foreground">10 closest-pair + 10 multiplication files</p>
              </div>
            </FieldGroup>
          </form>

          <Separator className="my-6" />

          <div aria-busy={running}>
            {status === "error" && (
              <Alert variant="destructive">
                <CircleAlertIcon className="size-4" aria-hidden="true" />
                <AlertTitle>Unable to generate datasets</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {status === "success" && result && (
              <Alert role="status">
                <CheckCircle2Icon className="size-4 text-success" aria-hidden="true" />
                <AlertTitle>{result.filesGenerated} files generated</AlertTitle>
                <AlertDescription>
                  <span className="block">
                    Output directory:{" "}
                    <code className="break-all font-mono text-xs">{result.outputDirectory}</code>
                  </span>
                  <span className="mt-1 block">
                    Manifest: <code className="break-all font-mono text-xs">{result.manifestPath}</code>
                  </span>
                </AlertDescription>
              </Alert>
            )}
            {status === "idle" && (
              <div
                className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground"
                role="status"
              >
                <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>The generator writes every dataset and records the seed used for each file.</p>
              </div>
            )}
            {running && (
              <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-4 text-sm" role="status">
                <Spinner />
                Generating datasets and recording their seeds…
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ItemGroup className="grid gap-3 sm:grid-cols-2">
        <Item variant="muted" role="listitem" className="rounded-xl bg-card">
          <ItemMedia variant="icon" className="size-10 rounded-xl bg-accent text-accent-foreground">
            <CrosshairIcon className="size-5" aria-hidden="true" />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>Closest-pair inputs</ItemTitle>
            <ItemDescription className="line-clamp-none text-xs">
              Uniform, clustered, duplicate, vertical, grid, split-line, and trace cases.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="secondary">10 files</Badge>
          </ItemActions>
        </Item>
        <Item variant="muted" role="listitem" className="rounded-xl bg-card">
          <ItemMedia variant="icon" className="size-10 rounded-xl bg-accent text-accent-foreground">
            <CalculatorIcon className="size-5" aria-hidden="true" />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle>Multiplication inputs</ItemTitle>
            <ItemDescription className="line-clamp-none text-xs">
              Random, unbalanced, all-9s, zeros, powers-of-10, and trace cases.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="secondary">10 files</Badge>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  )
}
