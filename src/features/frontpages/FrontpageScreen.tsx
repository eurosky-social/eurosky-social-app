import {useEffect} from 'react'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {Button, ButtonText} from '#/components/Button'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {FrontpageArticles} from './components/FrontpageArticles'
import {FrontpageMasthead} from './components/FrontpageMasthead'
import {FrontpageRightRail} from './components/FrontpageRightRail'
import {type Frontpage, useFrontpage, useFrontpageReporters} from './frontpages'
import {
  PublicationConversation,
  PublicationLoading,
  PublicationScreen,
  PublicationStatus,
} from './PublicationScreen'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Frontpage'>

/**
 * News v2 publication lookup: a DID or handle opens the account's frontpage
 * directly, a slug one of the aggregator's outlets. Independent of the shared
 * editorial publication renderer.
 */
export function FrontpageScreen({route, navigation}: Props) {
  const {name, view} = route.params
  const {t: l} = useLingui()
  const {
    frontpage: publication,
    isLoading,
    isError,
    refetch,
  } = useFrontpage(name)

  useEffect(() => {
    if (!name) navigation.replace('OutletDirectory')
  }, [name, navigation])

  if (isLoading || !name) return <PublicationLoading view={view} />
  if (isError)
    return (
      <PublicationStatus>
        <Text>
          <Trans>Couldn’t load this publication.</Trans>
        </Text>
        <Button
          label={l`Try again`}
          size="small"
          color="secondary"
          onPress={() => void refetch()}>
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
