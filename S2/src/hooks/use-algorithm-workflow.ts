import { useEffect, useRef, useState } from "react"
import { fileNameFromPath } from "@/lib/backend"
import type {
  AlgorithmBatchResult,
  AlgorithmBatchSource,
  AlgorithmProgressEvent,
  AlgorithmResult,
  AlgorithmSourceMode,
  WorkflowStatus,
} from "@/types/workflow"

export type AlgorithmBatchRunner<T extends AlgorithmResult> = (
  source: AlgorithmBatchSource,
  onProgress?: (event: AlgorithmProgressEvent<T>) => void,
) => Promise<AlgorithmBatchResult<T>>

interface AlgorithmWorkflowOptions<T extends AlgorithmResult> {
  defaultDirectory?: string
  fileNames: readonly string[]
  emptyDirectoryError: string
  emptyFilesError: string
  runError: string
  runBatch: AlgorithmBatchRunner<T>
}

export interface AlgorithmWorkflow<T extends AlgorithmResult> {
  sourceMode: AlgorithmSourceMode
  directory: string
  files: string[]
  status: WorkflowStatus
  result: AlgorithmBatchResult<T> | null
  error: string | null
  directoryError: string | null
  canRun: boolean
  selectSourceMode: (mode: AlgorithmSourceMode) => void
  updateDirectory: (value: string) => void
  selectFiles: (files: string[]) => void
  clearResult: () => void
  run: () => Promise<"directory" | null>
}

export function useAlgorithmWorkflow<T extends AlgorithmResult>({
  defaultDirectory,
  fileNames,
  emptyDirectoryError,
  emptyFilesError,
  runError,
  runBatch,
}: AlgorithmWorkflowOptions<T>): AlgorithmWorkflow<T> {
  const [sourceMode, setSourceMode] = useState<AlgorithmSourceMode>("folder")
  const [directory, setDirectory] = useState("")
  const [files, setFiles] = useState<string[]>([])
  const [status, setStatus] = useState<WorkflowStatus>("idle")
  const [result, setResult] = useState<AlgorithmBatchResult<T> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const requestId = useRef(0)

  function resetOutput() {
    requestId.current += 1
    setStatus("idle")
    setResult(null)
    setError(null)
  }

  useEffect(() => {
    if (!defaultDirectory) return
    requestId.current += 1
    setSourceMode("folder")
    setDirectory(defaultDirectory)
    setDirectoryError(null)
    setFiles([])
    setStatus("idle")
    setResult(null)
    setError(null)
  }, [defaultDirectory])

  function selectSourceMode(nextMode: AlgorithmSourceMode) {
    if (nextMode === sourceMode) return
    setSourceMode(nextMode)
    setDirectoryError(null)
    resetOutput()
  }

  function updateDirectory(value: string) {
    setDirectory(value)
    setDirectoryError(null)
    resetOutput()
  }

  function selectFiles(nextFiles: string[]) {
    setFiles(nextFiles)
    resetOutput()
  }

  async function run(): Promise<"directory" | null> {
    if (status === "running") return null

    const trimmedDirectory = directory.trim()
    if (sourceMode === "folder" && !trimmedDirectory) {
      resetOutput()
      setDirectoryError(emptyDirectoryError)
      return "directory"
    }
    if (sourceMode === "files" && files.length === 0) {
      setStatus("error")
      setError(emptyFilesError)
      return null
    }

    const currentRequest = ++requestId.current
    const initialFileNames =
      sourceMode === "folder" ? fileNames : files.map(fileNameFromPath)

    setStatus("running")
    setError(null)
    setDirectoryError(null)
    setResult({
      source: sourceMode === "folder" ? trimmedDirectory : "Selected files",
      files: initialFileNames.map((fileName) => ({
        fileName,
        status: "pending",
      })),
      totalFiles: initialFileNames.length,
      succeeded: 0,
      failed: 0,
      totalElapsedMicros: 0,
    })

    const handleProgress = (event: AlgorithmProgressEvent<T>) => {
      if (currentRequest !== requestId.current) return
      setResult((previous) => {
        if (!previous) return previous
        const nextFiles = [...previous.files]
        if (event.kind === "started") {
          nextFiles[event.index] = {
            fileName: event.fileName,
            status: "running",
          }
          return { ...previous, files: nextFiles }
        }

        nextFiles[event.index] = {
          ...event.file,
          status: "completed",
        }

        let succeeded = 0
        let failed = 0
        let totalElapsedMicros = 0
        for (const item of nextFiles) {
          if (item.status === "completed") {
            if (item.result) {
              succeeded += 1
              totalElapsedMicros += item.result.elapsedMicros
            } else {
              failed += 1
            }
          }
        }

        return {
          ...previous,
          files: nextFiles,
          succeeded,
          failed,
          totalElapsedMicros,
        }
      })
    }

    try {
      const nextResult = await runBatch(
        {
          mode: sourceMode,
          directory: trimmedDirectory,
          files,
        },
        handleProgress,
      )
      if (currentRequest !== requestId.current) return null
      setResult({
        ...nextResult,
        files: nextResult.files.map((file) => ({
          ...file,
          status: "completed",
        })),
      })
      setStatus("success")
    } catch (reason) {
      if (currentRequest !== requestId.current) return null
      setResult(null)
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : runError,
      )
      setStatus("error")
    }
    return null
  }

  const canRun = sourceMode === "folder" ? directory.trim().length > 0 : files.length > 0

  return {
    sourceMode,
    directory,
    files,
    status,
    result,
    error,
    directoryError,
    canRun,
    selectSourceMode,
    updateDirectory,
    selectFiles,
    clearResult: resetOutput,
    run,
  }
}
