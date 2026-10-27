# Courier – push delivery for mu

Courier keeps the device tokens of mu installs and delivers the AppView's
notifications to them through Apple (APNs) and Google (FCM).

"Courier" is the name of Bluesky's push service, which is closed source. The
AppView talks to it through a fixed interface, `courier.Service` in
[`proto/courier.proto`](proto/courier.proto) (copied unchanged from
`packages/bsky/proto/courier.proto` in atproto). This service implements that
interface, so the AppView needs configuration, not code changes.

## How it fits together

```
mu app ──registerPush──▶ PDS ──▶ AppView ──RegisterDeviceToken──▶ Courier ──▶ Postgres
                         (proxied to the #bsky_notif service of the AppView's DID document)

new row in the AppView's notification table
  ──▶ push bridge (AppView dataplane) ──PushNotifications──▶ Courier ──▶ APNs / FCM ──▶ device
```

The decision of _what_ to push is made by the push bridge in the AppView
(Blacksky's atproto fork, `notification-push-bridge.ts`): it applies blocks,
mutes, thread mutes, takedowns and the user's notification settings, writes
the text, and retries a batch for up to a day when Courier does not answer.
Courier only stores tokens and delivers.

## The send queue

Courier saves every accepted send in Postgres (`push_job`) before it answers
the AppView, so a crash or restart loses nothing:

1. `PushNotifications` records the notification ids (`notification_receipt`),
   looks up the recipients' devices and queues one job per device, all in one
   transaction. Only then does the AppView hear "accepted".
2. A worker claims due jobs (`for update skip locked`, so several instances
   never share one) up to `COURIER_SEND_CONCURRENCY`. Claiming moves the job's
   next attempt 60 s ahead: if the process dies mid-send, the job comes due
   again and is sent after the restart. Apple or Google may then get it
   twice; that is the price of not losing it.
3. A sent job is deleted. A passing failure (rate limit, outage, dropped
   connection) is rescheduled 5 s, 20 s, 80 s, ... up to 30 min later, until
   the job expires. Anything else is logged, counted and deleted.

The AppView's push bridge saves a batch only when handing it over fails, and
it receives new notifications through Postgres `LISTEN`, so notifications
created while its dataplane restarts are not pushed. That gap is in the
AppView, not here.

## What it sends

iOS (APNs alert push, priority 10):

```json
{
  "aps": {
    "alert": {"title": "Alice", "body": "replied: nice photo"},
    "mutable-content": 1,
    "sound": "default"
  },
  "reason": "reply",
  "uri": "at://…",
  "subject": "at://…",
  "recipientDid": "did:plc:…"
}
```

Android (FCM data-only message, high priority): `title` and `message` are
shown by the app, `reason` picks the notification channel, and `body` holds
the AppView's fields as JSON, which expo-notifications turns into the
notification's data.

Both match what `src/lib/hooks/useNotificationHandler.ts`,
`modules/BlueskyNSE` and `modules/expo-background-notification-handler`
read.

Behaviour worth knowing:

- **Age-restricted accounts** (the app sends `ageRestricted` when it
  registers) get `COURIER_GENERIC_TITLE` / `COURIER_GENERIC_MESSAGE` instead of
  names and post text. Tapping still opens the right screen.
- **Client-controlled pushes** (the AppView's "mark read" sync after
  `updateSeen`) go out silently, with `recipientDid` added: an APNs
  background push (`content-available`, priority 5) and an FCM data message
  without `title`/`message` at normal priority, collapsed by its key while the
  device is offline. The app clears that account's notifications and the
  badge. iOS delivers background pushes best-effort: not to a force-quit app,
  and throttled when frequent.
- **Retries from the AppView** reuse notification ids; ids seen in the last
  day are not pushed again, also across restarts.
- **Stale notifications** older than `COURIER_TTL_SECONDS` are dropped, so a
  long AppView retry or an indexer backfill does not flood phones.
- **Dead tokens** (APNs `Unregistered`/`BadDeviceToken`, FCM `UNREGISTERED`)
  are deleted for every account on that device. A token the app registered
  again after Apple's verdict is kept.
- **A full send queue** (`COURIER_MAX_QUEUED_SENDS`) answers
  `ResourceExhausted`. The AppView keeps the batch in its own retry queue
  instead of Courier growing without limit during a long outage.

## Configuration

See [`env.example`](env.example). Credentials are read from files so
multi-line keys never pass through an env file.

| Variable | Default | Meaning |
| --- | --- | --- |
| `COURIER_API_KEYS` | required | Accepted bearer keys, comma-separated |
| `COURIER_DATABASE_URL` | required | Postgres; tables are created on start |
| `COURIER_HOST` / `COURIER_PORT` | `127.0.0.1` / `2587` | Listener |
| `COURIER_HTTP_VERSION` | `1.1` | `1.1` or `2` (HTTP/2 without TLS) |
| `COURIER_APP_IDS` | `social.mu.app` | App ids that may register; iOS topic |
| `COURIER_APNS_KEY_FILE` | – | `.p8` key; enables iOS |
| `COURIER_APNS_KEY_ID` / `COURIER_APNS_TEAM_ID` | – | From the Apple developer account |
| `COURIER_APNS_ENVIRONMENT` | `production` | `sandbox` for development builds |
| `COURIER_FCM_SERVICE_ACCOUNT_FILE` | – | Service account JSON; enables Android |
| `COURIER_TTL_SECONDS` | `86400` | Delivery window and staleness cut-off |
| `COURIER_SEND_CONCURRENCY` | `64` | Parallel sends |
| `COURIER_MAX_QUEUED_SENDS` | `100000` | Queued sends before batches are refused |
| `LOG_LEVEL` | `info` | pino level |

At least one of APNs and FCM must be configured.

### AppView side

On the AppView (`bsky-appview`, for register/unregister) and its dataplane
(`bsky-dataplane`, for the push bridge):

```
BSKY_COURIER_URL=http://127.0.0.1:2587
BSKY_COURIER_API_KEY=<one of COURIER_API_KEYS>
BSKY_COURIER_HTTP_VERSION=1.1   # must match COURIER_HTTP_VERSION
```

and on the dataplane only:

```
BSKY_NOTIFICATION_PUSH_WORKER_ENABLED=true
```

Until `BSKY_COURIER_URL` is set, the AppView answers `registerPush` with "not
implemented" and the app logs a warning.

## Running it

Node 22.18 or later runs the TypeScript sources directly (type stripping), so
there is no build step.

```bash
npm ci
cp env.example .env   # then fill it in
node --env-file=.env src/bin.ts
```

Operations endpoints (no API key, so keep the listener on loopback):

- `GET /_health` – `200` when Postgres answers, else `503`
- `GET /metrics` – Prometheus: `courier_notifications_total{outcome}`,
  `courier_deliveries_total{platform,kind,outcome}` (outcome `retry` = rescheduled),
  `courier_registrations_total{platform}`,
  `courier_tokens_pruned_total{platform}`, `courier_send_queue_depth`, plus
  Node process metrics

Logs are JSON lines on stdout.

## Development

```bash
npm run typecheck
npm test                                   # Postgres tests skip without a database
COURIER_TEST_DATABASE_URL=postgres://… npm test
npm run gen                                # after changing proto/courier.proto
```

Code generated from the protocol lives in `src/gen` (JavaScript plus type
declarations: generated enums are not erasable syntax, which Node's type
stripping requires).

## Not covered

- **Direct messages.** mu uses Bluesky's chat service, which pushes through
  Bluesky's own Courier. It cannot reach an app signed with our keys.
- **Web push.** Registrations for the `web` platform are refused.
- **Development builds.** Their tokens only work with the APNs sandbox, so a
  production Courier deletes them on the first send. Test pushes with
  TestFlight builds.
