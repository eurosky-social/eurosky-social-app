import {type ExternalEmbedHandler} from '@social-app-community/embed-kit'

import {AtmoRsvpEmbed} from './AtmoRsvpEmbed'
import {isAtmoRsvpEventUrl} from './detect'

export const atmoRsvpHandler: ExternalEmbedHandler<true> = {
  id: 'atmoRsvp',
  match: ({view}) => (isAtmoRsvpEventUrl(view.uri) ? true : null),
  Component: AtmoRsvpEmbed,
}
