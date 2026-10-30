const MAX_U64 = 18_446_744_073_709_551_615n

export function validateSeed(value: string): string | null {
  const seed = value.trim()

  if (!seed) return "Enter a base seed."
  if (!/^\d+$/.test(seed)) return "Use a whole, non-negative number."
  if (seed.length > 20 || BigInt(seed) > MAX_U64) {
    return "The seed must fit in an unsigned 64-bit integer."
  }

  return null
}
