import type {
  AlgorithmStep,
  ClosestPairFileResult,
  ClosestPairProgressEvent,
  ClosestPairResult,
  GenerationResult,
  KaratsubaProgressEvent,
  MultiplicationFileResult,
  MultiplicationResult,
  Point,
} from "@/bindings"

export type {
  AlgorithmStep,
  ClosestPairFileResult,
  ClosestPairProgressEvent,
  ClosestPairResult,
  GenerationResult,
  KaratsubaProgressEvent,
  MultiplicationFileResult,
  MultiplicationResult,
  Point,
}

export type WorkflowStatus = "idle" | "running" | "success" | "error"
export type AlgorithmSourceMode = "folder" | "files"

export interface AlgorithmResult {
  elapsedMicros: number
  trace?: AlgorithmStep[] | null
}

export interface AlgorithmBatchSource {
  mode: AlgorithmSourceMode
  directory: string
  files: string[]
}

export interface AlgorithmFileResult<T> {
  fileName: string
  status?: "pending" | "running" | "completed"
  result?: T | null
  error?: string | null
}

export interface AlgorithmBatchResult<T> {
  source: string
  files: AlgorithmFileResult<T>[]
  totalFiles: number
  succeeded: number
  failed: number
  totalElapsedMicros: number
}

export type AlgorithmProgressEvent<T> =
  | {
      kind: "started"
      index: number
      fileName: string
    }
  | {
      kind: "finished"
      index: number
      file: AlgorithmFileResult<T>
    }

export type ClosestPairBatchResult = AlgorithmBatchResult<ClosestPairResult>
export type MultiplicationBatchResult = AlgorithmBatchResult<MultiplicationResult>
