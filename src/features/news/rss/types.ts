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
  /**
   * The publisher's own section labels for the item (`<category>` in RSS,
   * `<category term>` in Atom). Free-form per outlet - the explore page maps
   * them onto its shared sections rather than showing them raw.
   */
  categories?: string[]
}
