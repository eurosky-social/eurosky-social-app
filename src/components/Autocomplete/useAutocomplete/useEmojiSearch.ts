import {useCallback} from 'react'
import {type Emoji, type EmojiMartData} from '@emoji-mart/data'
import Fuse from 'fuse.js'

import {useGetEmojis} from '#/lib/useGetEmojis'
import {type AutocompleteEmoji} from '#/components/Autocomplete/types'

/*
 * Lazily loaded Fuse instance for emoji search. Built once on first search,
 * then reused for all subsequent searches.
 */
let emojiFuseInstance: Fuse<Emoji> | null = null

export type EmojiSearch = (
  query: string,
  limit?: number,
  exactOnly?: boolean,
) => Promise<AutocompleteEmoji[]>

/** Resolves a canonical emoji ID or alias without fuzzy matching. */
export function findExactEmoji(
  data: Pick<EmojiMartData, 'emojis' | 'aliases'>,
  query: string,
): Emoji | undefined {
  const normalizedQuery = query.toLowerCase()
  const directEmoji = data.emojis[normalizedQuery]
  if (directEmoji?.id === normalizedQuery) return directEmoji

  const aliasId = data.aliases[normalizedQuery]
  return typeof aliasId === 'string' ? data.emojis[aliasId] : undefined
}

function toAutocompleteEmoji(emoji: Emoji): AutocompleteEmoji {
  return {
    key: emoji.id,
    type: 'emoji',
    value: emoji.skins[0].native,
    emoji,
  }
}

export function useEmojiSearch(): EmojiSearch {
  const getEmojis = useGetEmojis()

  return useCallback(
    async (query: string, limit: number = 8, exactOnly: boolean = false) => {
      const data = await getEmojis()
      const exactEmoji = findExactEmoji(data, query)

      if (exactOnly) {
        return exactEmoji ? [toAutocompleteEmoji(exactEmoji)] : []
      }

      if (!emojiFuseInstance) {
        emojiFuseInstance = new Fuse(Object.values(data.emojis), {
          keys: ['id', 'name', 'keywords'],
          threshold: 0.3,
        })
      }

      const results = emojiFuseInstance
        .search(query, {limit})
        .map(result => result.item)
        .filter(emoji => emoji.id !== exactEmoji?.id)

      if (exactEmoji) results.unshift(exactEmoji)

      return results.slice(0, limit).map(toAutocompleteEmoji)
    },
    [getEmojis],
  )
}
