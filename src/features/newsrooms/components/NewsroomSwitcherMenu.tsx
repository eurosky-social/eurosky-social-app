import {useLingui} from '@lingui/react/macro'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {Button, ButtonIcon} from '#/components/Button'
import {Earth_Stroke2_Corner2_Rounded as ExploreIcon} from '#/components/icons/Globe'
import {Newspaper2_Stroke2_Corner2_Rounded as NewsroomsIcon} from '#/components/icons/Newspaper2'
import * as Menu from '#/components/Menu'
import {
  getPublisherName,
  NEWSROOM_PUBLISHERS,
  type NewsroomPublisher,
} from '../publishers'
import {useNewsroomProfilesQuery} from '../queries'

/**
 * Switching newsrooms from the screen header. The rail scrolls away with the
 * page, so this keeps every newsroom - and the explore spread - one tap away
 * from anywhere on either hub screen.
 */
export function NewsroomSwitcherMenu({
  selectedId,
  onSelect,
  onSelectExplore,
  exploreActive = false,
}: {
  /** The focused publisher, or none while explore is active. */
  selectedId?: string
  onSelect: (publisher: NewsroomPublisher) => void
  onSelectExplore: () => void
  exploreActive?: boolean
}) {
  const {t: l} = useLingui()
  const profiles = useNewsroomProfilesQuery()

  return (
    <Menu.Root>
      <Menu.Trigger label={l`Switch newsroom`}>
        {({props}) => (
          <Button
            {...props}
            testID="newsroomSwitcherMenuBtn"
            label={l`Switch newsroom`}
            size="small"
            color="secondary"
            shape="round">
            <ButtonIcon icon={NewsroomsIcon} size="md" />
          </Button>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          <Menu.Item label={l`Explore the newsrooms`} onPress={onSelectExplore}>
            <Menu.ItemIcon icon={ExploreIcon} />
            <Menu.ItemText>{l`Explore`}</Menu.ItemText>
            <Menu.ItemRadio selected={exploreActive} />
          </Menu.Item>
        </Menu.Group>
        <Menu.Divider />
        <Menu.Group>
          {NEWSROOM_PUBLISHERS.map(publisher => (
            <Menu.Item
              key={publisher.id}
              label={l`Switch to ${getPublisherName(profiles.get(publisher.did))}`}
              onPress={() => onSelect(publisher)}>
              <UserAvatar
                type="user"
                size={20}
                avatar={profiles.get(publisher.did)?.avatar}
              />
              <Menu.ItemText>
                {getPublisherName(profiles.get(publisher.did))}
              </Menu.ItemText>
              <Menu.ItemRadio selected={publisher.id === selectedId} />
            </Menu.Item>
          ))}
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}
