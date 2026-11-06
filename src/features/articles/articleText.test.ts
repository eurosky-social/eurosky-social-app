import {type PostArticle} from './articles'
import {hasDistinctArticleCaption} from './articleText'

function article(text: string) {
  return {
    title: 'A headline',
    description: 'This week on “Uncanny Valley,” we discuss the news.',
    url: 'https://example.com/story',
    item: {record: {text}},
  } as PostArticle
}
it.each([
  'This week on “Uncanny Valley,” we discuss the news.',
  'This week on "Uncanny Valley,"\nwe discuss the news.',
  'This week on “Uncanny Valley,” we discuss the news. https://example.com/story',
  'A headline',
  'A headline\nThis week on “Uncanny Valley,” we discuss the news.',
  'https://example.com/story',
  '',
])('does not repeat metadata as a second paragraph: %s', text => {
  expect(hasDistinctArticleCaption(article(text))).toBe(false)
})
it('retains commentary that adds information beyond the preview', () => {
  expect(
    hasDistinctArticleCaption(
      article(
        'This week on “Uncanny Valley,” we discuss the news. Plus a note from our editor.',
      ),
    ),
  ).toBe(true)
})
