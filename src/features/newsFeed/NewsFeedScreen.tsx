import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {NewsFeedTab} from './components/NewsFeedTab'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'NewsFeed'>

/**
 * The hub's Latest tab. Its accounts come from the reader's interests, which
 * are set in the news settings (`/news/settings`) like the News tab's.
 */
export function NewsFeedScreen({}: Props) {
  return <NewsFeedTab />
}
