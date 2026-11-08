import { AlgorithmPanel } from "@/components/algorithm-panel"
import { ClosestPairResultView } from "@/components/algorithm-results"
import { closestPairDatasets } from "@/data/datasets"
import type { AlgorithmWorkflow } from "@/hooks/use-algorithm-workflow"
import type { ClosestPairResult } from "@/types/workflow"

const numberFormatter = new Intl.NumberFormat()

interface ClosestPairPanelProps {
  workflow: AlgorithmWorkflow<ClosestPairResult>
}

export function ClosestPairPanel({ workflow }: ClosestPairPanelProps) {
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
