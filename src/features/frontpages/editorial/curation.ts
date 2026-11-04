import {isDidString} from '@atproto/lex'
import {z} from 'zod'

import {articleLinkKey} from './articleLinks'

export const FRONTPAGE_COLLECTION = 'social.mu.frontpage'
/** Bounds every list of references a record keeps: pinned stories and settings. */
export const MAX_CURATED_POSTS = 100
export const MAX_SECTIONS = 20
export const MAX_SECTION_LENGTH = 60
/** How many stories a new page's section holds: a full front page of them. */
export const DEFAULT_SECTION_LENGTH = 24
/** How many stories a section added in the editor holds. */
export const NEW_SECTION_LENGTH = 6
export const MAX_SECTION_TITLE = 120
export const MAX_SECTION_DESCRIPTION = 300

export type ArticleSize = 'small' | 'medium' | 'big'
/** How a section lays out its stories: the newspaper grid, or a row of cards that scrolls sideways. */
export type SectionKind = 'grid' | 'carousel'
export type StarterPackViewMode = 'people' | 'posts'
/**
 * What fills a section's room after its pinned stories: nothing, the
 * account's own posts, newest first, or the posts of a feed.
 */
export type FillSource = 'none' | 'own' | {feed: string}

/**
 * A container of stories: its pinned stories first, in order, then as many
 * stories from its fill source as its length leaves room for. Room with
 * nothing to fill it collapses.
 */
export type FrontpageSection = {
  id: string
  /** The grid when unset. A carousel holds posts only. */
  kind?: SectionKind
  /** Untitled sections show no header to readers. */
  title?: string
  description?: string
  fill: FillSource
  pinned: string[]
  /**
   * How many stories it holds, pinned ones included; never fewer than those.
   * The page's last section can be infinite, showing everything its source has.
   */
  length: number | 'infinite'
}

/** How many stories a section has room for. */
export function roomOf(section: Pick<FrontpageSection, 'length'>) {
  return section.length === 'infinite' ? Infinity : section.length
}

export type Curation = {
  /** Whether the account's banner fills the top of the page. */
  cover: boolean
  sections: FrontpageSection[]
  starterPackViews?: {uri: string; view: StarterPackViewMode}[]
  sizes?: {post: string; size: ArticleSize}[]
}

/** A page nobody has arranged: the cover, and one infinite section of the account's newest posts. */
export function defaultCuration(): Curation {
  return {
    cover: true,
    sections: [{id: 'main', fill: 'own', pinned: [], length: 'infinite'}],
  }
}

export function referenceKind(
  uri: string,
): 'article' | 'feed' | 'starterPack' | undefined {
  if (/^at:\/\/did:[^/]+\/app\.bsky\.feed\.post\/[^/]+$/.test(uri))
    return 'article'
  if (/^at:\/\/did:[^/]+\/app\.bsky\.feed\.generator\/[^/]+$/.test(uri))
    return 'feed'
  if (/^at:\/\/did:[^/]+\/app\.bsky\.graph\.starterpack\/[^/]+$/.test(uri))
    return 'starterPack'
}

/** Posts must be the publisher's own; feeds and starter packs may be curated from other creators. */
export function isAllowedSlotUri(uri: string, did: string) {
  const kind = referenceKind(uri)
  if (kind === 'article') return isOwnPostUri(uri, did)
  if (!kind) return false
  const author = uri.slice('at://'.length).split('/')[0]
  if (!isDidString(author)) return false
  const collection =
    kind === 'feed' ? 'app.bsky.feed.generator' : 'app.bsky.graph.starterpack'
  return isOwnPostUri(
    uri.replace(`/${collection}/`, '/app.bsky.feed.post/'),
    author,
  )
}

/** A public layout can only refer to posts belonging to its repository. */
export function isOwnPostUri(uri: string, did: string) {
  const prefix = `at://${did}/app.bsky.feed.post/`
  const rkey = uri.startsWith(prefix) ? uri.slice(prefix.length) : ''
  return /^[A-Za-z0-9._~:-]{1,512}$/.test(rkey) && rkey !== '.' && rkey !== '..'
}

