import {useState} from 'react'
import {useLingui} from '@lingui/react/macro'

import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Earth_Stroke2_Corner2_Rounded as WorldIcon} from '#/components/icons/Globe'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PinLocation_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/PinLocation'
import * as Menu from '#/components/Menu'
import {frontpageFromOutlet} from '#/features/frontpages/frontpages'
import {InterestEditDialog} from '#/features/newsFeed/components/interests/InterestEditDialog'
import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {useDutchOutletsQuery} from '../../dutch/queries'
import {feedOutletsForInterest} from '../interests'
import {useInterestTitle} from '../useInterestTitle'
import {PickerButton, PickerItem} from './ExploreLocationPicker'
import {InterestLogos} from './InterestLogos'

/**
 * Which of the reader's interests the spread shows. It takes the location
 * picker's place ahead of the topic chips, which then narrow within it. The
 * choice lives only on the page and is not saved. The button and each item
 * show the interest the same way - a globe or pin, a few of its outlets, its
 * title - and each item can be edited in place; the interests are made in the
 * news settings, which the page's header opens.
 */
export function ExploreInterestPicker({
  interests,
  selectedId,
  onSelect,
}: {
  interests: NewsInterest[]
  selectedId: string
  onSelect: (interestId: string) => void
}) {
  const {t: l} = useLingui()
  const titleOf = useInterestTitle()
  const editControl = Dialog.useDialogControl()
  /* The dialog stays mounted, so it can open as soon as one is picked. */
  const [editing, setEditing] = useState<NewsInterest | undefined>()
  const {outlets} = useDutchOutletsQuery()
  const current = interests.find(interest => interest.id === selectedId)

  function logosOf(interest: NewsInterest) {
    return (
      <InterestLogos
        interest={interest}
        frontpages={
          outlets
            ? feedOutletsForInterest(interest, outlets).map(frontpageFromOutlet)
            : []
        }
      />
    )
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger label={l`Choose an interest`}>
          {({props}) => (
            <PickerButton
              props={props}
              testID="exploreInterestPickerBtn"
              label={l`Choose an interest`}
              icon={
                current && current.countries.length > 0 ? PinIcon : WorldIcon
              }
              leading={current ? logosOf(current) : undefined}
              text={current ? titleOf(current) : ''}
            />
          )}
        </Menu.Trigger>
        <Menu.Outer>
          <Menu.Group>
            {interests.map(interest => (
              <PickerItem
                key={interest.id}
                name={titleOf(interest)}
                selected={interest.id === selectedId}
                onPress={() => onSelect(interest.id)}
                leading={logosOf(interest)}
                trailing={
                  <EditButton
                    title={titleOf(interest)}
                    onEdit={() => {
                      setEditing(interest)
                      editControl.open()
                    }}
                  />
                }
              />
            ))}
          </Menu.Group>
        </Menu.Outer>
      </Menu.Root>
      {/* Finishing an edit shows that interest. */}
      <InterestEditDialog
        control={editControl}
        interest={editing ?? interests[0]}
        onSaved={saved => onSelect(saved.id)}
      />
    </>
  )
}

/**
 * Edits an interest from inside its menu item. The press stops at the button,
 * so the item does not also pick the interest, and the menu closes before the
 * dialog opens: two dialogs cannot be open at once.
 */
function EditButton({title, onEdit}: {title: string; onEdit: () => void}) {
  const {t: l} = useLingui()
  const {control} = Menu.useMenuContext()
  return (
    <Button
      testID="exploreInterestEditBtn"
      label={l`Edit ${title}`}
      size="tiny"
      color="secondary"
      variant="ghost"
      shape="round"
      onPress={event => {
        event.stopPropagation()
        control.close(onEdit)
      }}>
      <ButtonIcon icon={PencilIcon} />
    </Button>
  )
}
