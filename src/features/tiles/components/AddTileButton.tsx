import {useCallback, useState} from 'react'
import {Keyboard, View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {atoms as a, platform, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Window_Stroke2_Corner2_Rounded as TileIcon} from '#/components/icons/Window'
import {InlineLinkText} from '#/components/Link'
import {Text} from '#/components/Typography'
import {tileUriFromInput} from '../detect'

/** Where a curious clicker learns what a tile is. */
const ABOUT_TILES_URL = 'https://dasl.ing/'

/**
 * The composer toolbar button that attaches a tile: it asks for the tile's
 * at-URI in a dialog, since a tile is a record rather than a file to pick.
 * A post carries one tile at most, as its link card, so the button is
 * disabled while one is attached (or any link card, or media, which the
 * post pipeline prefers to a card) and comes back when it is removed.
 */
export function AddTileButton({
  disabled,
  onAttach,
}: {
  disabled?: boolean
  /** Attaches the tile; resolves to whether it was. */
  onAttach: (uri: string) => Promise<boolean>
}) {
  const {_} = useLingui()
  const t = useTheme()
  const control = Dialog.useDialogControl()

  const onPress = useCallback(() => {
    Keyboard.dismiss()
    control.open()
  }, [control])

  return (
    <>
      <Button
        testID="addTileBtn"
        onPress={onPress}
        label={_(
          msg({
            message: 'Add a tile',
            comment:
              'Accessibility label for the button in the post composer that opens the dialog to attach a tile (an interactive web page) to the post.',
          }),
        )}
        accessibilityHint={_(
          msg({
            message: 'Opens a dialog to paste the address of a tile',
            comment:
              'Accessibility hint announced after the add-tile button label, describing what activating it will do.',
          }),
        )}
        style={a.p_sm}
        variant="ghost"
        shape="round"
        color="primary"
        disabled={disabled}>
        <TileIcon size="lg" style={disabled && t.atoms.text_contrast_low} />
      </Button>

      <AddTileDialog control={control} onAttach={onAttach} />
    </>
  )
}

export function AddTileDialog({
  control,
  onAttach,
}: {
  control: Dialog.DialogOuterProps['control']
  onAttach: (uri: string) => Promise<boolean>
}) {
  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <DialogInner onAttach={onAttach} />
    </Dialog.Outer>
  )
}

function DialogInner({
  onAttach,
}: {
  onAttach: (uri: string) => Promise<boolean>
}) {
  const control = Dialog.useDialogContext()
  const {_} = useLingui()
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const [input, setInput] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)

  const onChange = useCallback((text: string) => {
    setInput(text)
    setInvalid(false)
  }, [])

  const onSubmit = useCallback(async () => {
    const uri = tileUriFromInput(input)
    if (!uri) {
      setInvalid(true)
      return
    }
    setBusy(true)
    try {
      await onAttach(uri)
    } finally {
      setBusy(false)
    }
    // Attached, or refused with a toast saying why: either way, done here.
    control.close()
  }, [input, onAttach, control])

  return (
    <Dialog.ScrollableInner
      accessibilityDescribedBy="add-tile-description"
      accessibilityLabelledBy="add-tile-title"
      style={web({maxWidth: 500})}>
      <View style={[a.relative, a.gap_md, a.w_full]}>
        <Text nativeID="add-tile-title" style={[a.text_2xl, a.font_bold]}>
          <Trans>Add a tile</Trans>
        </Text>

        <Text
          nativeID="add-tile-description"
          style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
          <Trans>
            A tile is a small interactive page, a game, a chart, a toy, that
            plays right inside a post. If someone shared one with you, paste its
            address below.
          </Trans>
        </Text>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Not sure what this is? Then there is nothing you need to do here.
          </Trans>{' '}
          <InlineLinkText
            label={_(msg`Learn what tiles are`)}
            to={ABOUT_TILES_URL}>
            <Trans>Learn what tiles are.</Trans>
          </InlineLinkText>
        </Text>

        <View>
          <TextField.LabelText nativeID="add-tile-input-label">
            <Trans>Tile address</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={invalid}>
            <TextField.Icon icon={TileIcon} />
            <Dialog.Input
              testID="addTileInput"
              value={input}
              onChangeText={onChange}
              onSubmitEditing={onSubmit}
              label={_(msg`Tile address`)}
              placeholder="at://name.example/ing.dasl.masl/…"
              accessibilityLabelledBy="add-tile-input-label"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              keyboardType="url"
              returnKeyType="done"
            />
          </TextField.Root>
          {invalid && (
            <Text
              style={[
                a.text_sm,
                a.leading_snug,
                a.mt_xs,
                {color: t.palette.negative_500},
              ]}>
              <Trans>
                That is not a tile address. One starts with at:// and names an
                ing.dasl.masl record.
              </Trans>
            </Text>
          )}
        </View>

        <View style={[gtMobile && [a.flex_row, a.justify_end], a.gap_sm]}>
          <Button
            testID="addTileCancelBtn"
            variant="ghost"
            color="secondary"
            size={platform({native: 'large', web: 'small'})}
            onPress={() => control.close()}
            label={_(msg`Cancel`)}>
            <ButtonText>
              <Trans>Cancel</Trans>
            </ButtonText>
          </Button>
          <Button
            testID="addTileSubmitBtn"
            variant="solid"
            color="primary"
            size={platform({native: 'large', web: 'small'})}
            disabled={busy || !input.trim()}
            onPress={onSubmit}
            label={_(msg`Add tile`)}>
            <ButtonText>
              <Trans>Add tile</Trans>
            </ButtonText>
          </Button>
        </View>
      </View>
    </Dialog.ScrollableInner>
  )
}
