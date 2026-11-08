import { Channel } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { commands } from "@/bindings"
import type {
  AlgorithmBatchSource,
  ClosestPairBatchResult,
  ClosestPairProgressEvent,
  GenerationResult,
  KaratsubaProgressEvent,
  MultiplicationBatchResult,
} from "@/types/workflow"

type CommandResult<T> = { status: "ok"; data: T } | { status: "error"; error: string }

function unwrapCommand<T>(result: CommandResult<T>): T {
  if (result.status === "error") throw new Error(result.error)
  return result.data
}

/** Frontend boundary for the Tauri commands. */
export async function runClosestPair(
  source: AlgorithmBatchSource,
  onProgress?: (event: ClosestPairProgressEvent) => void,
): Promise<ClosestPairBatchResult> {
  const progressChannel = new Channel<ClosestPairProgressEvent>()
  if (onProgress) {
    progressChannel.onmessage = onProgress
  }

  const result =
    source.mode === "folder"
      ? await commands.runClosestPairFolder(source.directory, progressChannel)
      : await commands.runClosestPairFiles(source.files, progressChannel)
  return unwrapCommand(result)
}

export async function runKaratsuba(
  source: AlgorithmBatchSource,
  onProgress?: (event: KaratsubaProgressEvent) => void,
): Promise<MultiplicationBatchResult> {
  const progressChannel = new Channel<KaratsubaProgressEvent>()
  if (onProgress) {
    progressChannel.onmessage = onProgress
  }

  const result =
    source.mode === "folder"
      ? await commands.runKaratsubaFolder(source.directory, progressChannel)
      : await commands.runKaratsubaFiles(source.files, progressChannel)
  return unwrapCommand(result)
}

export async function generateDatasets(options: {
  outputDirectory: string
  seed: string
}): Promise<GenerationResult> {
  const result = await commands.generateDatasets(options.outputDirectory, options.seed)
  return unwrapCommand(result)
}

export async function pickFolder(defaultPath?: string): Promise<string | null> {
  const trimmed = defaultPath?.trim().replace(/^["']+|["']+$/g, "").trim()
  return open({
    directory: true,
    multiple: false,
    defaultPath: trimmed || undefined,
  })
}

export async function pickFiles(multiple: boolean, defaultPath?: string): Promise<string[]> {
  const selected = await open({
    directory: false,
    multiple,
    defaultPath: defaultPath?.trim() || undefined,
    filters: [{ name: "Plain Text", extensions: ["txt"] }],
  })
  if (!selected) return []
  return Array.isArray(selected) ? selected : [selected]
}

export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path
}
