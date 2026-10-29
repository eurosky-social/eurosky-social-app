import {useEffect} from 'react'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useProfileQuery} from '#/state/queries/profile'
import {Button, ButtonText} from '#/components/Button'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {FrontpageArticles} from './components/FrontpageArticles'
import {FrontpageMasthead} from './components/FrontpageMasthead'
import {FrontpageRightRail} from './components/FrontpageRightRail'
import {
  findFrontpage,
  type Frontpage,
  useFrontpageReporters,
  useFrontpages,
} from './frontpages'
import {findPublicationPreview} from './preview'
import {
  PublicationConversation,
  PublicationScreen,
  PublicationStatus,
} from './PublicationScreen'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Frontpage'>

/** Aggregator outlet lookup is independent of the shared editorial publication renderer. */
export function FrontpageScreen({route, navigation}: Props) {
  const {name, view} = route.params
  const {t: l} = useLingui()
  const preview = findPublicationPreview(name)
  const registry = useFrontpages({enabled: !preview})
  const direct = preview ?? findFrontpage(registry.frontpages, name)
  const lookUpHandle =
    !!name && !!registry.frontpages && !direct && !name.startsWith('did:')
  const named = useProfileQuery({did: lookUpHandle ? name : undefined})
  const publication =
    direct ??
    (named.data
      ? findFrontpage(registry.frontpages, named.data.did)
      : undefined)
  const resolving =
    !preview && (registry.isLoading || (lookUpHandle && named.isLoading))

  useEffect(() => {
    if (publication && name !== publication.slug)
      navigation.setParams({name: publication.slug})
  }, [name, publication, navigation])
  useEffect(() => {
    if (!name) navigation.replace('OutletDirectory')
  }, [name, navigation])

  if (resolving || !name)
    return (
      <PublicationStatus>
        <Loader size="xl" />
      </PublicationStatus>
    )
  if (!preview && registry.isError)
    return (
      <PublicationStatus>
        <Text>
          <Trans>Couldn’t load publications.</Trans>
        </Text>
        <Button
          label={l`Try again`}
          size="small"
          color="secondary"
          onPress={() => void registry.refetch()}>
          <ButtonText>
            <Trans>Try again</Trans>
          </ButtonText>
        </Button>
      </PublicationStatus>
    )
  if (!publication)
    return (
      <PublicationStatus>
        <Text>
          <Trans>There is no frontpage here.</Trans>
        </Text>
        <Link
          to="/outlets"
          label={l`All outlets`}
          size="small"
          color="secondary">
          <ButtonText>
            <Trans>All outlets</Trans>
          </ButtonText>
        </Link>
      </PublicationStatus>
    )
  return (
    <PublicationScreen
      key={publication.slug}
      publication={publication}
      view={view}
      conversation={<AggregatorConversation publication={publication} />}
      accountless={
        <>
          <FrontpageMasthead frontpage={publication} />
          <FrontpageArticles frontpage={publication} />
        </>
      }
    />
  )
}

function AggregatorConversation({publication}: {publication: Frontpage}) {
  const {conversationDids, isLoading} = useFrontpageReporters(publication)
  return (
    <PublicationConversation
      pending={isLoading}
      feed={
        conversationDids.length
          ? `frontpage|${conversationDids.join(',')}`
          : undefined
      }
      context={<FrontpageRightRail inline />}
    />
  )
}
