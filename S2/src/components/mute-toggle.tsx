import { useState } from "react"
import { Volume2Icon, VolumeXIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isCelebrationMuted, setCelebrationMuted } from "@/lib/celebration-sound"

export function MuteToggle() {
  const [muted, setMuted] = useState(isCelebrationMuted)
  const Icon = muted ? VolumeXIcon : Volume2Icon
  const label = muted ? "Unmute Celebration Sound" : "Mute Celebration Sound"

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-9"
      aria-label={label}
      aria-pressed={muted}
      title={label}
      onClick={() => {
        const nextMuted = !muted
        setCelebrationMuted(nextMuted)
        setMuted(nextMuted)
      }}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  )
}