const SECTION_ID = /^[a-z0-9]{1,16}$/

/** A fresh section id: short, and unique enough within one front page. */
export function newSectionId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  ).slice(0, 16)
}

/** Every story the page pins, across its sections. */
export function pinnedUris(curation: Curation) {
  return new Set(curation.sections.flatMap(section => section.pinned))
}

/** The feeds the page fills sections from. */
export function fillFeeds(curation: Curation) {
  return [
    ...new Set(
      curation.sections.flatMap(section =>
        typeof section.fill === 'object' ? [section.fill.feed] : [],
      ),
    ),
  ]
}

function slotUri(did: string) {
  return z
    .string()
    .max(2048)
    .refine(value => isAllowedSlotUri(value, did))
}

function settingsSchemas(did: string) {
  const uri = slotUri(did)
  return {
    starterPackViews: z
      .array(
        z.object({
          uri: uri.refine(value => referenceKind(value) === 'starterPack'),
          view: z.enum(['people', 'posts']),
        }),
      )
      .max(MAX_CURATED_POSTS)
      .refine(
        values =>
          new Set(values.map(value => value.uri)).size === values.length,
      )
      .optional(),
    sizes: z
      .array(z.object({post: uri, size: z.enum(['small', 'medium', 'big'])}))
      .max(MAX_CURATED_POSTS)
      .refine(
        values =>
          new Set(values.map(value => value.post)).size === values.length,
      )
      .optional(),
  }
}

const sectionText = {
  id: z.string().regex(SECTION_ID),
  kind: z.enum(['grid', 'carousel']).optional(),
  title: z.string().trim().min(1).max(MAX_SECTION_TITLE).optional(),
  description: z.string().max(MAX_SECTION_DESCRIPTION).optional(),
}

function pinnedAcross(sections: {pinned: string[]}[]) {
  const pinned = sections.flatMap(section => section.pinned)
  return (
    pinned.length <= MAX_CURATED_POSTS && new Set(pinned).size === pinned.length
  )
}

export function curationRecordSchema(did: string) {
  return z
    .object({
      $type: z.literal(FRONTPAGE_COLLECTION),
      version: z.literal(3),
      cover: z.boolean(),
      sections: z
        .array(
          z
            .object({
              ...sectionText,
              fill: z.union([
                z.enum(['none', 'own']),
                z.object({
                  feed: z
                    .string()
                    .max(2048)
                    .refine(
                      value =>
                        referenceKind(value) === 'feed' &&
                        isAllowedSlotUri(value, did),
                    ),
                }),
              ]),
              pinned: z.array(slotUri(did)).max(MAX_SECTION_LENGTH),
              length: z.union([
                z.number().int().min(1).max(MAX_SECTION_LENGTH),
                z.literal('infinite'),
              ]),
            })
            .refine(
              section =>
                section.pinned.length <= roomOf(section) &&
                (section.kind !== 'carousel' ||
                  section.pinned.every(
                    uri => referenceKind(uri) === 'article',
                  )),
            ),
        )
        .min(1)
        .max(MAX_SECTIONS),
      ...settingsSchemas(did),
      updatedAt: z.string().datetime(),
    })
    .refine(
      value =>
        new Set(value.sections.map(section => section.id)).size ===
          value.sections.length &&
        pinnedAcross(value.sections) &&
        value.sections
          .slice(0, -1)
          .every(section => section.length !== 'infinite'),
    )
}

/**
 * The second record shape: each section a list of slots, pinned or open
 * (`null`) anywhere in it, filled with the account's posts or not at all.
 */
export function slotsRecordSchema(did: string) {
  return z.object({
    $type: z.literal(FRONTPAGE_COLLECTION),
    version: z.literal(2),
    cover: z.boolean(),
    sections: z
      .array(
        z.object({
          ...sectionText,
          fill: z.boolean(),
          slots: z.array(slotUri(did).nullable()).max(MAX_SECTION_LENGTH),
        }),
      )
      .min(1)
      .max(MAX_SECTIONS),
    ...settingsSchemas(did),
  })
}

