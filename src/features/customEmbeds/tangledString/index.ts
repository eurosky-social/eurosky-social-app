import {createTangledStringEmbed} from '@social-app-community/embed-tangled-string'

import {readTangledStringRecord} from './readRecord'
import {tangledStringUi} from './ui'

export const tangledStringHandler = createTangledStringEmbed({
  readRecord: readTangledStringRecord,
  ui: tangledStringUi,
})
