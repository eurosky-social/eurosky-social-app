import {useCallback, useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Plural, Trans} from '@lingui/react/macro'

import {
  MAX_DESCRIPTION,
  MAX_DISPLAY_NAME,
  MAX_PRONOUNS,
  urls,
} from '#/lib/constants'
import {useCallOnce} from '#/lib/once'
import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {isOverMaxGraphemeCount} from '#/lib/strings/helpers'
import {logger} from '#/logger'
import {type ImageMeta} from '#/state/gallery'
import {useProfileUpdateMutation} from '#/state/queries/profile'
import {ErrorMessage} from '#/view/com/util/error/ErrorMessage'
import {EditableUserAvatar} from '#/view/com/util/UserAvatar'
import {UserBanner} from '#/view/com/util/UserBanner'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useSimpleVerificationState} from '#/components/verification'
import {useAnalytics} from '#/analytics'
import {
  logProfileLinkChanges,
  type OwnProfileLinks,
  prepareProfileSave,
  type ProfileLink,
  ProfileLinksChangedError,
  ProfileLinksEditor,
  sameProfileLinks,
  useCanEditProfileLinks,
  useOwnProfileLinksQuery,
  usePrepareProfileLinksSave,
} from '#/features/profileLinks'
import {type app} from '#/lexicons'

export function EditProfileDialog({
  profile,
  control,
  onUpdate,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  control: Dialog.DialogControlProps
  onUpdate?: () => void
}) {
  const {_} = useLingui()
  const cancelControl = Dialog.useDialogControl()
  const [dirty, setDirty] = useState(false)

  const onPressCancel = useCallback(() => {
    if (dirty) {
      cancelControl.open()
    } else {
      control.close()
    }
  }, [dirty, control, cancelControl])

  return (
    <Dialog.Outer
      control={control}
      nativeOptions={{
        preventDismiss: dirty,
        fullHeight: true,
      }}
      webOptions={{
        onBackgroundPress: () => {
          if (dirty) {
            cancelControl.open()
          } else {
            control.close()
          }
        },
      }}
      testID="editProfileModal">
      <DialogInner
        profile={profile}
        onUpdate={onUpdate}
        setDirty={setDirty}
        onPressCancel={onPressCancel}
      />

      <Prompt.Basic
        control={cancelControl}
        title={_(msg`Discard changes?`)}
        description={_(msg`Are you sure you want to discard your changes?`)}
        onConfirm={() => control.close()}
        confirmButtonCta={_(msg`Discard`)}
        confirmButtonColor="negative"
      />
    </Dialog.Outer>
  )
}

