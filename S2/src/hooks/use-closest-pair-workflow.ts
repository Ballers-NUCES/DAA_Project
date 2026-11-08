import { useState } from "react"
import { closestPairDatasets } from "@/data/datasets"
import { useAlgorithmWorkflow } from "@/hooks/use-algorithm-workflow"
import type { AlgorithmWorkflow } from "@/hooks/use-algorithm-workflow"
import { runClosestPair } from "@/lib/backend"
import type { ClosestPairResult, XSortStrategy } from "@/types/workflow"

const FILE_NAMES = closestPairDatasets.map((dataset) => `${dataset.file}.txt`)

export interface ClosestPairWorkflow extends AlgorithmWorkflow<ClosestPairResult> {
  sortStrategy: XSortStrategy
  selectSortStrategy: (strategy: XSortStrategy) => void
}

export function useClosestPairWorkflow(defaultDirectory?: string): ClosestPairWorkflow {
  const [sortStrategy, setSortStrategy] = useState<XSortStrategy>("radix")

  const workflow = useAlgorithmWorkflow<ClosestPairResult>({
    defaultDirectory,
    fileNames: FILE_NAMES,
    emptyDirectoryError: "Enter the closest-pair dataset folder before running the batch.",
    emptyFilesError: "Choose at least one closest-pair input file.",
    runError: "The closest-pair batch could not be run.",
    runBatch: (source, onProgress) => runClosestPair(source, sortStrategy, onProgress),
  })

  function selectSortStrategy(nextStrategy: XSortStrategy) {
    if (nextStrategy === sortStrategy) return
    setSortStrategy(nextStrategy)
    workflow.clearResult()
  }

  return {
    ...workflow,
    sortStrategy,
    selectSortStrategy,
  }
}
