/**
 * The accounts whose supplements the news hub lists for everyone, by DID,
 * separated by commas or whitespace. A record lives in its editor's repository
 * and nothing indexes them, so these are the ones a reader finds; an editor
 * always sees their own too.
 */
export const SUPPLEMENT_EDITOR_DIDS = parseDids(
  process.env.EXPO_PUBLIC_SUPPLEMENT_EDITORS,
)

export function parseDids(value: string | undefined): string[] {
  const dids = (value ?? '')
    .split(/[\s,]+/)
    .filter(ref => /^did:[a-z]+:.+/.test(ref))
  return [...new Set(dids)]
}
