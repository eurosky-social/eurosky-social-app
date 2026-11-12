# Supplements

A supplement is a temporary news theme, such as an election or the World Cup,
with coverage from various outlets. It has a title, a start date, an optional
end date and a topic. An editor adds and removes its articles, much as on a
[frontpage](../frontpages/editorial/README.md). Dutch and French readers see it
as a **dossier**.

News v2 only. With news v2 off, these routes are Not Found.

## Where they show

On their editor's frontpage (`FrontpageSupplements`, below its top bar): the
current ones, then the archive behind **Show archived supplements**. The
editor also sees their upcoming ones and **New supplement**. Readers see the
section only when there is something in it; it is hidden while the front page
itself is being arranged, and for an account the reader blocks or is blocked
by. A supplement's page names its editor, linking back to the frontpage.

- `/news/supplements/new` - a new one, as a draft in the editor.
- `/news/supplements/:name/:rkey` - one supplement, by handle or DID.

## Storage

Each supplement is a public `social.mu.supplement` record with a TID key, in
its editor's repository: `lexicons/social/mu/supplement.json`. As with
`social.mu.frontpage`, the client validates every read and write
(`supplement.ts`) and writes with `validate: false` until PDSes can discover the
lexicon. Compare-and-swap stops two editors overwriting each other.

An article is copied into the record when it is picked: address, headline,
summary, image, date and outlet. Readers need no news aggregator to read a
supplement, and it keeps working after its articles leave the aggregator's
archive. The copy does not follow later changes to the article.

Only `http` and `https` addresses are accepted, and a malformed record is left
out of the list rather than hiding the others.

## Archiving

Nothing runs at the end date. `supplementStatus` works it out from the dates and
the reader's calendar day, which are `YYYY-MM-DD` with no time zone: current
through the last day, archived from the day after. An archived supplement can
still be opened, and its editor can still change it; moving the end date brings
it back. Without an end date it stays current.

## Editing

Only the account holding the record sees **Edit**. Changes stay in a local draft
until **Publish**; **Discard** drops them. In the draft:

- **Add articles** searches every outlet (`GET /api/articles/search`), starting
  from the supplement's topic and dates. Unticking **Only this topic and these
  dates** searches everything.
- **Add an article by link** takes any page with a headline, for a source the
  aggregator does not read. Its outlet is named after the site.
- Each article can be moved up or down, or removed. The first is the lead. The
  same article cannot be added twice (`articleLinkKey`), and there is room for
  100.
- **Delete** removes the record, after asking.

The topic comes from the aggregator's vocabulary (`GET /api/topics`), so
supplements and the article search share one list. The record keeps the topic's
name too, for when the vocabulary changes.

## Finding them

Nothing indexes these records, and nothing needs to: a frontpage lists its own
account's, read from that account's repository. There is no list across
editors.

## Not built

- Several editors on one supplement: a record belongs to one account.
- Posts as items: a supplement holds articles only.
- A list of every editor's supplements: they are found through frontpages.

Tests: `pnpm test --runInBand src/features/supplements`.