/** A second-shape record as pinned-first sections of the same length. */
export function fromSlotsRecord(
  record: z.infer<ReturnType<typeof slotsRecordSchema>>,
): Curation {
  const seen = new Set<string>()
  return {
    cover: record.cover,
    sections: record.sections.map(section => {
      const pinned = section.slots.filter(
        (uri): uri is string =>
          uri !== null &&
          !seen.has(uri) &&
          !!seen.add(uri) &&
          (section.kind !== 'carousel' || referenceKind(uri) === 'article'),
      )
      return {
        id: section.id,
        kind: section.kind === 'carousel' ? 'carousel' : undefined,
        title: section.title,
        description: section.description,
        fill: section.fill ? 'own' : 'none',
        pinned,
        length: Math.max(1, pinned.length, section.slots.length),
      }
    }),
    sizes: record.sizes,
    starterPackViews: record.starterPackViews,
  }
}

/**
 * The first record shape: one ordered list of pinned slots, with `section:<id>`
 * headers in it, after which new posts were added without bound.
 */
export function legacyRecordSchema(did: string) {
  const ref = z
    .string()
    .max(2048)
    .refine(
      value =>
        isAllowedSlotUri(value, did) || /^section:[a-z0-9]{1,16}$/.test(value),
    )
  return z.object({
    $type: z.literal(FRONTPAGE_COLLECTION),
    version: z.literal(1),
    sections: z
      .array(
        z.object({
          id: z.string().regex(SECTION_ID),
          title: z.string().trim().min(1).max(MAX_SECTION_TITLE),
          description: z.string().max(MAX_SECTION_DESCRIPTION).optional(),
        }),
      )
      .max(MAX_SECTIONS)
      .optional(),
    cover: z.boolean().optional(),
    latestSection: z.string().regex(SECTION_ID).optional(),
    leadPost: ref.optional(),
    order: z.array(ref).max(MAX_CURATED_POSTS),
    hidden: z.array(slotUri(did)).max(MAX_CURATED_POSTS),
    includeLatest: z.boolean(),
    ...settingsSchemas(did),
  })
}

/**
 * A first-shape record as sections: what came before any header becomes an
 * untitled first section, and the section new posts were added to fills with
 * the account's posts, with room for a page of them.
 */
export function fromLegacyRecord(
  record: z.infer<ReturnType<typeof legacyRecordSchema>>,
): Curation {
  const order = [
    ...new Set([
      ...(record.leadPost ? [record.leadPost] : []),
      ...record.order,
    ]),
  ]
  const groups: FrontpageSection[] = [
    {id: 'main', fill: 'none', pinned: [], length: 1},
  ]
  for (const uri of order) {
    const header = /^section:(.+)$/.exec(uri)?.[1]
    const section = header
      ? record.sections?.find(value => value.id === header)
      : undefined
    if (header) {
      if (section)
        groups.push({
          id: section.id,
          title: section.title,
          description: section.description,
          fill: 'none',
          pinned: [],
          length: 1,
        })
    } else groups[groups.length - 1].pinned.push(uri)
  }
  for (const group of groups) {
    group.pinned = group.pinned.slice(0, MAX_SECTION_LENGTH)
    group.length = Math.max(1, group.pinned.length)
  }
  if (record.includeLatest) {
    const target =
      groups.find(group => group.id === record.latestSection) ?? groups[0]
    target.fill = 'own'
    target.length =
      target === groups[groups.length - 1]
        ? 'infinite'
        : Math.min(
            MAX_SECTION_LENGTH,
            Math.max(DEFAULT_SECTION_LENGTH, target.pinned.length + 10),
          )
  }
  const sections = groups.filter(
    (group, index) => index > 0 || group.fill !== 'none' || group.pinned.length,
  )
  return {
    cover: record.cover ?? false,
    sections: sections.length ? sections : defaultCuration().sections,
    sizes: record.sizes,
    starterPackViews: record.starterPackViews,
  }
}

