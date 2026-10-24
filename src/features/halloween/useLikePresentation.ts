import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {useTheme} from '#/alf'
import {getCandyColor} from '#/features/halloween/candy'
import {candyIcons} from '#/features/halloween/CandyIcon'
import {useHalloween} from '#/features/halloween/context'
import {isCostumePost} from '#/features/halloween/costumes/records'

/** Cosmetic only: candy uses the same likes, counts, and mutations as hearts. */
export function useLikePresentation({
  uri,
  isLiked,
  likeCount,
  record,
}: {
  uri: string
  isLiked: boolean
  likeCount: number
  record?: unknown
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {isHalloween} = useHalloween()
  const isCandy = isHalloween && isCostumePost(record)
  const color = isCandy ? getCandyColor(uri) : t.palette.pink
  const label = isCandy
    ? isLiked
      ? l({
          message: `Take back candy (${plural(likeCount, {
            one: '# candy',
            other: '# candies',
          })})`,
          comment:
            'Halloween unlike button: removes your normal like. Count is the total likes on the post, presented as candies.',
        })
      : l({
          message: `Give candy (${plural(likeCount, {
            one: '# candy',
            other: '# candies',
          })})`,
          comment:
            'Halloween like button: adds a normal like. Count is the total likes on the post, presented as candies.',
        })
    : isLiked
      ? l({
          message: `Unlike (${plural(likeCount, {
            one: '# like',
            other: '# likes',
          })})`,
          comment: 'Like button, liked state: action followed by total likes.',
        })
      : l({
          message: `Like (${plural(likeCount, {
            one: '# like',
            other: '# likes',
          })})`,
          comment:
            'Like button, unliked state: action followed by total likes.',
        })

  return {
    label,
    activeColor: color,
    iconProps: {
      icons: isCandy ? candyIcons : undefined,
      color,
    },
  }
}
