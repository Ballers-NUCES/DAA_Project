import { useCallback, useRef, useState } from "react"
import { generateDatasets } from "@/lib/backend"
import { validateSeed } from "@/lib/validation"
import type { GenerationResult, WorkflowStatus } from "@/types/workflow"

export function useGeneratorWorkflow() {
  const [baseSeed, setBaseSeed] = useState("20261110")
  const [outputDirectory, setOutputDirectory] = useState("")
  const [status, setStatus] = useState<WorkflowStatus>("idle")
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seedError, setSeedError] = useState<string | null>(null)
  const [directoryError, setDirectoryError] = useState<string | null>(null)
  const requestId = useRef(0)

  const resetOutput = useCallback(() => {
    requestId.current += 1
    setStatus("idle")
    setResult(null)
    setError(null)
  }, [])

  const updateBaseSeed = useCallback((value: string) => {
    setBaseSeed(value)
    setSeedError(null)
    resetOutput()
  }, [resetOutput])

  const updateOutputDirectory = useCallback((value: string) => {
    setOutputDirectory(value)
    setDirectoryError(null)
    resetOutput()
  }, [resetOutput])

  const generate = useCallback(async () => {
    if (status === "running") return null

    const nextSeedError = validateSeed(baseSeed)
    const nextDirectoryError = outputDirectory.trim()
      ? null
      : "Enter an output directory before generating datasets."
    if (nextSeedError || nextDirectoryError) {
      resetOutput()
      setSeedError(nextSeedError)
      setDirectoryError(nextDirectoryError)
      return nextDirectoryError ? "directory" : "seed"
    }

    const currentRequest = ++requestId.current
    setStatus("running")
    setResult(null)
    setError(null)
    setSeedError(null)
    setDirectoryError(null)

    try {
      const nextResult = await generateDatasets({
        outputDirectory: outputDirectory.trim(),
        seed: baseSeed.trim(),
      })
      if (currentRequest !== requestId.current) return null
      setResult(nextResult)
      setStatus("success")
    } catch (reason) {
      if (currentRequest !== requestId.current) return null
      setError(reason instanceof Error ? reason.message : "Datasets could not be generated.")
      setStatus("error")
    }
    return null
  }, [baseSeed, outputDirectory, resetOutput, status])

  return {
    baseSeed,
    outputDirectory,
    status,
    result,
    error,
    seedError,
    directoryError,
    updateBaseSeed,
    updateOutputDirectory,
    generate,
  }
}
