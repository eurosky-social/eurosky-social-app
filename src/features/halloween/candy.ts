/** Bright candy colors chosen for the true-dark Halloween background. */
export const CANDY_COLORS = [
  '#FF9F43',
  '#C084FC',
  '#F472B6',
  '#A3E635',
  '#67E8F9',
  '#FACC15',
  '#FB7185',
] as const

/** FNV-1a over the full URI keeps a post's candy stable across clients/reloads. */
export function getCandyColor(postUri: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < postUri.length; index++) {
    hash ^= postUri.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return CANDY_COLORS[(hash >>> 0) % CANDY_COLORS.length]
}
