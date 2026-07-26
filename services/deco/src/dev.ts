import { createApp } from './app.ts'

const app = await createApp()
Deno.serve({ port: Number(Deno.env.get('PORT') || 8787) }, app)
