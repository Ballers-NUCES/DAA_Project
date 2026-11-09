import { LayersIcon } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { MuteToggle } from "@/components/mute-toggle"
import { Badge } from "@/components/ui/badge"

export function AppHeader() {
  return (
    <header className="flex-none border-b bg-card/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <LayersIcon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">DAA Workspace</p>
            <p className="text-xs text-muted-foreground">Design and Analysis of Algorithms</p>
          </div>
          <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
            Submission 02
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MuteToggle />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
