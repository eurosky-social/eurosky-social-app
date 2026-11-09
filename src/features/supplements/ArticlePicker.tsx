import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useDebouncedValue} from '#/lib/hooks/useDebouncedValue'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {SearchInput} from '#/components/forms/SearchInput'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {useDutchArticleSearchQuery} from '#/features/news/dutch/queries'
import {
  articleFromAggregator,
  articleFromLink,
  hasArticle,
  MAX_SUPPLEMENT_ITEMS,
  type SupplementArticle,
  type SupplementDraft,
} from './supplement'

/**
 * Where an editor finds articles: the news aggregator's, from every outlet,
 * starting from the supplement's own topic and dates; or any page by its link,
 * for a source the aggregator does not read.
 */
export function ArticlePicker({
  draft,
  onAdd,
}: {
  draft: SupplementDraft
  onAdd: (article: SupplementArticle) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [text, setText] = useState('')
  const [narrow, setNarrow] = useState(true)
  const q = useDebouncedValue(text.trim(), 300)
  const search = useDutchArticleSearchQuery({
    q: q || undefined,
    topic: narrow ? draft.topic?.slug : undefined,
    since: narrow ? draft.startDate || undefined : undefined,
    until: narrow ? draft.endDate || undefined : undefined,
  })
  const articles = (search.data?.pages ?? [])
    .flatMap(page => page.articles)
    .flatMap(article => articleFromAggregator(article) ?? [])
  const full = draft.items.length >= MAX_SUPPLEMENT_ITEMS

  return (
    <View style={[a.gap_md]} testID="supplementArticlePicker">
      <Text style={[a.text_lg, a.font_bold]}>
        <Trans>Add articles</Trans>
      </Text>
      {full && (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>
            This supplement is full. Remove an article to add another.
          </Trans>
        </Text>
      )}
      <SearchInput
        testID="supplementArticleSearch"
        label={l`Search articles from every outlet`}
        placeholder={l`Search articles from every outlet`}
        value={text}
        onChangeText={setText}
        onClearText={() => setText('')}
      />
      <Toggle.Item
        name="supplement_narrow"
        label={l`Only this topic and these dates`}
        value={narrow}
        onChange={setNarrow}>
        <Toggle.Checkbox />
        <Toggle.LabelText>
          <Trans>Only this topic and these dates</Trans>
        </Toggle.LabelText>
      </Toggle.Item>

      {search.isLoading ? (
        <View style={[a.py_lg, a.align_center]}>
          <Loader size="md" />
        </View>
      ) : search.isError ? (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>
            Couldn’t search articles. You can still add one by link.
          </Trans>
        </Text>
      ) : articles.length === 0 ? (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>No articles found.</Trans>
        </Text>
      ) : (
        <View style={[a.gap_sm]}>
          {articles.map(article => {
            const added = hasArticle(draft.items, article.url)
            return (
              <View
                key={article.url}
                style={[
                  a.flex_row,
                  a.align_center,
                  a.gap_md,
                  a.pb_sm,
                  a.border_b,
                  t.atoms.border_contrast_low,
                ]}>
                <View style={[a.flex_1, a.gap_2xs]}>
                  <Text style={[a.text_sm, a.font_medium, a.leading_snug]}>
                    {article.title}
                  </Text>
                  <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                    {article.outlet.name}
                  </Text>
                </View>
                <Button
                  label={
                    added
                      ? l`Added: ${article.title}`
                      : l`Add article: ${article.title}`
                  }
                  size="tiny"
                  color={added ? 'secondary' : 'primary'}
                  disabled={added || full}
                  onPress={() => onAdd(article)}>
                  <ButtonIcon icon={added ? CheckIcon : PlusIcon} />
                  <ButtonText>
                    {added ? (
                      <Trans context="An article in a supplement">Added</Trans>
                    ) : (
                      <Trans context="Add an article">Add</Trans>
                    )}
                  </ButtonText>
                </Button>
              </View>
            )
          })}
          {search.hasNextPage && (
            <Button
              label={l`Load more articles`}
              size="small"
              color="secondary"
              disabled={search.isFetchingNextPage}
              onPress={() => void search.fetchNextPage()}
              style={[a.self_center]}>
              <ButtonText>
                <Trans>Load more articles</Trans>
              </ButtonText>
            </Button>
          )}
        </View>
      )}

      <AddByLink draft={draft} full={full} onAdd={onAdd} />
    </View>
  )
}

function AddByLink({
  draft,
  full,
  onAdd,
}: {
  draft: SupplementDraft
  full: boolean
  onAdd: (article: SupplementArticle) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const article = articleFromLink(url, title)
  const duplicate = !!article && hasArticle(draft.items, article.url)

  return (
    <View style={[a.gap_sm, a.pt_sm]}>
      <Text style={[a.text_sm, a.font_bold]}>
        <Trans>Add an article by link</Trans>
      </Text>
      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
        <Trans>For a source the search does not cover.</Trans>
      </Text>
      <View>
        <TextField.LabelText>
          <Trans>Link</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            testID="supplementLinkUrl"
            label={l`Link`}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://"
          />
        </TextField.Root>
      </View>
      <View>
        <TextField.LabelText>
          <Trans>Headline</Trans>
        </TextField.LabelText>
        <TextField.Root>
          <TextField.Input
            testID="supplementLinkTitle"
            label={l`Headline`}
            value={title}
            onChangeText={setTitle}
          />
        </TextField.Root>
      </View>
      {duplicate && (
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <Trans>This article is already in the supplement.</Trans>
        </Text>
      )}
      <Button
        testID="supplementLinkAdd"
        label={l`Add link`}
        size="small"
        color="secondary"
        disabled={!article || duplicate || full}
        onPress={() => {
          if (!article) return
          onAdd(article)
          setUrl('')
          setTitle('')
        }}
        style={[a.self_start]}>
        <ButtonIcon icon={PlusIcon} />
        <ButtonText>
          <Trans>Add link</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
