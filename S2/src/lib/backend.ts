import { invoke } from "@tauri-apps/api/core"
import type {
  ClosestPairResult,
  GenerationResult,
  MultiplicationResult,
} from "@/types/workflow"

/**
 * Frontend boundary for the future Tauri commands. Keeping the placeholders
 * here lets the UI implement its complete state machine without fake results.
 */
export async function runClosestPair(file: File): Promise<ClosestPairResult> {
  throw new Error(
    `The Rust command is not connected yet. “${file.name}” is ready and your selection has been preserved.`,
  )
}

export async function runKaratsuba(file: File): Promise<MultiplicationResult> {
  const decimalContent = await file.text()
  return invoke<MultiplicationResult>("run_karatsuba", { decimalContent })
}

export async function generateDatasets(options: {
  outputDirectory: string
  seed: string
}): Promise<GenerationResult> {
  throw new Error(
    `Dataset generation is not connected yet. Your seed (${options.seed}) and output directory have been preserved.`,
  )
}
