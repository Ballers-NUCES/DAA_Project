export type WorkflowStatus = "idle" | "running" | "success" | "error"

export interface AlgorithmStep {
  title: string
  description: string
  depth?: number
}

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
  trace?: AlgorithmStep[]
}

export interface MultiplicationResult {
  product: string
  leftDigits: number
  rightDigits: number
  elapsedMicros: number
  trace?: AlgorithmStep[]
}

export interface AlgorithmFileResult<T> {
  fileName: string
  result?: T
  error?: string
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

export interface GenerationResult {
  filesGenerated: number
  manifestPath: string
  outputDirectory: string
  karatsubaDirectory: string
  closestPairDirectory: string
}
