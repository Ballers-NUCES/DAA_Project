import { CalculatorIcon, CrosshairIcon, DatabaseIcon } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { ClosestPairPanel } from "@/components/closest-pair-panel"
import { GeneratorPanel } from "@/components/generator-panel"
import { MultiplicationPanel } from "@/components/multiplication-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useClosestPairWorkflow } from "@/hooks/use-closest-pair-workflow"
import { useGeneratorWorkflow } from "@/hooks/use-generator-workflow"
import { useMultiplicationWorkflow } from "@/hooks/use-multiplication-workflow"

function App() {
  const generator = useGeneratorWorkflow()
  const closestPair = useClosestPairWorkflow(generator.result?.closestPairDirectory)
  const karatsuba = useMultiplicationWorkflow(generator.result?.karatsubaDirectory)

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-3 focus:ring-ring"
      >
        Skip to Main Content
      </a>
      <AppHeader />

      <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <div className="mb-6 max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Algorithm Workspace
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Run divide-and-conquer algorithms, inspect their step-by-step traces, or generate reproducible benchmark datasets.
            </p>
          </div>

          <Tabs defaultValue="closest-pair">
            <TabsList
              aria-label="Workspace Sections"
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
                aria-label="Karatsuba Multiplication"
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
              <ClosestPairPanel workflow={closestPair} />
            </TabsContent>

            <TabsContent value="karatsuba" className="mt-4">
              <MultiplicationPanel workflow={karatsuba} />
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
