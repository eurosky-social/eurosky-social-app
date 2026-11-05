export type HSV = {h: number; s: number; v: number}

export function normalizeHex(value: string): string | null {
  const hex = value.startsWith('#') ? value.slice(1) : value
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null
}

export function hsvToHex({h, s, v}: HSV): string {
  const chroma = v * s
  const sector = (((h % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((sector % 2) - 1))
  const [r, g, b] =
    sector < 1
      ? [chroma, x, 0]
      : sector < 2
        ? [x, chroma, 0]
        : sector < 3
          ? [0, chroma, x]
          : sector < 4
            ? [0, x, chroma]
            : sector < 5
              ? [x, 0, chroma]
              : [chroma, 0, x]
  return `#${[r, g, b]
    .map(channel =>
      Math.round((channel + v - chroma) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`
}

export function hexToHsv(hex: string): HSV {
  const normalized = normalizeHex(hex) ?? '#000000'
  const r = parseInt(normalized.slice(1, 3), 16) / 255
  const g = parseInt(normalized.slice(3, 5), 16) / 255
  const b = parseInt(normalized.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const hue = !delta
    ? 0
    : max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4
  return {h: (hue * 60 + 360) % 360, s: max ? delta / max : 0, v: max}
}
