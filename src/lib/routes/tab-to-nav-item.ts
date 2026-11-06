import {type Events} from '#/analytics/metrics/types'

export type SharedNavTab =
  'Home' | 'Search' | 'Messages' | 'Notifications' | 'MyProfile'

export type SidebarTab =
  SharedNavTab | 'Atmosphere' | 'Feeds' | 'Lists' | 'Bookmarks' | 'Settings'

export const TAB_TO_NAV_ITEM: Record<SidebarTab, Events['nav:click']['item']> =
  {
    Home: 'home',
    Search: 'search',
    Messages: 'chat',
    Notifications: 'notifications',
    MyProfile: 'profile',
    Atmosphere: 'atmosphere',
    Feeds: 'feeds',
    Lists: 'lists',
    Bookmarks: 'saved',
    Settings: 'settings',
  }