export type PlacedSlot<T> = {
  story: T
  pinned: boolean
}
export type PlacedSection<T> = {
  section: FrontpageSection
  slots: PlacedSlot<T>[]
}

type Story = {item: {uri: string}; url?: string}

/**
 * The page as readers see it: each section's pinned stories, then stories from
 * its fill source while it has room. Each source is shared down the page in
 * order. Missing and duplicate stories never show, nor does anything but a
 * post in a carousel; pinned stories win over automatic copies of a link.
 */
export function layoutSections<T extends Story>(
  sources: {
    /** The account's posts, newest first, and any pinned post fetched on its own. */
    own: T[]
    /** Pinned feeds and starter packs. */
    resources: T[]
    /** Each fill feed's posts, in its order. */
    feeds?: Record<string, T[]>
  },
  curation: Curation,
): PlacedSection<T>[] {
  const feeds = sources.feeds ?? {}
  const byUri = new Map<string, T>(
    [...sources.own, ...sources.resources, ...Object.values(feeds).flat()].map(
      item => [item.item.uri, item],
    ),
  )
  const pinned = pinnedUris(curation)
  const seen = new Set<string>()
  const claim = (item: T | undefined): item is T => {
    if (!item) return false
    const key = item.url ? articleLinkKey(item.url) : item.item.uri
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
  const shown = curation.sections.map(section =>
    section.pinned.filter(
      uri =>
        (section.kind !== 'carousel' || referenceKind(uri) === 'article') &&
        claim(byUri.get(uri)),
    ),
  )
  const queues = new Map<string, T[]>([
    [
      'own',
      sources.own.filter(
        item =>
          referenceKind(item.item.uri) === 'article' &&
          !pinned.has(item.item.uri),
      ),
    ],
    ...Object.entries(feeds).map(([feed, items]): [string, T[]] => [
      feed,
      items.filter(item => !pinned.has(item.item.uri)),
    ]),
  ])
  return curation.sections.map((section, index) => {
    const slots: PlacedSlot<T>[] = shown[index].map(uri => ({
      story: byUri.get(uri)!,
      pinned: true,
    }))
    const queue =
      section.fill === 'none'
        ? undefined
        : queues.get(section.fill === 'own' ? 'own' : section.fill.feed)
    while (queue?.length && slots.length < roomOf(section)) {
      const story = queue.shift()!
      if (claim(story)) slots.push({story, pinned: false})
    }
    return {section, slots}
  })
}

/** How many of the account's own posts the page's fixed sections have room for. */
export function ownRoom(curation: Curation) {
  return curation.sections
    .filter(section => section.fill === 'own' && section.length !== 'infinite')
    .reduce(
      (count, section) => count + roomOf(section) - section.pinned.length,
      0,
    )
}

/** Whether the page ends in an infinite section of the account's own posts, which loads more on request. */
export function endsWithOwnPosts(curation: Curation) {
  const last = curation.sections[curation.sections.length - 1]
  return last?.length === 'infinite' && last.fill === 'own'
}

function updateSections(
  curation: Curation,
  update: (sections: FrontpageSection[]) => FrontpageSection[],
): Curation {
  const sections = update(
    curation.sections.map(section => ({
      ...section,
      pinned: [...section.pinned],
    })),
  ).map((section, index, all) =>
    /* Only the last section can be infinite; one that no longer is gets a page of room. */
    section.length === 'infinite' && index < all.length - 1
      ? {
          ...section,
          length: Math.max(DEFAULT_SECTION_LENGTH, section.pinned.length),
        }
      : section,
  )
  if (sections.flatMap(section => section.pinned).length > MAX_CURATED_POSTS)
    throw new Error('CurationLimit')
  return {...curation, sections}
}

function findSection(sections: FrontpageSection[], sectionId: string) {
  const section = sections.find(value => value.id === sectionId)
  if (!section) throw new Error('InsertionPointUnavailable')
  return section
}

/**
 * Pins a story in a section at a position among its stories. Among the
 * pinned stories it goes exactly there; further down, it joins the end of
 * them, since automatic stories always follow pinned ones. The section keeps
 * its length, growing only when its pinned stories outgrow it. A story pinned
 * in another section moves, leaving that section's room to its fill source.
 */
export function placeStory(
  curation: Curation,
  uri: string,
  sectionId: string,
  position: number,
): Curation {
  return updateSections(curation, sections => {
    const target = findSection(sections, sectionId)
    if (target.kind === 'carousel' && referenceKind(uri) !== 'article')
      throw new Error('CarouselTakesPosts')
    let at = position
    for (const section of sections) {
      const from = section.pinned.indexOf(uri)
      if (from === -1) continue
      section.pinned.splice(from, 1)
      if (section === target && from < at) at--
    }
    target.pinned.splice(
      Math.max(0, Math.min(at, target.pinned.length)),
      0,
      uri,
    )
    if (target.pinned.length > MAX_SECTION_LENGTH)
      throw new Error('CurationLimit')
    if (target.length !== 'infinite')
      target.length = Math.max(target.length, target.pinned.length)
    return sections
  })
}

/** Pins a story at the end of its section's pinned stories. */
export function pinStory(
  curation: Curation,
  sectionId: string,
  uri: string,
): Curation {
  const section = curation.sections.find(value => value.id === sectionId)
  return placeStory(curation, uri, sectionId, section?.pinned.length ?? 0)
}

/**
 * Unpins a story. A post goes back to the automatic ones; a feed or starter
 * pack leaves the page.
 */
export function unpinStory(curation: Curation, uri: string): Curation {
  return updateSections(curation, sections =>
    sections.map(section => ({
      ...section,
      pinned: section.pinned.filter(value => value !== uri),
    })),
  )
}

/**
 * Ends a section before the story at `position` and moves that story and the
 * rest into a new untitled section below, pinned or automatic as they were and
 * filled the same way, so nothing on the page moves. `pinned` is the story's
 * URI when it is pinned.
 */
export function splitSection(
  curation: Curation,
  sectionId: string,
  position: number,
  pinned?: string,
): Curation {
  if (curation.sections.length >= MAX_SECTIONS) throw new Error('CurationLimit')
  return updateSections(curation, sections => {
    const index = sections.findIndex(section => section.id === sectionId)
    const section = sections[index]
    if (!section || position <= 0 || position >= roomOf(section))
      return sections
    const at = pinned ? section.pinned.indexOf(pinned) : section.pinned.length
    if (at === -1) return sections
    /* Pinned stories that are not showing stay with the first part. */
    const kept = pinned ? at : Math.max(position, section.pinned.length)
    const pinnedRest = section.pinned.slice(at)
    const rest: FrontpageSection = {
      id: newSectionId(),
      kind: section.kind,
      fill: section.fill,
      pinned: pinnedRest,
      length:
        section.length === 'infinite'
          ? 'infinite'
          : Math.max(1, section.length - kept, pinnedRest.length),
    }
    sections.splice(
      index,
      1,
      {
        ...section,
        pinned: section.pinned.slice(0, at),
        length: Math.max(1, kept),
      },
      rest,
    )
    return sections
  })
}

/**
 * Changes how many stories a section holds. It cannot hold fewer than it
 * pins, and only the last section can be infinite.
 */
export function setSectionLength(
  curation: Curation,
  sectionId: string,
  length: number | 'infinite',
): Curation {
  return updateSections(curation, sections =>
    sections.map((section, index) =>
      section.id !== sectionId
        ? section
        : {
            ...section,
            length:
              length === 'infinite'
                ? index === sections.length - 1
                  ? 'infinite'
                  : section.length
                : Math.max(
                    1,
                    section.pinned.length,
                    Math.min(MAX_SECTION_LENGTH, Math.round(length)),
                  ),
          },
    ),
  )
}

export function setSectionFill(
  curation: Curation,
  sectionId: string,
  fill: FillSource,
): Curation {
  return updateSections(curation, sections =>
    sections.map(section =>
      section.id === sectionId ? {...section, fill} : section,
    ),
  )
}

export function updateSection(
  curation: Curation,
  sectionId: string,
  value: {title?: string; description?: string},
): Curation {
  return updateSections(curation, sections =>
    sections.map(section =>
      section.id === sectionId
        ? {...section, title: value.title, description: value.description}
        : section,
    ),
  )
}

/** Turns a section into a carousel or back; a carousel lets go of its feeds and starter packs. */
export function setSectionKind(
  curation: Curation,
  sectionId: string,
  kind: SectionKind,
): Curation {
  return updateSections(curation, sections =>
    sections.map(section =>
      section.id !== sectionId
        ? section
        : {
            ...section,
            kind: kind === 'grid' ? undefined : kind,
            pinned:
              kind === 'carousel'
                ? section.pinned.filter(uri => referenceKind(uri) === 'article')
                : section.pinned,
          },
    ),
  )
}

/** Adds a section after another, or at the top for `null`. */
export function addSection(
  curation: Curation,
  after: string | null,
  value: {title?: string; description?: string; kind?: SectionKind},
): Curation {
  if (curation.sections.length >= MAX_SECTIONS) throw new Error('CurationLimit')
  return updateSections(curation, sections => {
    const at =
      after === null
        ? 0
        : sections.findIndex(section => section.id === after) + 1
    sections.splice(at, 0, {
      id: newSectionId(),
      kind: value.kind === 'carousel' ? 'carousel' : undefined,
      title: value.title,
      description: value.description,
      fill: 'own',
      pinned: [],
      length: NEW_SECTION_LENGTH,
    })
    return sections
  })
}

/** Removes a section and what it pins; a page always keeps one. */
export function removeSection(curation: Curation, sectionId: string) {
  if (curation.sections.length <= 1) return curation
  return updateSections(curation, sections =>
    sections.filter(section => section.id !== sectionId),
  )
}

export function moveSection(
  curation: Curation,
  sectionId: string,
  offset: -1 | 1,
): Curation {
  return updateSections(curation, sections => {
    const from = sections.findIndex(section => section.id === sectionId)
    const to = from + offset
    if (from === -1 || to < 0 || to >= sections.length) return sections
    const [section] = sections.splice(from, 1)
    sections.splice(to, 0, section)
    return sections
  })
}

export function setCover(curation: Curation, cover: boolean): Curation {
  return {...curation, cover}
}

/**
 * A pattern of sizes for stories the owner has not sized: a lead with
 * companions, pairs, a wide feature and a reversed split.
 */
const SIZES: ArticleSize[] = [
  'medium',
  'small',
  'small',
  'small',
  'small',
  'big',
  'small',
  'medium',
  'small',
  'small',
  'medium',
  'small',
  'small',
  'big',
]

/** A story's size: the owner's choice, or its place in the section's pattern. The page's lead is never small. */
export function articleSize(
  curation: Curation,
  uri: string,
  lead: boolean,
  position = 0,
): ArticleSize {
  const size =
    curation.sizes?.find(value => value.post === uri)?.size ??
    SIZES[position % SIZES.length]
  return lead ? (size === 'big' ? 'big' : 'medium') : size
}

export function setArticleSize(
  curation: Curation,
  uri: string,
  size: ArticleSize,
): Curation {
  const sizes = [
    ...(curation.sizes ?? []).filter(value => value.post !== uri),
    {post: uri, size},
  ]
  if (sizes.length > MAX_CURATED_POSTS) throw new Error('CurationLimit')
  return {...curation, sizes}
}

export function starterPackView(
  curation: Curation,
  uri: string,
): StarterPackViewMode {
  return (
    curation.starterPackViews?.find(value => value.uri === uri)?.view ??
    'people'
  )
}

export function setStarterPackView(
  curation: Curation,
  uri: string,
  view: StarterPackViewMode,
): Curation {
  const views = [
    ...(curation.starterPackViews ?? []).filter(value => value.uri !== uri),
    {uri, view},
  ]
  if (views.length > MAX_CURATED_POSTS) throw new Error('CurationLimit')
  return {...curation, starterPackViews: views}
}
