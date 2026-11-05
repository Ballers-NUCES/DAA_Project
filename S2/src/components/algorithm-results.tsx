import { CopyIcon } from "lucide-react"
import { toast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatDuration, ResultMetric } from "@/components/result-metric"
import { TraceViewer } from "@/components/trace-viewer"
import type { ClosestPairResult, MultiplicationResult, Point } from "@/types/workflow"

const numberFormatter = new Intl.NumberFormat()
const PRODUCT_PREVIEW_DIGITS = 512
const FULL_PRODUCT_THRESHOLD = PRODUCT_PREVIEW_DIGITS * 2

function PointCard({ label, point }: { label: string; point: Point }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 break-all font-mono text-sm">
        ({point.x}, {point.y})
      </p>
    </div>
  )
}

export function ClosestPairResultView({ result }: { result: ClosestPairResult }) {
  return (
    <div className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-3">
        <ResultMetric label="Input size" value={`${numberFormatter.format(result.inputSize)}\u00a0points`} />
        <ResultMetric label="Closest distance" value={String(result.distance)} />
        <ResultMetric label="Running time" value={formatDuration(result.elapsedMicros)} />
      </dl>
      <div>
        <h3 className="mb-3 text-sm font-medium">Closest pair</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <PointCard label="Point A" point={result.first} />
          <PointCard label="Point B" point={result.second} />
        </div>
      </div>
      {result.trace && result.trace.length > 0 ? (
        <TraceViewer steps={result.trace} />
      ) : (
        <p className="text-xs text-muted-foreground">No trace returned for this input.</p>
      )}
    </div>
  )
}

export function MultiplicationResultView({ result }: { result: MultiplicationResult }) {
  const isProductPreview = result.product.length > FULL_PRODUCT_THRESHOLD
  const omittedDigits = result.product.length - PRODUCT_PREVIEW_DIGITS * 2
  const displayedProduct = isProductPreview
    ? `${result.product.slice(0, PRODUCT_PREVIEW_DIGITS)}\n…\n${result.product.slice(-PRODUCT_PREVIEW_DIGITS)}`
    : result.product

  const copyProduct = async () => {
    try {
      await navigator.clipboard.writeText(result.product)
      toast.add({ title: "Product copied to clipboard", type: "success" })
    } catch {
      toast.add({
        title: "Could not copy the product",
        description: "Enable clipboard permission for this app, then try copying again.",
        type: "error",
      })
    }
  }

  return (
    <div className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-3">
        <ResultMetric label="Left operand" value={`${numberFormatter.format(result.leftDigits)}\u00a0digits`} />
        <ResultMetric label="Right operand" value={`${numberFormatter.format(result.rightDigits)}\u00a0digits`} />
        <ResultMetric label="Running time" value={formatDuration(result.elapsedMicros)} />
      </dl>
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Product</h3>
          <Button variant="outline" size="sm" onClick={() => void copyProduct()}>
            <CopyIcon aria-hidden="true" />
            Copy product
          </Button>
        </div>
        <ScrollArea
          className="h-56 rounded-xl border bg-muted/20"
          viewportLabel={isProductPreview ? "Multiplication product preview" : "Full multiplication product"}
        >
          <pre className="p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
            {displayedProduct}
          </pre>
        </ScrollArea>
        {isProductPreview && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the first and last {PRODUCT_PREVIEW_DIGITS} digits, with {numberFormatter.format(omittedDigits)} digits omitted. Copy product copies the full result.
          </p>
        )}
      </div>
      {result.trace && result.trace.length > 0 ? (
        <TraceViewer steps={result.trace} />
      ) : (
        <p className="text-xs text-muted-foreground">No trace returned for this input.</p>
      )}
    </div>
  )
}
