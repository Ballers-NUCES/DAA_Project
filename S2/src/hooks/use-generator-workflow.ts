import { useCallback, useRef, useState } from "react"
import { toast } from "@/components/ui/toast"
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
    setDirectoryError(null)
  }, [])

  const updateBaseSeed = useCallback((value: string) => {
    setBaseSeed(value)
    setSeedError(null)
    resetOutput()
  }, [resetOutput])

  const updateOutputDirectory = useCallback((value: string) => {
    setOutputDirectory(value)
    resetOutput()
  }, [resetOutput])

  const generate = useCallback(async () => {
    if (status === "running") return

    const nextSeedError = validateSeed(baseSeed)
    if (nextSeedError) {
      resetOutput()
      setSeedError(nextSeedError)
      return
    }
    if (!outputDirectory.trim()) {
      resetOutput()
      setDirectoryError("Enter an output directory before generating datasets.")
      return
    }

    const currentRequest = ++requestId.current
    setStatus("running")
    setResult(null)
    setError(null)

    try {
      const nextResult = await generateDatasets({
        outputDirectory: outputDirectory.trim(),
        seed: baseSeed.trim(),
      })
      if (currentRequest !== requestId.current) return
      setResult(nextResult)
      setStatus("success")
      toast.add({
        title: `${nextResult.filesGenerated} datasets generated`,
        description: "The input files and seed manifest were saved.",
        type: "success",
      })
    } catch (reason) {
      if (currentRequest !== requestId.current) return
      setError(reason instanceof Error ? reason.message : "Datasets could not be generated.")
      setStatus("error")
    }
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
