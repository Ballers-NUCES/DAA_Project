import { useId, useState } from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AlgorithmStep } from "@/types/workflow"

const PAGE_SIZE = 50
const numberFormatter = new Intl.NumberFormat()

export function TraceViewer({ steps }: { steps: AlgorithmStep[] }) {
  const tracePagesId = useId()
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(steps.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleSteps = steps.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  return (
    <Collapsible className="rounded-xl border bg-muted/10">
      <h3>
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-medium">Step-by-Step Trace</span>
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {numberFormatter.format(steps.length)}{"\u00a0"}Steps
            </Badge>
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-180"
          />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent className="border-t">
        <ScrollArea key={currentPage} className="h-72" viewportLabel="Algorithm Trace">
          <ol id={tracePagesId} start={currentPage * PAGE_SIZE + 1} className="space-y-2 p-3">
            {visibleSteps.map((step, index) => {
              const stepNumber = currentPage * PAGE_SIZE + index + 1
              return (
                <li key={stepNumber} className="flex gap-3 rounded-lg border bg-background p-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary font-mono text-[11px] text-secondary-foreground tabular-nums">
                    {numberFormatter.format(stepNumber)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="break-words font-mono text-xs font-medium">{step.title}</p>
                      {step.depth != null && (
                        <Badge variant="outline" className="h-4 px-1.5 font-mono text-[10px] tabular-nums">
                          Depth {numberFormatter.format(step.depth)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </ScrollArea>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t px-3 py-2">
            <span
              className="text-xs text-muted-foreground tabular-nums"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              Page {numberFormatter.format(currentPage + 1)} of {numberFormatter.format(pageCount)}
            </span>
            <ButtonGroup>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="First Trace Page"
                aria-controls={tracePagesId}
                disabled={currentPage === 0}
                onClick={() => setPage(0)}
              >
                <ChevronsLeftIcon aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous Trace Page"
                aria-controls={tracePagesId}
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next Trace Page"
                aria-controls={tracePagesId}
                disabled={currentPage === pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Last Trace Page"
                aria-controls={tracePagesId}
                disabled={currentPage === pageCount - 1}
                onClick={() => setPage(pageCount - 1)}
              >
                <ChevronsRightIcon aria-hidden="true" />
              </Button>
            </ButtonGroup>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
