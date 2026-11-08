import { useEffect, useRef, useState } from "react"
import { multiplicationDatasets } from "@/data/datasets"
import { fileNameFromPath, runKaratsuba } from "@/lib/backend"
import type {
  KaratsubaProgressEvent,
  MultiplicationBatchResult,
  WorkflowStatus,
} from "@/types/workflow"

export type MultiplicationSourceMode = "folder" | "files"

export function useMultiplicationWorkflow(defaultDirectory?: string) {
  const [sourceMode, setSourceMode] = useState<MultiplicationSourceMode>("folder")
  const [directory, setDirectory] = useState("")
  const [files, setFiles] = useState<string[]>([])
  const [status, setStatus] = useState<WorkflowStatus>("idle")
  const [result, setResult] = useState<MultiplicationBatchResult | null>(null)
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

  function selectSourceMode(nextMode: MultiplicationSourceMode) {
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
      setDirectoryError("Enter the Karatsuba dataset folder before running the batch.")
      return "directory"
    }
    if (sourceMode === "files" && files.length === 0) {
      setStatus("error")
      setError("Choose at least one multiplication input file.")
      return null
    }

    const currentRequest = ++requestId.current
    const initialFileNames =
      sourceMode === "folder"
        ? multiplicationDatasets.map((row) => `${row.file}.txt`)
        : files.map(fileNameFromPath)

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

    const handleProgress = (event: KaratsubaProgressEvent) => {
      if (currentRequest !== requestId.current) return
      setResult((prev) => {
        if (!prev) return prev
        const nextFiles = [...prev.files]
        if (event.kind === "started") {
          nextFiles[event.index] = {
            fileName: event.fileName,
            status: "running",
          }
          return {
            ...prev,
            files: nextFiles,
          }
        }

        const completedFile = {
          ...event.file,
          status: "completed" as const,
        }
        nextFiles[event.index] = completedFile

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
          ...prev,
          files: nextFiles,
          succeeded,
          failed,
          totalElapsedMicros,
        }
      })
    }

    try {
      const nextResult = await runKaratsuba(
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
            : "The Karatsuba batch could not be run.",
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
    run,
  }
}
