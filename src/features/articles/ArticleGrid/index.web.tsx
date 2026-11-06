import {Children} from 'react'

import {useTheme} from '#/alf'
import {articleBands} from './layout'
import {type ArticleGridItemProps, type ArticleGridProps} from './types'

/** Keep two-story rows alongside the wider, asymmetric newspaper bands. */
export function ArticleGrid({
  children,
  wide,
  sizes,
  renderInsert,
}: ArticleGridProps) {
  const t = useTheme()
  const stories = Children.toArray(children)
  const rule = `1px solid ${t.atoms.border_contrast_low.borderColor}`
  if (!wide)
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingTop: 20,
        }}>
        {stories.map((story, index) => (
          <div
            key={index}
            style={{
              position: 'relative',
              minWidth: 0,
              paddingBottom: 24,
              borderBottom: rule,
            }}>
            {renderInsert?.(index, false)}
            {story}
          </div>
        ))}
      </div>
    )
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        paddingTop: 20,
      }}>
      {articleBands(sizes).map(band => {
        const main = (
          <div style={{position: 'relative', minWidth: 0}}>
            {renderInsert?.(band.main, !!band.reversed)}
            {stories[band.main]}
          </div>
        )
        const aside = !!band.aside.length && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              minWidth: 0,
              ...(band.reversed
                ? {paddingRight: 24, borderRight: rule}
                : {paddingLeft: 24, borderLeft: rule}),
            }}>
            {band.aside.map((index, position) => (
              <div
                key={index}
                style={{
                  minWidth: 0,
                  ...(position > 0 ? {borderTop: rule, paddingTop: 24} : {}),
                }}>
                <div style={{position: 'relative', minWidth: 0}}>
                  {renderInsert?.(index, !band.reversed && position === 0)}
                  {stories[index]}
                </div>
              </div>
            ))}
          </div>
        )
        return (
          <div
            key={band.main}
            data-article-band
            style={{
              display: 'grid',
              gridTemplateColumns: band.columns,
              gap: 24,
              alignItems: 'start',
              paddingBottom: 24,
              borderBottom: rule,
            }}>
            {band.reversed ? (
              <>
                {aside}
                {main}
              </>
            ) : (
              <>
                {main}
                {aside}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function ArticleGridItem({children, size}: ArticleGridItemProps) {
  return (
    <div data-article-size={size} style={{minWidth: 0}}>
      {children}
    </div>
  )
}
