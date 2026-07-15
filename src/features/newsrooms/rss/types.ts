/** A single normalized article from an RSS or Atom feed. */
export interface RssItem {
  /** Stable identifier - the item guid/id, falling back to the link. */
  id: string
  title: string
  link: string
  /** ISO 8601, or undefined when the feed item carries no date. */
  publishedAt?: string
  /** Plain-text deck, HTML stripped and trimmed. */
  description?: string
  /** Lead image URL, when the feed provides one. */
  imageUrl?: string
}
