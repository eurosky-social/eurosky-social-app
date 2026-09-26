const path = require('node:path')
const {transformFileSync, traverse} = require('@babel/core')
const {setupI18n} = require('@lingui/core')

const root = path.resolve(__dirname, '..')

/** Regression check for the dialog that originally shipped hashed message IDs. */
function announcementMessageIds() {
  const {ast} = transformFileSync(
    path.join(root, 'src/features/muForYouFeed/index.tsx'),
    {
      configFile: false,
      babelrc: false,
      ast: true,
      code: false,
      parserOpts: {plugins: ['typescript', 'jsx']},
      plugins: [
        ['@lingui/babel-plugin-lingui-macro', {stripMessageField: true}],
      ],
    },
  )
  const ids = new Set()
  traverse(ast, {
    ObjectExpression({node}) {
      // Lingui marks both Trans props and translation descriptors with /*i18n*/.
      if (!node.leadingComments?.some(comment => comment.value === 'i18n')) {
        return
      }
      for (const property of node.properties) {
        if (
          property.type === 'ObjectProperty' &&
          property.key.name === 'id' &&
          property.value.type === 'StringLiteral'
        ) {
          ids.add(property.value.value)
        }
      }
    },
  })
  if (!ids.size)
    throw new Error(
      'No announcement messages found; check the macro transform.',
    )
  return ids
}

/** Missing translations may fall back to English, but never to a raw ID. */
function assertMessages(locale, messages, ids) {
  for (const id of ids) {
    const message = messages[id]
    if (
      !Array.isArray(message) ||
      !message.length ||
      (message.length === 1 && message[0] === id)
    ) {
      throw new Error(
        `Missing or uncompiled release translation: ${locale}/${id}`,
      )
    }
  }
}

function checkReleaseI18n() {
  const {locales} = require('../lingui.config.ts').default
  const {messages: english} = require('../src/locale/locales/en/messages.ts')
  const announcementIds = announcementMessageIds()
  assertMessages('en', english, announcementIds)

  // Every locale must include all source messages, even if still untranslated.
  const ids = new Set([...Object.keys(english), ...announcementIds])
  for (const locale of locales) {
    const {messages} = require(
      path.join(root, 'src/locale/locales', locale, 'messages.ts'),
    )
    assertMessages(locale, messages, ids)
    const i18n = setupI18n({locale, messages: {[locale]: messages}})
    for (const id of announcementIds) {
      if (!i18n._(id).trim() || i18n._(id) === id) {
        throw new Error(`Unreadable announcement translation: ${locale}/${id}`)
      }
    }
  }
  console.log(
    `Release translations verified: ${ids.size} messages in ${locales.length} locales.`,
  )
}

module.exports = {announcementMessageIds, assertMessages, checkReleaseI18n}

if (require.main === module) checkReleaseI18n()
