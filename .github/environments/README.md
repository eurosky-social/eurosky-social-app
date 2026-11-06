# Web deploy environments

Every web deploy goes through one workflow, `.github/workflows/deploy-web.yml`,
and one build entrypoint, `scripts/web_build.sh <environment>`. Each deploy
target is a [GitHub environment](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
of the same name as a file in this directory.

| Environment   | URL                       | Deployed by                 | Brand |
| ------------- | ------------------------- | --------------------------- | ----- |
| `production`  | https://mu.social         | push to `eurosky/deploy`    | Mu    |
| `staging`     | https://staging.mu.social | push to `eurosky/fork`      | Mu    |
| `dev`         | https://dev.mu.social     | manual run, any branch      | Mu    |
| `news`        | https://news.mu.social    | manual run, permitted branch | Mu    |
| `oso`         | https://oso.mu.social     | manual run from `oso`       | Oso   |

## What lives where

- **In git (this directory):** every build setting. `common.env` holds what all
  environments share; `<environment>.env` holds only what differs, loaded on
  top. Changes are reviewed in PRs and `diff staging.env production.env` shows
  exactly how two environments differ.
- **In the GitHub environment:** the Bunny credentials and the rules for who
  can deploy. Secrets set on an environment are only readable by a job bound
  to it, so production credentials are out of reach of any other branch.

Build the exact bundle CI would, without deploying:

```bash
./scripts/web_build.sh staging
```

## News testing deployment

`news.env` selects `EXPO_PUBLIC_PRODUCT=news` while retaining Mu branding and the
shared services in `common.env`. It does not use the dev News V2 backend.

OAuth metadata is published at
`https://news.mu.social/oauth-client-metadata.json`, with the return URL
`https://news.mu.social/`. Assertions come from the existing
`https://oauth-staging.mu.social/client-assertion` worker, which accepts HTTPS
subdomains of `mu.social` and derives a separate client identity per origin.
No new signing service or key is needed for this preview; see
[`services/oauth/README.md`](../../services/oauth/README.md).

Create a GitHub environment named `news` with its own Bunny credentials and
permit the testing branch (initially `flo/news-app`). Then run **Deploy web**
manually against that branch and environment. The branch must contain
`news.env` and the news app changes; this does not add an automatic push deploy.

`ROBOTS_MODE=disallow-all` keeps crawlers out but is not access control. The
existing Bunny edge preset is disabled for this environment because it assumes
the apex hostname and blocks some machine user-agents. Configure SPA fallback,
HTTP status handling and caching on the new news zone separately before testing
live OAuth and direct links.

## Adding an environment

1. Add `<name>.env` here (start from `dev.env`). Set `DEPLOY_URL`, and for
   non-production `ROBOTS_MODE=disallow-all`, its own
   `EXPO_PUBLIC_OAUTH_BASE_URL` and `EXPO_PUBLIC_PLAUSIBLE_DOMAIN`.
2. Create the GitHub environment `<name>` with the three `BUNNY_*` secrets
   below. It then appears in the "Run workflow" environment picker.

No workflow change is needed. A push trigger for a new branch is the one
exception: add the branch to `on.push` and to the environment expression in
`deploy-web.yml`.

## GitHub environment settings

Creating environments needs admin on the repository.

| Environment   | Deployment branches         | Reviewers           |
| ------------- | --------------------------- | ------------------- |
| `production`  | `eurosky/deploy` only       | optional            |
| `staging`     | `eurosky/fork` only         | none                |
| `dev`         | any                         | none                |
| `news`        | `flo/news-app` initially     | none                |
| `oso`         | `oso` only                  | recommended         |

Secrets on each environment:

- `BUNNY_STORAGE_ZONE` – full storage URL, e.g.
  `https://storage.bunnycdn.com/eurosky-app`
- `BUNNY_STORAGE_PASSWORD` – that storage zone's password
- `BUNNY_PULLZONE_ID` – numeric pull zone id

`BUNNY_API_KEY` (account-level) stays a repository secret shared by environments;
an environment secret of the same name would override it.

## Migrating from the per-environment workflows

The old workflows read prefixed repository secrets (`STAGING_BUNNY_*`,
`DEV_BUNNY_*`, `OSO_PREVIEW_BUNNY_*`, and unprefixed for production). Secret
values cannot be read back from GitHub, so they are re-entered from the Bunny
dashboard:

1. Create the four environments with the branch rules above.
2. Set the three `BUNNY_*` secrets on each, from that environment's Bunny zone.
3. Merge. The next push to `eurosky/fork` deploys staging through the new
   workflow; check the run, then run `dev` manually once.
4. Delete the old repository secrets: `BUNNY_STORAGE_ZONE`,
   `BUNNY_STORAGE_PASSWORD`, `BUNNY_PULLZONE_ID` and every `STAGING_`, `DEV_`
   and `OSO_PREVIEW_` `BUNNY_*` secret. **This step matters:** an environment
   missing one of its own secrets silently falls back to a repository secret
   of the same name, which until then is production's. The workflow refuses
   the production pull zone outside `production`, but that is a backstop.

`EXPO_TOKEN` and the native release secrets are unaffected; the EAS workflows
are upstream's and do not use these environments.