function DialogInner({
  profile,
  onUpdate,
  setDirty,
  onPressCancel,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
  onUpdate?: () => void
  setDirty: (dirty: boolean) => void
  onPressCancel: () => void
}) {
  const {_} = useLingui()
  const t = useTheme()
  const ax = useAnalytics()
  const control = Dialog.useDialogContext()
  // the dialog's contents mount on every open, so this fires once per open
  useCallOnce(() => {
    ax.metric('profile:edit:open', {})
  })()
  const verification = useSimpleVerificationState({
    profile,
  })
  const {
    mutateAsync: updateProfileMutation,
    error: updateProfileError,
    isError: isUpdateProfileError,
    isPending: isUpdatingProfile,
  } = useProfileUpdateMutation()
  const [imageError, setImageError] = useState('')
  const initialDisplayName = profile.displayName || ''
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const initialDescription = profile.description || ''
  const [description, setDescription] = useState(initialDescription)
  const initialPronouns = profile.pronouns || ''
  const [pronouns, setPronouns] = useState(initialPronouns)
  const [userBanner, setUserBanner] = useState<string | undefined | null>(
    profile.banner,
  )
  const [userAvatar, setUserAvatar] = useState<string | undefined | null>(
    profile.avatar,
  )
  const [newUserBanner, setNewUserBanner] = useState<
    ImageMeta | undefined | null
  >()
  const [newUserAvatar, setNewUserAvatar] = useState<
    ImageMeta | undefined | null
  >()

  const canEditLinks = useCanEditProfileLinks()
  const {
    data: queriedLinkSnapshot,
    isError: linksError,
    isFetching: isFetchingLinks,
    refetch: retryLinks,
  } = useOwnProfileLinksQuery(profile.did)
  const [linkEdits, setLinkEdits] = useState<{
    snapshot: OwnProfileLinks
    links: ProfileLink[]
  }>()
  /* Freeze on interaction, not in an effect, before a form or drag can rebase. */
  const linkSnapshot = linkEdits?.snapshot ?? queriedLinkSnapshot
  const storedLinks = linkSnapshot?.links
  const editedLinks = linkEdits?.links
  const prepareLinksSave = usePrepareProfileLinksSave()
  const [isSaving, setIsSaving] = useState(false)
  const [linksConflict, setLinksConflict] = useState(false)
  const links = editedLinks ?? storedLinks
  const freezeLinks = () => {
    if (linkSnapshot) {
      setLinkEdits(
        previous =>
          previous ?? {snapshot: linkSnapshot, links: linkSnapshot.links},
      )
    }
  }
  const reloadLinks = async () => {
    const result = await retryLinks()
    if (result.isSuccess && result.data) {
      setLinkEdits({snapshot: result.data, links: result.data.links})
      setLinksConflict(false)
    } else {
      Toast.show(_(msg`Couldn’t load your links. Please try again.`), {
        type: 'error',
      })
    }
  }
  const linksLoaded = !!storedLinks

  useEffect(() => {
    if (!storedLinks) return
    ax.metric('profile:links:editorOpen', {
      linkCount: storedLinks.length,
    })
    // Once, when the links first load.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [linksLoaded])
  const [isDraggingLinks, setIsDraggingLinks] = useState(false)
  // on Android the sheet turns its own drag off while scrolled, so put that back after
  const sheetDragWasDisabled = useRef(false)

  const profileDirty =
    displayName !== initialDisplayName ||
    description !== initialDescription ||
    pronouns !== initialPronouns ||
    userAvatar !== profile.avatar ||
    userBanner !== profile.banner
  const linksDirty =
    !!editedLinks &&
    !!storedLinks &&
    !sameProfileLinks(editedLinks, storedLinks)
  const dirty = profileDirty || linksDirty

  useEffect(() => {
    setDirty(dirty)
  }, [dirty, setDirty])

  const onSelectNewAvatar = useCallback(
    (img: ImageMeta | null) => {
      setImageError('')
      if (img === null) {
        setNewUserAvatar(null)
        setUserAvatar(null)
        return
      }
      try {
        setNewUserAvatar(img)
        setUserAvatar(img.path)
      } catch (e: any) {
        setImageError(cleanError(e))
      }
    },
    [setNewUserAvatar, setUserAvatar, setImageError],
  )

  const onSelectNewBanner = useCallback(
    (img: ImageMeta | null) => {
      setImageError('')
      if (!img) {
        setNewUserBanner(null)
        setUserBanner(null)
        return
      }
      try {
        setNewUserBanner(img)
        setUserBanner(img.path)
      } catch (e: any) {
        setImageError(cleanError(e))
      }
    },
    [setNewUserBanner, setUserBanner, setImageError],
  )

  const onPressSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    setImageError('')
    try {
      let prepared: Awaited<ReturnType<typeof prepareLinksSave>> | undefined
      if (
        linkSnapshot &&
        links &&
        (linksDirty || (canEditLinks && linkSnapshot.website))
      ) {
        try {
          prepared = await prepareLinksSave(profile.did, links, linkSnapshot)
        } catch (e) {
          /* Optional migration must not prevent an unrelated profile edit. */
          if (linksDirty) throw e
        }
      }
      const save = prepareProfileSave({
        fields: {
          displayName: displayName.trimEnd(),
          description: description.trimEnd(),
          pronouns: pronouns.trim(),
        },
        links: prepared,
        linksDirty,
      })
      await updateProfileMutation({
        profile,
        updates: save.updates,
        /* Wait for ordinary profile edits, not refs a filtered AppView may omit. */
        commitFields: save.fields,
        newUserAvatar,
        newUserBanner,
      })
      await save.onSuccess()
      if (prepared && linksDirty) {
        logProfileLinkChanges(ax, storedLinks ?? [], links ?? [])
      }
      control.close(() => onUpdate?.())
      Toast.show(_(msg({message: 'Profile updated', context: 'toast'})))
    } catch (e: unknown) {
      if (e instanceof ProfileLinksChangedError) setLinksConflict(true)
      void retryLinks()
      if (!isNetworkError(e) && !(e instanceof ProfileLinksChangedError)) {
        logger.error('Failed to update user profile', {safeMessage: e})
      }
      Toast.show(
        e instanceof ProfileLinksChangedError
          ? _(
              msg`Your links changed in another app. Reload your links to continue.`,
            )
          : _(msg`Couldn’t save your profile. Please try again.`),
        {type: 'error'},
      )
    } finally {
      setIsSaving(false)
    }
  }

  const displayNameTooLong = isOverMaxGraphemeCount({
    text: displayName,
    maxCount: MAX_DISPLAY_NAME,
  })
  const descriptionTooLong = isOverMaxGraphemeCount({
    text: description,
    maxCount: MAX_DESCRIPTION,
  })
  const pronounsTooLong = isOverMaxGraphemeCount({
    text: pronouns,
    maxCount: MAX_PRONOUNS,
  })
  const cancelButton = useCallback(
    () => (
      <Button
        label={_(msg`Cancel`)}
        onPress={onPressCancel}
        size="small"
        color="primary"
        variant="ghost"
        style={[a.rounded_full]}
        testID="editProfileCancelBtn">
        <ButtonText style={[a.text_md]}>
          <Trans>Cancel</Trans>
        </ButtonText>
      </Button>
    ),
    [onPressCancel, _],
  )

  const saveButton = () => (
    <Button
      label={_(msg`Save`)}
      onPress={onPressSave}
      disabled={
        !dirty ||
        isSaving ||
        isUpdatingProfile ||
        displayNameTooLong ||
        descriptionTooLong ||
        pronounsTooLong
      }
      size="small"
      color="primary"
      variant="ghost"
      style={[a.rounded_full]}
      testID="editProfileSaveBtn">
      <ButtonText style={[a.text_md, !dirty && t.atoms.text_contrast_low]}>
        <Trans>Save</Trans>
      </ButtonText>
      {(isSaving || isUpdatingProfile) && <ButtonIcon icon={Loader} />}
    </Button>
  )

  return (
    <Dialog.ScrollableInner
      label={_(msg`Edit profile`)}
      scrollEnabled={!isDraggingLinks}
      style={[a.overflow_hidden]}
      contentContainerStyle={[a.px_0, a.pt_0]}
      header={
        <Dialog.Header renderLeft={cancelButton} renderRight={saveButton}>
          <Dialog.HeaderText>
            <Trans>Edit profile</Trans>
          </Dialog.HeaderText>
        </Dialog.Header>
      }>
      <View style={[a.relative]}>
        <UserBanner banner={userBanner} onSelectNewBanner={onSelectNewBanner} />
        <View
          style={[
            a.absolute,
            {
              top: 80,
              left: 20,
              width: 84,
              height: 84,
              borderWidth: 2,
              borderRadius: 42,
              borderColor: t.atoms.bg.backgroundColor,
            },
          ]}>
          <EditableUserAvatar
            size={80}
            avatar={userAvatar}
            onSelectNewAvatar={onSelectNewAvatar}
          />
        </View>
      </View>
      {isUpdateProfileError && (
        <View style={[a.mt_xl]}>
          <ErrorMessage message={cleanError(updateProfileError)} />
        </View>
      )}
      {imageError !== '' && (
        <View style={[a.mt_xl]}>
          <ErrorMessage message={imageError} />
        </View>
      )}
      <View style={[a.mt_4xl, a.px_xl, a.gap_xl]}>
        <View>
          <TextField.LabelText>
            <Trans>Display name</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={displayNameTooLong}>
            <Dialog.Input
              value={displayName}
              onChangeText={setDisplayName}
              label={_(msg`Display name`)}
              placeholder={_(msg`e.g. Alice Lastname`)}
              testID="editProfileDisplayNameInput"
            />
          </TextField.Root>
          {displayNameTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={MAX_DISPLAY_NAME}
                other="Display name is too long. The maximum number of characters is #."
              />
            </Text>
          )}
        </View>

        {verification.isVerified &&
          verification.role === 'default' &&
          displayName !== initialDisplayName && (
            <Admonition type="error">
              <Trans>
                You are verified. You will lose your verification status if you
                change your display name.{' '}
                <InlineLinkText
                  label={_(
                    msg({
                      message: `Learn more`,
                      context: `english-only-resource`,
                    }),
                  )}
                  to={urls.website.blog.initialVerificationAnnouncement}>
                  <Trans context="english-only-resource">Learn more.</Trans>
                </InlineLinkText>
              </Trans>
            </Admonition>
          )}

        <View>
          <TextField.LabelText>
            <Trans>Description</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={descriptionTooLong}>
            <Dialog.Input
              value={description}
              onChangeText={setDescription}
              multiline
              label={_(msg`Description`)}
              placeholder={_(msg`Tell us a bit about yourself`)}
              testID="editProfileDescriptionInput"
            />
          </TextField.Root>
          {descriptionTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={MAX_DESCRIPTION}
                other="Description is too long. The maximum number of characters is #."
              />
            </Text>
          )}
        </View>

        <View>
          <TextField.LabelText>
            <Trans>Pronouns</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={pronounsTooLong}>
            <Dialog.Input
              defaultValue={pronouns}
              onChangeText={setPronouns}
              label={_(msg`Pronouns`)}
              placeholder={_(msg`e.g. she/her`)}
              testID="editProfilePronounsInput"
            />
          </TextField.Root>
          {pronounsTooLong && (
            <Text
              style={[
                a.text_sm,
                a.mt_xs,
                a.font_semi_bold,
                {color: t.palette.negative_400},
              ]}>
              <Plural
                value={MAX_PRONOUNS}
                other="Pronouns are too long. The maximum number of characters is #."
              />
            </Text>
          )}
        </View>

        {!links && (
          <View style={a.gap_sm}>
            <TextField.LabelText>
              <Trans>Links</Trans>
            </TextField.LabelText>
            {linksError ? (
              <Button
                label={_(msg`Retry loading links`)}
                onPress={() => void retryLinks()}>
                <ButtonText>
                  <Trans>Couldn’t load your links. Retry</Trans>
                </ButtonText>
              </Button>
            ) : (
              <Loader />
            )}
          </View>
        )}
        {linksConflict && (
          <View style={a.gap_sm}>
            <Text>
              <Trans>Your other profile changes will be kept.</Trans>
            </Text>
            <Button
              label={_(msg`Reload links and discard link changes`)}
              onPress={() => void reloadLinks()}
              disabled={isSaving || isFetchingLinks}>
              <ButtonText>
                <Trans>Reload links and discard link changes</Trans>
              </ButtonText>
            </Button>
          </View>
        )}
        {links && linkSnapshot && (
          <ProfileLinksEditor
            did={profile.did}
            links={links}
            snapshot={linkSnapshot}
            canEdit={canEditLinks}
            onEditStart={freezeLinks}
            onChange={next =>
              setLinkEdits({snapshot: linkSnapshot, links: next})
            }
            onDragStateChange={dragging => {
              if (dragging) freezeLinks()
              setIsDraggingLinks(dragging)
              if (dragging) {
                sheetDragWasDisabled.current = control.disableDrag
                control.setDisableDrag(true)
              } else {
                control.setDisableDrag(sheetDragWasDisabled.current)
              }
            }}
          />
        )}
      </View>
    </Dialog.ScrollableInner>
  )
}
