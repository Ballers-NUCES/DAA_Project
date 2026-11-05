import { CalculatorIcon, CrosshairIcon, DatabaseIcon } from "lucide-react"
import { AlgorithmPanel } from "@/components/algorithm-panel"
import { ClosestPairResultView, MultiplicationResultView } from "@/components/algorithm-results"
import { AppHeader } from "@/components/app-header"
import { GeneratorPanel } from "@/components/generator-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { closestPairDatasets, multiplicationDatasets } from "@/data/datasets"
import { useAlgorithmWorkflow } from "@/hooks/use-algorithm-workflow"
import { useGeneratorWorkflow } from "@/hooks/use-generator-workflow"
import { runClosestPair, runKaratsuba } from "@/lib/backend"

function App() {
  const closestPair = useAlgorithmWorkflow(runClosestPair)
  const karatsuba = useAlgorithmWorkflow(runKaratsuba)
  const generator = useGeneratorWorkflow()

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <AppHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <div className="mb-6 max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Algorithm workspace</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Run the required algorithms, inspect their traces, or generate input datasets.
            </p>
          </div>

          <Tabs defaultValue="closest-pair">
            <TabsList
              aria-label="Workspace sections"
              className="grid h-12 w-full grid-cols-3 gap-1 rounded-xl border bg-card p-1 shadow-xs group-data-horizontal/tabs:h-12"
            >
              <TabsTrigger
                value="closest-pair"
                aria-label="Closest Pair"
                className="h-full min-w-0 gap-2 px-2"
              >
                <CrosshairIcon className="size-4" aria-hidden="true" />
                <span className="max-[430px]:sr-only truncate">Closest Pair</span>
              </TabsTrigger>
              <TabsTrigger
                value="karatsuba"
                aria-label="Karatsuba"
                className="h-full min-w-0 gap-2 px-2"
              >
                <CalculatorIcon className="size-4" aria-hidden="true" />
                <span className="max-[430px]:sr-only truncate">Karatsuba</span>
              </TabsTrigger>
              <TabsTrigger
                value="generator"
                aria-label="Dataset Generator"
                className="h-full min-w-0 gap-2 px-2"
              >
                <DatabaseIcon className="size-4" aria-hidden="true" />
                <span className="max-[430px]:sr-only truncate">Generator</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="closest-pair" className="mt-4">
              <AlgorithmPanel
                id="closest-pair"
                title="Closest pair of points"
                description="Find the two nearest points in a 2-D plane using divide and conquer."
                complexity="O(n log n)"
                actionLabel="Run closest pair"
                idleDescription="Select a dataset and run the algorithm to see the closest points, distance, running time, and trace when available."
                datasets={closestPairDatasets}
                datasetTitle="Closest-pair datasets"
                datasetDescription="Input sizes and edge cases for cp01–cp10."
                fileHint="Choose cp01–cp10. Files are assumed valid."
                file={closestPair.file}
                status={closestPair.status}
                error={closestPair.error}
                onFileChange={closestPair.selectFile}
                onRun={() => void closestPair.run()}
              >
                {closestPair.result && <ClosestPairResultView result={closestPair.result} />}
              </AlgorithmPanel>
            </TabsContent>

            <TabsContent value="karatsuba" className="mt-4">
              <AlgorithmPanel
                id="karatsuba"
                title="Integer multiplication"
                description="Multiply non-negative integers using Karatsuba recursion."
                complexity="O(n¹·⁵⁸⁵)"
                actionLabel="Run Karatsuba"
                idleDescription="Select a dataset and run the algorithm to see the product, running time, and trace when available."
                datasets={multiplicationDatasets}
                datasetTitle="Multiplication datasets"
                datasetDescription="Operand sizes and edge cases for im01–im10."
                fileHint="Choose im01–im10. Files are assumed valid."
                file={karatsuba.file}
                status={karatsuba.status}
                error={karatsuba.error}
                onFileChange={karatsuba.selectFile}
                onRun={() => void karatsuba.run()}
              >
                {karatsuba.result && <MultiplicationResultView result={karatsuba.result} />}
              </AlgorithmPanel>
            </TabsContent>

            <TabsContent value="generator" className="mt-4">
              <GeneratorPanel workflow={generator} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

export default App
