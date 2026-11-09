import {useLingui} from '@lingui/react/macro'

import {Clock_Stroke2_Corner0_Rounded as ClockIcon} from '#/components/icons/Clock'
import {Trending2_Stroke2_Corner2_Rounded as TrendingIcon} from '#/components/icons/Trending'
import * as Menu from '#/components/Menu'
import {type ExploreSort} from '../sort'
import {PickerButton, PickerItem} from './ExploreLocationPicker'

/**
 * Whether the spread leads with the top stories or the newest. Like the
 * location, the choice lives only on the page and is not saved.
 */
export function ExploreSortPicker({
  selected,
  onSelect,
}: {
  selected: ExploreSort
  onSelect: (sort: ExploreSort) => void
}) {
  const {t: l} = useLingui()
  const names: Record<ExploreSort, string> = {
    top: l({message: 'Top', context: 'News sort order'}),
    latest: l({message: 'Latest', context: 'News sort order'}),
  }

  return (
    <Menu.Root>
      <Menu.Trigger label={l`Sort the news`}>
        {({props}) => (
          <PickerButton
            props={props}
            testID="exploreSortPickerBtn"
            label={l`Sort the news`}
            icon={selected === 'latest' ? ClockIcon : TrendingIcon}
            text={names[selected]}
          />
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          {(['top', 'latest'] as const).map(sort => (
            <PickerItem
              key={sort}
              name={names[sort]}
              selected={sort === selected}
              onPress={() => onSelect(sort)}
            />
          ))}
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}
