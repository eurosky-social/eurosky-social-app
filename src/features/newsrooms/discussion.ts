/**
 * Where an article's Atmosphere mentions live: a URL search gathers every post
 * that features the piece, whoever posted it. The publisher's canonical post
 * (`anchor`) is reached separately - "Open the thread" links into it, and it
 * seeds the composer via "Join the conversation" and quote-shares.
 */
export function articleSearchPath(url: string): string {
  return `/search?q=${encodeURIComponent(url)}`
}
