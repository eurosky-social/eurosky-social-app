import {useEffect, useRef, useState} from 'react'
import {type RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {RichText} from '#/components/RichText'

/** Keep the video visible, with an explicit way to read a genuinely clipped caption. */
export function ShortsCaption({
  value,
  authorHandle,
}: {
  value: RichTextAPI
  authorHandle: string
}) {
  const {t: l} = useLingui()
  const container = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [clipped, setClipped] = useState(false)
  useEffect(() => {
    const text = container.current?.querySelector<HTMLElement>(
      '[data-testid="shortsCaptionText"]',
    )
    if (!text || expanded) return
    const measure = () => setClipped(text.scrollHeight > text.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(text)
    return () => observer.disconnect()
  }, [value, expanded])
  return (
    <div
      ref={container}
      data-testid="shortsCaption"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}>
      <div
        style={{
          width: '100%',
          maxHeight: expanded ? '35vh' : undefined,
          overflowY: expanded ? 'auto' : undefined,
          overscrollBehavior: 'contain',
        }}>
        <RichText
          testID="shortsCaptionText"
          value={value}
          authorHandle={authorHandle}
          enableTags
          shouldProxyLinks
          numberOfLines={expanded ? undefined : 3}
          selectable={expanded}
          style={[{color: '#fff', fontSize: 14, lineHeight: 21}]}
        />
      </div>
      {(clipped || expanded) && (
        <Button
          testID="shortsCaptionToggle"
          label={expanded ? l`Read less` : l`Read more`}
          color="secondary"
          shape="rectangular"
          size="tiny"
          style={[a.self_start, a.bg_transparent, a.px_0, a.py_xs]}
          hoverStyle={a.bg_transparent}
          onPress={() => setExpanded(value => !value)}>
          <ButtonText style={[a.text_xs, {color: '#fff'}]}>
            {expanded ? <Trans>Less</Trans> : <Trans>More</Trans>}
          </ButtonText>
        </Button>
      )}
    </div>
  )
}

/** Render below playback controls so the fade never dims their labels. */
export function ShortsFade({visible = true}: {visible?: boolean} = {}) {
  return (
    <div
      data-testid="shortsFade"
      style={{
        position: 'absolute',
        inset: '35% 0 0',
        background:
          'linear-gradient(transparent, rgba(0,0,0,.4) 55%, rgba(0,0,0,.8))',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity .2s ease-in-out',
      }}
    />
  )
}
