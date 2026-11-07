import { CopyIcon } from "lucide-react"
import { formatDuration, ResultMetric } from "@/components/result-metric"
import { TraceViewer } from "@/components/trace-viewer"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/toast"
import type { ClosestPairResult, MultiplicationResult, Point } from "@/types/workflow"

const numberFormatter = new Intl.NumberFormat()
const PRODUCT_PREVIEW_DIGITS = 512
const FULL_PRODUCT_THRESHOLD = PRODUCT_PREVIEW_DIGITS * 2

function PointCard({ label, point }: { label: string; point: Point }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 break-all font-mono text-sm tabular-nums">
        ({point.x}, {point.y})
      </p>
    </div>
  )
}

export function ClosestPairResultView({ result }: { result: ClosestPairResult }) {
  return (
    <div className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-3">
        <ResultMetric label="Input Size" value={`${numberFormatter.format(result.inputSize)}\u00a0points`} />
        <ResultMetric label="Closest Distance" value={String(result.distance)} />
        <ResultMetric label="Running Time" value={formatDuration(result.elapsedMicros)} />
      </dl>
      <div>
        <h3 className="mb-3 text-sm font-medium">Closest Pair</h3>
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

export function MultiplicationResultView({
  result,
  showMetrics = true,
}: {
  result: MultiplicationResult
  showMetrics?: boolean
}) {
  const isProductPreview = result.product.length > FULL_PRODUCT_THRESHOLD
  const omittedDigits = result.product.length - PRODUCT_PREVIEW_DIGITS * 2
  const displayedProduct = isProductPreview
    ? `${result.product.slice(0, PRODUCT_PREVIEW_DIGITS)}\n…\n${result.product.slice(-PRODUCT_PREVIEW_DIGITS)}`
    : result.product

  const copyProduct = async () => {
    try {
      await navigator.clipboard.writeText(result.product)
      toast.add({ title: "Product Copied to Clipboard", type: "success" })
    } catch {
      toast.add({
        title: "Could Not Copy the Product",
        description: "Enable clipboard permission for this app, then try copying again.",
        type: "error",
      })
    }
  }

  return (
    <div className="space-y-5">
      {showMetrics && (
        <dl className="grid gap-3 sm:grid-cols-3">
          <ResultMetric label="Left Operand" value={`${numberFormatter.format(result.leftDigits)}\u00a0digits`} />
          <ResultMetric label="Right Operand" value={`${numberFormatter.format(result.rightDigits)}\u00a0digits`} />
          <ResultMetric label="Running Time" value={formatDuration(result.elapsedMicros)} />
        </dl>
      )}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Product</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              ({numberFormatter.format(result.product.length)} digits)
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void copyProduct()}>
            <CopyIcon aria-hidden="true" />
            Copy Product
          </Button>
        </div>
        <ScrollArea
          className="h-56 rounded-xl border bg-muted/20"
          viewportLabel={isProductPreview ? "Multiplication Product Preview" : "Full Multiplication Product"}
        >
          <pre className="p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
            {displayedProduct}
          </pre>
        </ScrollArea>
        {isProductPreview && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the first and last {PRODUCT_PREVIEW_DIGITS} digits, with {numberFormatter.format(omittedDigits)} digits omitted. Copy Product copies the full result.
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
