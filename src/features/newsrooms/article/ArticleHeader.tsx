import {View} from 'react-native'
import {setStringAsync} from 'expo-clipboard'
import {Image} from 'expo-image'
import {Trans, useLingui} from '@lingui/react/macro'

import {HITSLOP_20} from '#/lib/constants'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useProfileQuery} from '#/state/queries/profile'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {Clipboard_Stroke2_Corner2_Rounded as CopyIcon} from '#/components/icons/Clipboard'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {EditBig_Stroke2_Corner2_Rounded as ComposeIcon} from '#/components/icons/EditBig'
import {Link} from '#/components/Link'
import * as Menu from '#/components/Menu'
import * as toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {VerificationCheckButton} from '#/components/verification/VerificationCheckButton'
import {type app} from '#/lexicons'
import {getNewsroomPublisherByDid, getPublisherName} from '../publishers'
import {useOgImageQuery} from '../queries'
import {ArticleSocialStack} from './ArticleSocialStack'

/**
 * The focused article itself, above its discussion feed: the piece shown large -
 * image, headline, deck, outlet - with the three ways to act on it. Leaving for
 * the outlet's site happens here, at "View"; everything below is the in-network
 * conversation.
 *
 * The fields arrive from the story card as route params, so this renders at
 * once; only the outlet profile and the scraped hero image are fetched.
 */
export function ArticleHeader({
  url,
  title,
  image: passedImage,
  description,
  publishedAt,
  outletName,
  outletDid,
  sharers = [],
  anchor,
}: {
  url: string
  title?: string
  image?: string
  description?: string
  publishedAt?: string
  outletName?: string
  outletDid?: string
  /** Authors of the article's discussion posts, for the social-proof row. */
  sharers?: app.bsky.actor.defs.ProfileViewBasic[]
  /**
   * The publisher's canonical post of the article, when one exists. Sharing
   * quotes it so every share grows the one conversation, as on the newsroom.
   */
  anchor?: app.bsky.feed.defs.PostView
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {openComposer} = useOpenComposer()

  /*
   * Some feeds ship thumbnails too small for a hero, so prefer the scraped
   * og:image and fall back to the feed image the card passed while it resolves.
   */
  const {data: ogImage} = useOgImageQuery({url})
  const image = ogImage || passedImage

  const {data: profile} = useProfileQuery({did: outletDid})
  const name = getPublisherName(profile) || outletName || ''
  // A registered publisher tints its share CTA in its own accent, like the
  // newsroom does; a bare feed outlet keeps the default primary.
  const accent = outletDid
    ? getNewsroomPublisherByDid(outletDid)?.accent
    : undefined

  const published = publishedAt ? new Date(publishedAt) : undefined

  /*
   * Quote the publisher's own post when it can still be embedded, so every
   * share grows one canonical conversation; fall back to a link card otherwise.
   */
  function onShare() {
    const anchorBlocked = Boolean(
      anchor?.author.viewer?.blocking ||
      anchor?.author.viewer?.blockedBy ||
      anchor?.author.viewer?.blockingByList,
    )
    if (anchor && !anchor.viewer?.embeddingDisabled && !anchorBlocked) {
      openComposer({quote: anchor, logContext: 'Other'})
    } else {
      openComposer({externalUri: url, logContext: 'Other'})
    }
  }

  async function onCopyLink() {
    await setStringAsync(url)
    toast.show(l`Copied to clipboard`, {type: 'success'})
  }

  return (
    <View style={[a.p_lg, a.gap_md]}>
      {/* Publisher byline, above the thumbnail, with the utility actions. */}
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        {!!outletDid && (
          <Link
            to={`/newsroom/${outletDid}`}
            label={l`Open the ${name} newsroom`}
            style={[a.flex_row, a.align_center, a.gap_xs]}>
            <UserAvatar type="user" size={28} avatar={profile?.avatar} />
            <Text emoji style={[a.text_md, a.font_bold, t.atoms.text]}>
              {name}
            </Text>
            {!!profile && <PublisherVerification profile={profile} />}
          </Link>
        )}
        {!outletDid && !!name && (
          <Text emoji style={[a.text_md, a.font_bold, t.atoms.text]}>
            {name}
          </Text>
        )}

        <View style={[a.flex_1]} />

        {!!outletDid && (
          <Link
            to={`/newsroom/${outletDid}`}
            label={l`Visit the ${name} newsroom`}
            size="small"
            color="secondary"
            variant="solid">
            <ButtonText>
              <Trans>Visit newsroom</Trans>
            </ButtonText>
          </Link>
        )}
      </View>

      {!!image && (
        <Link
          to={url}
          label={title || l`Open the article`}
          style={[a.w_full, a.rounded_md, a.overflow_hidden]}>
          <Image
            accessibilityIgnoresInvertColors
            source={{uri: image}}
            style={[a.w_full, {aspectRatio: 3 / 2}]}
            contentFit="cover"
            transition={200}
          />
        </Link>
      )}

      {!!title && (
        <Link
          to={url}
          label={title}
          style={[a.flex_col, a.align_start, a.w_full]}>
          <Text
            style={[a.text_3xl, a.font_bold, a.leading_tight, t.atoms.text]}>
            {title}
          </Text>
        </Link>
      )}

      {!!description && (
        <Text
          numberOfLines={3}
          style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
          {description}
        </Text>
      )}

      {!!published && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          {i18n.date(published, {dateStyle: 'medium'})}
        </Text>
      )}

      <Divider />

      {/* Social proof on the left, the ways to act on the right. */}
      <View style={[a.flex_row, a.align_center, a.gap_sm, a.flex_wrap]}>
        {sharers.length > 0 && <ArticleSocialStack authors={sharers} />}

        <View style={[a.flex_1]} />

        <Button
          label={l`Share this story`}
          size="small"
          color="primary"
          variant="solid"
          onPress={onShare}
          style={[!!accent && {backgroundColor: accent}]}>
          <ButtonIcon icon={ComposeIcon} />
          <ButtonText>
            <Trans>Share this story</Trans>
          </ButtonText>
        </Button>
        <Link
          to={url}
          label={l`View the article`}
          size="small"
          color="secondary"
          variant="solid">
          <ButtonText>
            <Trans>View</Trans>
          </ButtonText>
        </Link>
        <Menu.Root>
          <Menu.Trigger label={l`More options`}>
            {({props}) => (
              <Button
                {...props}
                label={l`More options`}
                size="small"
                color="secondary"
                shape="round">
                <ButtonIcon icon={DotsIcon} />
              </Button>
            )}
          </Menu.Trigger>
          <Menu.Outer>
            <Menu.Item label={l`Copy link`} onPress={() => void onCopyLink()}>
              <Menu.ItemIcon icon={CopyIcon} />
              <Menu.ItemText>
                <Trans>Copy link</Trans>
              </Menu.ItemText>
            </Menu.Item>
          </Menu.Outer>
        </Menu.Root>
      </View>

      <Divider />
    </View>
  )
}

/**
 * The outlet's standard verification badge. The check button needs the shadowed
 * profile, so it reads the same live overrides the rest of the app does.
 */
function PublisherVerification({
  profile,
}: {
  profile: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const shadowed = useProfileShadow(profile)
  return (
    <VerificationCheckButton
      profile={shadowed}
      width={18}
      hitSlop={HITSLOP_20}
    />
  )
}
