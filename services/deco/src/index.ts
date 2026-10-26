import * as BunnySDK from '@bunny.net/edgescript-sdk'

import { createApp } from './app.ts'

const app = await createApp()
BunnySDK.net.http.serve(app)
