import {useEffect} from 'react'
import {Trans} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useProfileQuery} from '#/state/queries/profile'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {type Frontpage} from '../frontpages'
import {findPublicationPreview} from '../preview'
import {
  PublicationConversation,
  PublicationScreen,
  PublicationStatus,
} from '../PublicationScreen'
import {NewsroomRightRail} from './NewsroomRightRail'
import {NewsroomSwitcher} from './NewsroomSwitcher'
import {
  getDefaultNewsroomPublisher,
  getNewsroomPublisherByDid,
  getPublisherFeedDids,
  NEWSROOM_PUBLISHERS,
  type NewsroomPublisher,
} from './publishers'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Frontpage'>

/** The original registry and switcher remain; publisher detail rendering is shared with news v2. */
export function NewsroomScreen({route, navigation}: Props) {
  const {name, view} = route.params
  const preview = findPublicationPreview(name)
  const direct = name
    ? findRegisteredPublisher(name)
    : getDefaultNewsroomPublisher()
  const lookUpHandle = !!name && !preview && !direct && !name.startsWith('did:')
  const named = useProfileQuery({did: lookUpHandle ? name : undefined})
  const publisher =
    direct ??
    (named.data ? getNewsroomPublisherByDid(named.data.did) : undefined)
  const publication =
    preview ?? (publisher ? publicationFromPublisher(publisher) : undefined)

  useEffect(() => {
    if (publication && name !== publication.slug)
      navigation.setParams({name: publication.slug})
  }, [name, publication, navigation])

  if (lookUpHandle && named.isLoading)
    return (
      <PublicationStatus>
        <Loader size="xl" />
      </PublicationStatus>
    )
  if (!publication)
    return (
      <PublicationStatus>
        <Text>
          <Trans>There is no newsroom here.</Trans>
        </Text>
      </PublicationStatus>
    )
  return (
    <PublicationScreen
      key={publication.slug}
      publication={publication}
      view={view}
      intro={
        <NewsroomSwitcher
          publishers={NEWSROOM_PUBLISHERS}
          selectedId={publisher?.id ?? ''}
          onSelect={next => {
            navigation.setParams({name: next.id, view: undefined})
            globalThis.scrollTo?.({top: 0})
          }}
        />
      }
      conversation={
        <PublicationConversation
          feed={
            publisher
              ? `frontpage|${getPublisherFeedDids(publisher).join(',')}`
              : `frontpage|${publication.did}`
          }
          context={<NewsroomRightRail inline />}
        />
      }
    />
  )
}

function findRegisteredPublisher(ref: string) {
  return (
    getNewsroomPublisherByDid(ref) ??
    NEWSROOM_PUBLISHERS.find(publisher => publisher.id === ref)
  )
}

function publicationFromPublisher(publisher: NewsroomPublisher): Frontpage {
  return {
    slug: publisher.id,
    did: publisher.did,
    name: publisher.id
      .split('-')
      .map(word => word[0].toUpperCase() + word.slice(1))
      .join(' '),
    country: null,
    domains: publisher.domains,
    themes: {},
    accent: publisher.accent,
    reporterDids: publisher.reporterDids,
  }
}
