import { useCallback, useRef, useState } from "react"
import type { WorkflowStatus } from "@/types/workflow"

export function useAlgorithmWorkflow<T>(runner: (file: File) => Promise<T>) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<WorkflowStatus>("idle")
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const selectFile = useCallback((nextFile: File | null) => {
    requestId.current += 1
    setFile(nextFile)
    setStatus("idle")
    setResult(null)
    setError(null)
  }, [])

  const run = useCallback(async () => {
    if (!file || status === "running") return

    const currentRequest = ++requestId.current
    setStatus("running")
    setResult(null)
    setError(null)

    try {
      const nextResult = await runner(file)
      if (currentRequest !== requestId.current) return
      setResult(nextResult)
      setStatus("success")
    } catch (reason) {
      if (currentRequest !== requestId.current) return
      setError(
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "The algorithm could not be run.",
      )
      setStatus("error")
    }
  }, [file, runner, status])

  return { file, status, result, error, selectFile, run }
}
