import {z} from 'zod'

import {articleLinkKey} from '#/features/frontpages/editorial/articleLinks'
import {type DutchArticle} from '#/features/news/dutch/types'

export const SUPPLEMENT_COLLECTION = 'social.mu.supplement'
export const MAX_SUPPLEMENT_ITEMS = 100
export const MAX_TITLE_LENGTH = 120
const MAX_ARTICLE_TITLE_LENGTH = 300
const MAX_SUMMARY_LENGTH = 500
const MAX_NAME_LENGTH = 100

function isHttpUrl(value: string) {
  try {
    const {protocol} = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** A calendar day that exists: `Date` rolls 2026-02-31 over to March. */
function isDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

const dayField = z.string().refine(isDay)
const urlField = z.string().max(2048).refine(isHttpUrl)

const articleSchema = z.object({
  url: urlField,
  title: z.string().min(1).max(MAX_ARTICLE_TITLE_LENGTH),
  summary: z.string().max(MAX_SUMMARY_LENGTH).optional(),
  imageUrl: urlField.optional(),
  publishedAt: z.string().optional(),
  outlet: z.object({
    name: z.string().min(1).max(MAX_NAME_LENGTH),
    slug: z.string().max(64).optional(),
    did: z.string().optional(),
  }),
})

export const supplementSchema = z
  .object({
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    topic: z.object({
      slug: z
        .string()
        .regex(/^[a-z][a-z0-9-]*$/)
        .max(40),
      name: z.string().min(1).max(MAX_NAME_LENGTH),
    }),
    startDate: dayField,
    endDate: dayField.optional(),
    items: z.array(articleSchema).max(MAX_SUPPLEMENT_ITEMS),
  })
  .refine(({startDate, endDate}) => !endDate || endDate >= startDate)
  .refine(
    ({items}) =>
      new Set(items.map(item => articleLinkKey(item.url))).size ===
      items.length,
  )

export const supplementRecordSchema = z.intersection(
  supplementSchema,
  z.object({
    $type: z.literal(SUPPLEMENT_COLLECTION),
    version: z.literal(1),
    updatedAt: z.string(),
  }),
)

export type Supplement = z.infer<typeof supplementSchema>
export type SupplementArticle = Supplement['items'][number]
export type SupplementTopic = Supplement['topic']

/** A supplement being edited: nothing is required until it is published. */
export type SupplementDraft = {
  title: string
  topic?: SupplementTopic
  startDate: string
  /** Empty when it has no end. */
  endDate: string
  items: SupplementArticle[]
}

export type DraftProblem = 'title' | 'topic' | 'startDate' | 'endDate'

export function emptyDraft(today: string): SupplementDraft {
  return {title: '', startDate: today, endDate: '', items: []}
}

export function draftFrom(supplement: Supplement): SupplementDraft {
  return {...supplement, endDate: supplement.endDate ?? ''}
}

/** What stands between a draft and publishing it, in the form's order. */
export function draftProblems(draft: SupplementDraft): DraftProblem[] {
  const problems: DraftProblem[] = []
  const title = draft.title.trim()
  if (!title || title.length > MAX_TITLE_LENGTH) problems.push('title')
  if (!draft.topic) problems.push('topic')
  if (!isDay(draft.startDate)) problems.push('startDate')
  if (
    draft.endDate &&
    (!isDay(draft.endDate) || draft.endDate < draft.startDate)
  )
    problems.push('endDate')
  return problems
}

/** Undefined while the draft has problems (see `draftProblems`). */
export function supplementFromDraft(
  draft: SupplementDraft,
): Supplement | undefined {
  const parsed = supplementSchema.safeParse({
    title: draft.title,
    topic: draft.topic,
    startDate: draft.startDate,
    endDate: draft.endDate || undefined,
    items: draft.items,
  })
  return parsed.success ? parsed.data : undefined
}

// ---- dates

export type SupplementStatus = 'upcoming' | 'current' | 'archived'

/** The reader's calendar day as `YYYY-MM-DD`, not the day in UTC. */
export function localDay(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Archiving follows from the dates, so nothing has to run at the end date: a
 * supplement is current through its last day and archived from the day after.
 * Extending the end date brings it back. `YYYY-MM-DD` compares as text.
 */
export function supplementStatus(
  supplement: Pick<Supplement, 'startDate' | 'endDate'>,
  today: string,
): SupplementStatus {
  if (today < supplement.startDate) return 'upcoming'
  if (supplement.endDate && today > supplement.endDate) return 'archived'
  return 'current'
}

/**
 * The list a reader sees. An upcoming supplement is its editor's alone until
 * it starts. Current ones start with the newest; the archive with the latest
 * to end.
 */
export function groupSupplements<
  T extends {did: string; supplement: Supplement},
>(all: T[], today: string, viewerDid: string | undefined) {
  const byStatus = (status: SupplementStatus) =>
    all.filter(({supplement}) => supplementStatus(supplement, today) === status)
  return {
    upcoming: byStatus('upcoming')
      .filter(({did}) => did === viewerDid)
      .sort((a, b) =>
        a.supplement.startDate.localeCompare(b.supplement.startDate),
      ),
    current: byStatus('current').sort((a, b) =>
      b.supplement.startDate.localeCompare(a.supplement.startDate),
    ),
    archived: byStatus('archived').sort((a, b) =>
      (b.supplement.endDate ?? '').localeCompare(a.supplement.endDate ?? ''),
    ),
  }
}

// ---- items

export function hasArticle(items: SupplementArticle[], url: string) {
  const key = articleLinkKey(url)
  return items.some(item => articleLinkKey(item.url) === key)
}

/** At the end; an article it already has, or one too many, changes nothing. */
export function addArticle(
  items: SupplementArticle[],
  article: SupplementArticle,
): SupplementArticle[] {
  if (items.length >= MAX_SUPPLEMENT_ITEMS || hasArticle(items, article.url))
    return items
  return [...items, article]
}

export function removeArticle(items: SupplementArticle[], url: string) {
  return items.filter(item => item.url !== url)
}

/** One place up or down; past either end it stays where it is. */
export function moveArticle(
  items: SupplementArticle[],
  url: string,
  by: -1 | 1,
): SupplementArticle[] {
  const from = items.findIndex(item => item.url === url)
  const to = from + by
  if (from < 0 || to < 0 || to >= items.length) return items
  const next = [...items]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

function hostOf(url: string) {
  return new URL(url).hostname.replace(/^www\./, '')
}

/**
 * An article of the news aggregator, as a supplement keeps it. Undefined for
 * one without a headline or a web address, which could not be shown or opened.
 */
export function articleFromAggregator(
  article: DutchArticle,
): SupplementArticle | undefined {
  const title = article.title?.trim()
  if (!title || !isHttpUrl(article.uri)) return undefined
  const summary = article.summary?.trim()
  const {outlet} = article
  return {
    url: article.uri,
    title: truncate(title, MAX_ARTICLE_TITLE_LENGTH),
    ...(summary ? {summary: truncate(summary, MAX_SUMMARY_LENGTH)} : {}),
    ...(article.imageUrl && isHttpUrl(article.imageUrl)
      ? {imageUrl: article.imageUrl}
      : {}),
    publishedAt: article.publishedAt,
    outlet: {
      name: truncate(outlet?.name || hostOf(article.uri), MAX_NAME_LENGTH),
      ...(outlet?.slug ? {slug: outlet.slug} : {}),
      ...(outlet?.did ? {did: outlet.did} : {}),
    },
  }
}

/** An article the aggregator does not hold, from its address and headline. */
export function articleFromLink(
  url: string,
  title: string,
): SupplementArticle | undefined {
  const address = url.trim()
  const headline = title.trim()
  if (!headline || !isHttpUrl(address)) return undefined
  return {
    url: address,
    title: truncate(headline, MAX_ARTICLE_TITLE_LENGTH),
    outlet: {name: truncate(hostOf(address), MAX_NAME_LENGTH)},
  }
}
