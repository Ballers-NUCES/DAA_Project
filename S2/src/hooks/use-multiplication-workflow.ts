import { multiplicationDatasets } from "@/data/datasets"
import { useAlgorithmWorkflow } from "@/hooks/use-algorithm-workflow"
import { runKaratsuba } from "@/lib/backend"
import type { MultiplicationResult } from "@/types/workflow"

const FILE_NAMES = multiplicationDatasets.map((dataset) => `${dataset.file}.txt`)

export function useMultiplicationWorkflow(defaultDirectory?: string) {
  return useAlgorithmWorkflow<MultiplicationResult>({
    defaultDirectory,
    fileNames: FILE_NAMES,
    emptyDirectoryError: "Enter the Karatsuba dataset folder before running the batch.",
    emptyFilesError: "Choose at least one multiplication input file.",
    runError: "The Karatsuba batch could not be run.",
    runBatch: runKaratsuba,
  })
}
