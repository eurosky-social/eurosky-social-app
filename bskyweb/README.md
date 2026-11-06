## Build / Develop

### SPA Bundle (monolithic static javascript file)

To build the SPA bundle (`bundle.web.js`), first get a JavaScript development
environment set up. Either follow the top-level README, or something quick
like:

```bash
# install nodejs
nvm install
nvm use
npm install --global pnpm

# setup tools and deps (in top level of this repo)
pnpm install --frozen-lockfile

# run pnpm web dev server, if you wanted
pnpm web
```

Then build and copy over the big 'ol `bundle.web.js` file:

```bash
# in the top level of this repo
pnpm build-web
```

### Golang Daemon

Install golang. We generally develop against the current stable release of the language, as declared in `go.mod`.

In this directory (`bskyweb/`):

```bash
# re-build and run daemon
go run ./cmd/bskyweb serve

# build and output a binary
go build -o bskyweb ./cmd/bskyweb/
```

The easiest way to configure the daemon is to copy `example.env` to `.env` and
fill in auth values there.

## Web app statics: embedded and remote modes

`bskyweb` serves the web app's build output (`static/_expo/`, `static/assets/`)
and the template fragments that load it (`templates/scripts.html`,
`templates/fonts.html`) in one of two modes:

- **Embedded mode** (default, `BSKY_APP_VERSION` unset): serves the build
  embedded in the binary at compile time, produced by `pnpm build-web`. Local
  development and Render use this mode.
- **Remote mode** (`BSKY_APP_VERSION` set to a social-app commit SHA): serves
  that build from S3 (`BSKY_APP_STATICS_BUCKET` and `BSKY_APP_STATICS_REGION`,
  which default to production). The `publish-web-statics` GitHub workflow
  publishes builds there under `<commit SHA>/`. This lets the web app be
  deployed without a new `bskyweb` image.

In remote mode nothing is downloaded at startup. Each file is fetched the first
time it's needed and kept in memory for the life of the process, and concurrent
requests for the same file share one download. Until the fragments can be
loaded, `/` returns a 500, so the pod doesn't become ready. Everything else
(page templates, favicons, `robots.txt`, etc.) always comes from the binary.
Debug mode ignores `BSKY_APP_VERSION`.

## Feature settings

Feature settings are compiled into the app from `src/analytics/features/`.
The server does not fetch remote feature configuration or embed a feature-gate
payload in app HTML.
