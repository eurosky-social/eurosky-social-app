import {View} from 'react-native'
import {api} from '@bsky/sdk'
import {Trans, useLingui} from '@lingui/react/macro'

import {getModerationCauseKey, isAccountLabel} from '#/lib/moderation'
import {useModerationCauseDescription} from '#/lib/moderation/useModerationCauseDescription'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme, web} from '#/alf'
import {Button} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRight} from '#/components/icons/Chevron'
import {type AppModerationCause} from '#/components/Pills'
import {Text} from '#/components/Typography'

export {useDialogControl as usePostLabelsDialogControl} from '#/components/Dialog'

export type PostLabelsDialogProps = {
  control: Dialog.DialogOuterProps['control']
  causes: AppModerationCause[]
  /** Stores the selected cause before this dialog starts closing. */
  onSelectCause: (cause: AppModerationCause) => void
  /** Opens its details after this dialog has finished closing. */
  onOpenDetails: () => void
}

/**
 * Lists every label on a post, for cases where showing them all inline as
 * pills would overwhelm the post itself.
 */
export function PostLabelsDialog(props: PostLabelsDialogProps) {
  return (
    <Dialog.Outer
      control={props.control}
      nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <PostLabelsDialogInner {...props} />
    </Dialog.Outer>
  )
}

function PostLabelsDialogInner({
  control,
  causes,
  onSelectCause,
  onOpenDetails,
}: PostLabelsDialogProps) {
  const t = useTheme()
  const {t: l} = useLingui()

  const accountCauses = causes.filter(
    cause => cause.type === 'label' && isAccountLabel(cause.label),
  )
  const postCauses = causes.filter(
    cause => cause.type !== 'label' || !isAccountLabel(cause.label),
  )
  /*
   * A post usually carries one kind or the other. When it carries both, the
   * list is split so it is clear which labels follow the account onto every
   * post and which belong to this one.
   */
  const isMixed = accountCauses.length > 0 && postCauses.length > 0
  const title = isMixed
    ? l`Labels`
    : postCauses.length > 0
      ? l`Labels on this post`
      : l`Labels on this account`
  const accessibilityLabel = isMixed
    ? l`The following labels were applied to this account or this post.`
    : postCauses.length > 0
      ? l`The following labels were applied to this post.`
      : l`The following labels were applied to this account.`

  const onPressRow = (cause: AppModerationCause) => {
    onSelectCause(cause)
    control.close(onOpenDetails)
  }

  return (
    <Dialog.ScrollableInner
      label={accessibilityLabel}
      style={web({
        maxWidth: 460,
      })}>
      <Text style={[a.text_2xl, a.font_bold, a.pb_xs, a.leading_tight]}>
        {title}
      </Text>
      <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>Select a label to see more information about it.</Trans>
      </Text>

      {isMixed ? (
        <>
          <CauseGroup
            title={l`Applied to this account`}
            causes={accountCauses}
            onPressCause={onPressRow}
          />
          <CauseGroup
            title={l`Applied to this post`}
            causes={postCauses}
            onPressCause={onPressRow}
          />
        </>
      ) : (
        <View style={[a.pt_lg, a.gap_sm]}>
          {causes.map(cause => (
            <CauseRow
              key={getModerationCauseKey(cause)}
              cause={cause}
              onPress={() => onPressRow(cause)}
            />
          ))}
        </View>
      )}

      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function CauseGroup({
  title,
  causes,
  onPressCause,
}: {
  title: string
  causes: AppModerationCause[]
  onPressCause: (cause: AppModerationCause) => void
}) {
  const t = useTheme()

  return (
    <View style={[a.pt_lg, a.gap_sm]}>
      <Text
        style={[
          a.text_sm,
          a.font_bold,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        {title}
      </Text>
      {causes.map(cause => (
        <CauseRow
          key={getModerationCauseKey(cause)}
          cause={cause}
          onPress={() => onPressCause(cause)}
        />
      ))}
    </View>
  )
}

function CauseRow({
  cause,
  onPress,
}: {
  cause: AppModerationCause
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const desc = useModerationCauseDescription(cause)
  const isLabeler = desc.sourceType === 'labeler'
  const isBlueskyLabel =
    desc.sourceType === 'labeler' && desc.sourceDid === api.moderation.did
  const isSelfLabel = cause.type === 'label' && cause.source.type === 'user'

  return (
    <Button label={l`View details for ${desc.name}`} onPress={onPress}>
      {({hovered, pressed}) => (
        <View
          style={[
            a.flex_1,
            a.flex_row,
            a.align_start,
            a.gap_sm,
            a.p_md,
            a.rounded_sm,
            a.border,
            t.atoms.border_contrast_low,
            (hovered || pressed) && t.atoms.bg_contrast_25,
          ]}>
          <View style={[{paddingTop: 2}]}>
            {isBlueskyLabel || !isLabeler ? (
              <desc.icon width={20} fill={t.atoms.text_contrast_medium.color} />
            ) : (
              <UserAvatar avatar={desc.sourceAvi} type="user" size={20} />
            )}
          </View>

          <View style={[a.flex_1, a.gap_2xs]}>
            <Text emoji style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
              {desc.name}
            </Text>
            <Text
              emoji
              numberOfLines={2}
              style={[a.leading_snug, t.atoms.text_contrast_medium]}>
              {desc.description}
            </Text>
            {isSelfLabel ? (
              <Text
                numberOfLines={1}
                style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_low]}>
                <Trans>Applied by the author</Trans>
              </Text>
            ) : desc.sourceType === 'labeler' ? (
              <Text
                numberOfLines={1}
                style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_low]}>
                <Trans>Source: {desc.source}</Trans>
              </Text>
            ) : null}
          </View>

          <ChevronRight
            width={16}
            fill={t.atoms.text_contrast_low.color}
            style={[{marginTop: 4}]}
          />
        </View>
      )}
    </Button>
  )
}
