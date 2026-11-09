import {useState} from 'react'
import {View} from 'react-native'
import {type DidString} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {useExploreSpread} from '#/features/news/explore/components/ExploreColumn'
import {Rows, SupplementCard} from './components'
import {useSupplementsQuery} from './state'
import {groupSupplements, localDay} from './supplement'

/**
 * An account's supplements, on its frontpage: where readers find them. Current
 * ones show, the archive opens on request, and upcoming ones show to their
 * editor alone, with **New supplement**. A reader sees nothing while they load,
 * when they fail, or when there are none: the frontpage is about its stories.
 */
export function FrontpageSupplements({
  did,
  isOwner,
}: {
  did: DidString
  isOwner: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {wide} = useExploreSpread()
  const {gtMobile} = useBreakpoints()
  const [showArchive, setShowArchive] = useState(false)
  const query = useSupplementsQuery(did)
  const {upcoming, current, archived} = groupSupplements(
    query.data ?? [],
    localDay(),
    isOwner ? did : undefined,
  )
  const shown = [...upcoming, ...current]
  const columns = wide ? 3 : gtMobile ? 2 : 1

  if (!isOwner && !shown.length && !archived.length) return null

  return (
    <View
      testID="frontpageSupplements"
      style={[a.gap_md, a.py_lg, a.border_b, t.atoms.border_contrast_low]}>
      <View style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_md]}>
        <Text
          accessibilityRole="header"
          style={[a.flex_1, a.text_xl, a.font_bold]}>
          <Trans context="A frontpage's section of supplements">
            Supplements
          </Trans>
        </Text>
        {isOwner && (
          <Link
            testID="supplementNew"
            to="/news/supplements/new"
            label={l`New supplement`}
            size="small"
            color="secondary">
            <ButtonIcon icon={PlusIcon} />
            <ButtonText>
              <Trans>New supplement</Trans>
            </ButtonText>
          </Link>
        )}
      </View>

      {shown.length > 0 && (
        <Rows items={shown} columns={columns} keyOf={({rkey}) => rkey}>
          {stored => <SupplementCard stored={stored} />}
        </Rows>
      )}
      {isOwner && !shown.length && !archived.length && !query.isLoading && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {query.isError ? (
            <Trans>Couldn’t load your supplements.</Trans>
          ) : (
            <Trans>
              Supplements gather coverage of a temporary theme, such as an
              election, and show here.
            </Trans>
          )}
        </Text>
      )}

      {archived.length > 0 && (
        <Button
          testID="frontpageSupplementsArchive"
          label={
            showArchive
              ? l`Hide archived supplements`
              : l`Show archived supplements`
          }
          size="small"
          variant="ghost"
          color="secondary"
          onPress={() => setShowArchive(open => !open)}
          style={[a.self_start]}>
          <ButtonText>
            {showArchive ? (
              <Trans>Hide archived supplements</Trans>
            ) : (
              <Trans>Show archived supplements ({archived.length})</Trans>
            )}
          </ButtonText>
        </Button>
      )}
      {showArchive && archived.length > 0 && (
        <Rows items={archived} columns={columns} keyOf={({rkey}) => rkey}>
          {stored => <SupplementCard stored={stored} />}
        </Rows>
      )}
    </View>
  )
}
