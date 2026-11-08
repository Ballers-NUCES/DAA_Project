import { closestPairDatasets } from "@/data/datasets"
import { useAlgorithmWorkflow } from "@/hooks/use-algorithm-workflow"
import { runClosestPair } from "@/lib/backend"
import type { ClosestPairResult } from "@/types/workflow"

const FILE_NAMES = closestPairDatasets.map((dataset) => `${dataset.file}.txt`)

export function useClosestPairWorkflow(defaultDirectory?: string) {
  return useAlgorithmWorkflow<ClosestPairResult>({
    defaultDirectory,
    fileNames: FILE_NAMES,
    emptyDirectoryError: "Enter the closest-pair dataset folder before running the batch.",
    emptyFilesError: "Choose at least one closest-pair input file.",
    runError: "The closest-pair batch could not be run.",
    runBatch: runClosestPair,
  })
}
