import { AlgorithmPanel } from "@/components/algorithm-panel"
import { MultiplicationResultView } from "@/components/algorithm-results"
import { multiplicationDatasets } from "@/data/datasets"
import type { AlgorithmWorkflow } from "@/hooks/use-algorithm-workflow"
import type { MultiplicationResult } from "@/types/workflow"

const numberFormatter = new Intl.NumberFormat()

interface MultiplicationPanelProps {
  workflow: AlgorithmWorkflow<MultiplicationResult>
}

export function MultiplicationPanel({ workflow }: MultiplicationPanelProps) {
  return (
    <AlgorithmPanel
      id="karatsuba"
      badge="Karatsuba Batch"
      subtitle="Generated Folder by Default"
      title="Integer Multiplication"
      description="Multiply non-negative integers using Karatsuba recursion, then inspect each product and running time."
      complexity="O(n¹·⁵⁸⁵)"
      datasets={multiplicationDatasets}
      datasetTitle="Multiplication Datasets"
      datasetDescription="Operand sizes and edge cases for im01–im10. Generated files live in the karatsuba folder."
      folderLabel="Karatsuba Dataset Folder"
      folderDescription={
        <>
          Runs <code translate="no">im01.txt</code> through <code translate="no">im10.txt</code> in order. Generating datasets fills this path automatically.
        </>
      }
      runningTitle="Karatsuba Batch in Progress"
      runningFolderDescription="Multiplying im01 through im10. Each file updates in the batch report as it finishes."
      batchRunningTitle="Running Multiplications"
      batchSuccessTitle="All Multiplications Complete"
      runHint="Small inputs include a trace. Large products stay collapsed and show a bounded preview when opened."
      workflow={workflow}
      getFileSubtitle={(result) =>
        `${numberFormatter.format(result.leftDigits)} × ${numberFormatter.format(result.rightDigits)} digits`
      }
      hasTrace={(result) => Boolean(result.trace?.length)}
      renderResult={(result) => <MultiplicationResultView result={result} showMetrics={false} />}
    />
  )
}
