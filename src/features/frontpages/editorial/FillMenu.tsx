import {type AtUriString} from '@atproto/syntax'
import {useLingui} from '@lingui/react/macro'
import {useQuery} from '@tanstack/react-query'

import {STALE} from '#/state/queries'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronIcon} from '#/components/icons/Chevron'
import * as Menu from '#/components/Menu'
import {app} from '#/lexicons'
import {type FillSource, referenceKind} from './curation'

/**
 * Chooses what fills a section after its pinned stories: nothing, the
 * account's own posts, or one of the feeds the editor has pinned.
 */
export function FillMenu({
  value,
  disabled,
  onChange,
}: {
  value: FillSource
  disabled: boolean
  onChange: (value: FillSource) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const client = useAppviewClient()
  const preferences = usePreferencesQuery()
  const current = typeof value === 'object' ? value.feed : undefined
  const uris = [
    ...new Set([
      ...(preferences.data?.savedFeeds ?? [])
        .filter(
          feed =>
            feed.pinned &&
            feed.type === 'feed' &&
            referenceKind(feed.value) === 'feed',
        )
        .map(feed => feed.value),
      ...(current ? [current] : []),
    ]),
  ].slice(0, 25)
  const feeds = useQuery({
    queryKey: createQueryKey('editorialFillFeeds', {uris}),
    staleTime: STALE.MINUTES.FIVE,
    enabled: uris.length > 0,
    queryFn: async () =>
      (
        await client.call(app.bsky.feed.getFeedGenerators, {
          feeds: uris as AtUriString[],
        })
      ).feeds,
  })
  const name = (uri: string) =>
    feeds.data?.find(feed => feed.uri === uri)?.displayName ?? l`Feed`
  const label =
    value === 'none'
      ? l`Don’t fill`
      : value === 'own'
        ? l`Your posts`
        : name(value.feed)
  return (
    <Menu.Root>
      <Menu.Trigger label={l`Fill with: ${label}`}>
        {({props}) => (
          <Button
            {...props}
            testID="frontpageSectionFill"
            label={l`Fill with: ${label}`}
            size="small"
            color="secondary"
            disabled={disabled}
            style={[
              t.atoms.bg,
              a.border,
              t.atoms.border_contrast_low,
              {height: 32},
            ]}>
            <ButtonText style={[a.text_sm]}>{l`Fill: ${label}`}</ButtonText>
            <ButtonIcon icon={ChevronIcon} size="sm" />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          <Menu.Item label={l`Don’t fill`} onPress={() => onChange('none')}>
            <Menu.ItemText>{l`Don’t fill`}</Menu.ItemText>
            <Menu.ItemRadio selected={value === 'none'} />
          </Menu.Item>
          <Menu.Item
            label={l`Fill with your posts`}
            onPress={() => onChange('own')}>
            <Menu.ItemText>{l`Your posts`}</Menu.ItemText>
            <Menu.ItemRadio selected={value === 'own'} />
          </Menu.Item>
        </Menu.Group>
        {uris.length > 0 && (
          <>
            <Menu.Divider />
            <Menu.Group>
              {uris.map(uri => (
                <Menu.Item
                  key={uri}
                  label={l`Fill with posts from ${name(uri)}`}
                  onPress={() => onChange({feed: uri})}>
                  <Menu.ItemText>{name(uri)}</Menu.ItemText>
                  <Menu.ItemRadio selected={current === uri} />
                </Menu.Item>
              ))}
            </Menu.Group>
          </>
        )}
      </Menu.Outer>
    </Menu.Root>
  )
}
