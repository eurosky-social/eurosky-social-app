import {type MessageDescriptor} from '@lingui/core'
import {msg} from '@lingui/core/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {type SidebarTab} from '#/lib/routes/tab-to-nav-item'
import {
  type CommonNavigationDestination,
  type FlatNavigatorParams,
} from '#/lib/routes/types'
import {type SessionAccount} from '#/state/session'
import {
  Bell_Filled_Corner0_Rounded as BellFilled,
  Bell_Stroke2_Corner0_Rounded as Bell,
} from '#/components/icons/Bell'
import {
  Bookmark_Filled_Corner0_Rounded as BookmarkFilled,
  Bookmark_Stroke2_Corner0_Rounded as Bookmark,
} from '#/components/icons/Bookmark'
import {
  BulletList_Filled_Corner0_Rounded as ListFilled,
  BulletList_Stroke2_Corner0_Rounded as List,
} from '#/components/icons/BulletList'
import {type Props as IconProps} from '#/components/icons/common'
import {Earth_Stroke2_Corner0_Rounded as Earth} from '#/components/icons/Earth'
import {
  Hashtag_Filled_Corner0_Rounded as HashtagFilled,
  Hashtag_Stroke2_Corner0_Rounded as Hashtag,
} from '#/components/icons/Hashtag'
import {
  HomeOpen_Filled_Corner0_Rounded as HomeFilled,
  HomeOpen_Stroke2_Corner0_Rounded as Home,
} from '#/components/icons/Home'
import {
  MagnifyingGlass_Filled_Stroke2_Corner0_Rounded as SearchFilled,
  MagnifyingGlass_Stroke2_Corner0_Rounded as Search,
} from '#/components/icons/MagnifyingGlass'
import {
  Message_Stroke2_Corner0_Rounded as Message,
  Message_Stroke2_Corner0_Rounded_Filled as MessageFilled,
} from '#/components/icons/Message'
import {
  Newspaper_Filled_Corner2_Rounded as NewsFilled,
  Newspaper_Stroke2_Corner2_Rounded as News,
} from '#/components/icons/Newspaper'
import {
  SettingsGear2_Filled_Corner0_Rounded as SettingsFilled,
  SettingsGear2_Stroke2_Corner0_Rounded as Settings,
} from '#/components/icons/Settings'
import {
  UserCircle_Filled_Corner0_Rounded as ProfileFilled,
  UserCircle_Stroke2_Corner0_Rounded as Profile,
} from '#/components/icons/UserCircle'
import {type Events} from '#/analytics/metrics/types'
import {type NavigationId} from '#/config/navigation'

export type NavigationDestination = {
  id: NavigationId
  label: MessageDescriptor
  /** Preserve the shorter Search label in the bottom bar. */
  bottomLabel?: MessageDescriptor
  href: string
  routes: readonly (keyof FlatNavigatorParams | 'MyProfile')[]
  icons: {
    inactive: React.ComponentType<IconProps>
    active: React.ComponentType<IconProps>
  }
  metricItem: Events['nav:click']['item']
  public?: boolean
  feature?: 'atmosphere'
  capability?: 'messaging' | 'bookmarking'
} & (
  | {tab: SidebarTab; target?: never}
  | {tab?: never; target: CommonNavigationDestination}
)

/** Add page metadata here, not in each shell. Route registration stays explicit. */
export function getNavigationDestinations({
  account,
  newsV2,
}: {
  account?: Pick<SessionAccount, 'handle' | 'did'>
  newsV2: boolean
}): Record<NavigationId, NavigationDestination> {
  return {
    home: {
      id: 'home',
      label: msg`Home`,
      href: '/',
      routes: ['Home'],
      icons: {inactive: Home, active: HomeFilled},
      metricItem: 'home',
      tab: 'Home',
      public: true,
    },
    news: {
      id: 'news',
      label: msg`News`,
      href: newsV2 ? '/news/explore' : '/news',
      routes: newsV2
        ? [
            'NewsExplore',
            'NewsFeed',
            'NewsSettings',
            'NewsOutlets',
            'OutletDirectory',
            'Frontpage',
            'NewsArticle',
          ]
        : ['NewsFeed'],
      icons: {inactive: News, active: NewsFilled},
      metricItem: 'news',
      target: {name: newsV2 ? 'NewsExplore' : 'NewsFeed', params: undefined},
    },
    publisher: {
      id: 'publisher',
      label: msg`Publisher`,
      href: '/publishers',
      routes: ['PublisherDirectory', 'Publisher'],
      icons: {inactive: News, active: NewsFilled},
      metricItem: 'publisher',
      public: true,
      target: {name: 'PublisherDirectory', params: undefined},
    },
    search: {
      id: 'search',
      label: msg`Explore`,
      bottomLabel: msg`Search`,
      href: '/search',
      routes: ['Search'],
      icons: {inactive: Search, active: SearchFilled},
      metricItem: 'search',
      tab: 'Search',
      public: true,
    },
    notifications: {
      id: 'notifications',
      label: msg`Notifications`,
      href: '/notifications',
      routes: ['Notifications'],
      icons: {inactive: Bell, active: BellFilled},
      metricItem: 'notifications',
      tab: 'Notifications',
    },
    atmosphere: {
      id: 'atmosphere',
      label: msg`Atmosphere`,
      href: '/atmosphere',
      routes: ['Atmosphere'],
      icons: {inactive: Earth, active: Earth},
      metricItem: 'atmosphere',
      tab: 'Atmosphere',
      feature: 'atmosphere',
    },
    chat: {
      id: 'chat',
      label: msg`Chat`,
      href: '/messages',
      routes: ['Messages'],
      icons: {inactive: Message, active: MessageFilled},
      metricItem: 'chat',
      tab: 'Messages',
      capability: 'messaging',
    },
    feeds: {
      id: 'feeds',
      label: msg`Feeds`,
      href: '/feeds',
      routes: ['Feeds'],
      icons: {inactive: Hashtag, active: HashtagFilled},
      metricItem: 'feeds',
      tab: 'Feeds',
      public: true,
    },
    lists: {
      id: 'lists',
      label: msg`Lists`,
      href: '/lists',
      routes: ['Lists'],
      icons: {inactive: List, active: ListFilled},
      metricItem: 'lists',
      tab: 'Lists',
    },
    saved: {
      id: 'saved',
      label: msg({message: 'Saved', context: 'link to bookmarks screen'}),
      href: '/saved',
      routes: ['Bookmarks'],
      capability: 'bookmarking',
      icons: {inactive: Bookmark, active: BookmarkFilled},
      metricItem: 'saved',
      tab: 'Bookmarks',
    },
    profile: {
      id: 'profile',
      label: msg`Profile`,
      href: account ? makeProfileLink(account) : '/profile/me',
      routes: ['Profile', 'MyProfile'],
      icons: {inactive: Profile, active: ProfileFilled},
      metricItem: 'profile',
      tab: 'MyProfile',
    },
    settings: {
      id: 'settings',
      label: msg`Settings`,
      href: '/settings',
      routes: ['Settings'],
      icons: {inactive: Settings, active: SettingsFilled},
      metricItem: 'settings',
      tab: 'Settings',
    },
  }
}
