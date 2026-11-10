import yippeeSound from "@/assets/yippee.mp3?inline"

const MUTE_STORAGE_KEY = "daa-workspace-muted"
let muted = readMutedPreference()
let audio: HTMLAudioElement | null = null

function readMutedPreference(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function isCelebrationMuted(): boolean {
  return muted
}

export function setCelebrationMuted(nextMuted: boolean) {
  muted = nextMuted
  if (nextMuted && audio) audio.pause()
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, String(nextMuted))
  } catch {
    // Storage may be unavailable in private browsing contexts.
  }
}

/** Plays the Yippee celebration after a fully successful algorithm batch. */
export function playCelebrationSound() {
  if (muted) return

  try {
    audio ??= new Audio(yippeeSound)
    audio.currentTime = 0
    void audio.play().catch((err) => {
      console.error(err)
    })
  } catch (err) {
    console.error(err)
  }
}
