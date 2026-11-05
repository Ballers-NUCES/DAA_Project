import { invoke } from "@tauri-apps/api/core"
import type {
  ClosestPairResult,
  GenerationResult,
  MultiplicationBatchResult,
} from "@/types/workflow"

/** Frontend boundary for the Tauri commands. */
export async function runClosestPair(file: File): Promise<ClosestPairResult> {
  throw new Error(
    `The Rust command is not connected yet. “${file.name}” is ready and your selection has been preserved.`,
  )
}

export async function runKaratsuba(source: {
  mode: "folder" | "files"
  directory: string
  files: File[]
}): Promise<MultiplicationBatchResult> {
  if (source.mode === "folder") {
    return invoke<MultiplicationBatchResult>("run_karatsuba_folder", {
      directory: source.directory,
    })
  }

  const inputs = await Promise.all(
    source.files.map(async (file) => ({
      name: file.name,
      content: await file.text(),
    })),
  )
  return invoke<MultiplicationBatchResult>("run_karatsuba_files", { inputs })
}

export async function generateDatasets(options: {
  outputDirectory: string
  seed: string
}): Promise<GenerationResult> {
  return invoke<GenerationResult>("generate_datasets", options)
}
