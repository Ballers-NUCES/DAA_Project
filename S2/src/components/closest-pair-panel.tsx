import { ArrowUpDownIcon, ZapIcon } from "lucide-react"
import { AlgorithmPanel } from "@/components/algorithm-panel"
import { ClosestPairResultView } from "@/components/algorithm-results"
import { Field, FieldTitle } from "@/components/ui/field"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { closestPairDatasets } from "@/data/datasets"
import type { ClosestPairWorkflow } from "@/hooks/use-closest-pair-workflow"
import type { XSortStrategy } from "@/types/workflow"

const numberFormatter = new Intl.NumberFormat()

interface ClosestPairPanelProps {
  workflow: ClosestPairWorkflow
}

export function ClosestPairPanel({ workflow }: ClosestPairPanelProps) {
  const { sortStrategy, selectSortStrategy, status } = workflow
  const running = status === "running"

  return (
    <AlgorithmPanel
      id="closest-pair"
      badge="Divide & Conquer"
      subtitle="Generated Folder by Default"
      title="Closest Pair of Points"
      description="Find the two nearest points in a two-dimensional plane using recursive spatial partitioning, then inspect each result and running time."
      complexity="O(n log n)"
      datasets={closestPairDatasets}
      datasetTitle="Closest-Pair Datasets"
      datasetDescription="Input sizes and geometric edge cases for cp01–cp10. Generated files live in the cpp folder."
      folderLabel="Closest-Pair Dataset Folder"
      folderDescription={
        <>
          Runs <code translate="no">cp01.txt</code> through <code translate="no">cp10.txt</code> in order. Generating datasets fills this path automatically.
        </>
      }
      extraControls={
        <Field>
          <FieldTitle id="closest-pair-sort-label">Initial X-Sort</FieldTitle>
          <ToggleGroup
            value={[sortStrategy]}
            onValueChange={(values) => {
              const next = values[0] as XSortStrategy | undefined
              if (next) selectSortStrategy(next)
            }}
            aria-labelledby="closest-pair-sort-label"
            className="grid w-full grid-cols-2 rounded-xl border bg-muted/40 p-1"
          >
            <ToggleGroupItem
              value="radix"
              disabled={running}
              className="h-9 gap-2 rounded-lg data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs"
            >
              <ZapIcon aria-hidden="true" />
              Radix Sort
            </ToggleGroupItem>
            <ToggleGroupItem
              value="merge"
              disabled={running}
              className="h-9 gap-2 rounded-lg data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs"
            >
              <ArrowUpDownIcon aria-hidden="true" />
              Merge Sort
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
      }
      runningTitle="Closest-Pair Batch in Progress"
      runningFolderDescription="Finding closest pairs in cp01 through cp10. Each file updates in the batch report as it finishes."
      batchRunningTitle="Running Closest-Pair Searches"
      batchSuccessTitle="All Closest-Pair Searches Complete"
      runHint="Small inputs include a trace. Large inputs return the closest pair, distance, and running time."
      workflow={workflow}
      getFileSubtitle={(result) =>
        `${numberFormatter.format(result.inputSize)} points · Distance ${result.distance}`
      }
      hasTrace={(result) => Boolean(result.trace?.length)}
      renderResult={(result) => <ClosestPairResultView result={result} showMetrics={false} />}
    />
  )
}
