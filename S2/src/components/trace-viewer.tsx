import { useState } from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AlgorithmStep } from "@/types/workflow"

const PAGE_SIZE = 50

export function TraceViewer({ steps }: { steps: AlgorithmStep[] }) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(steps.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleSteps = steps.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  return (
    <Collapsible className="rounded-xl border bg-muted/10">
      <h3>
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-medium">Step-by-step trace</span>
            <Badge variant="secondary">{steps.length.toLocaleString()} steps</Badge>
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-180" />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent className="border-t">
        <ScrollArea key={currentPage} className="h-72" viewportLabel="Algorithm trace">
          <ol start={currentPage * PAGE_SIZE + 1} className="space-y-2 p-3">
            {visibleSteps.map((step, index) => {
              const stepNumber = currentPage * PAGE_SIZE + index + 1
              return (
                <li key={stepNumber} className="flex gap-3 rounded-lg bg-background p-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary font-mono text-[11px] text-secondary-foreground">
                    {stepNumber}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium">{step.title}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                    {step.depth !== undefined && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Depth {step.depth}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </ScrollArea>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Page {currentPage + 1} of {pageCount}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous trace page"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next trace page"
                disabled={currentPage === pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
