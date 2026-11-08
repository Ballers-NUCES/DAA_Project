import type {
  AlgorithmStep,
  GenerationResult,
  KaratsubaProgressEvent,
  MultiplicationFileResult,
  MultiplicationResult,
} from "@/bindings"

export type {
  AlgorithmStep,
  GenerationResult,
  KaratsubaProgressEvent,
  MultiplicationFileResult,
  MultiplicationResult,
}

export type WorkflowStatus = "idle" | "running" | "success" | "error"

export interface Point {
  x: number
  y: number
}

export interface ClosestPairResult {
  first: Point
  second: Point
  distance: number
  inputSize: number
  elapsedMicros: number
  trace?: AlgorithmStep[] | null
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

export type MultiplicationBatchResult = AlgorithmBatchResult<MultiplicationResult>
