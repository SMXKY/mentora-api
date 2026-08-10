# Tutor Search — Meilisearch

Replaces the old raw-SQL trigram-similarity search plus a manually
maintained EN/FR synonym dictionary (`searchSynonyms.ts`, now deprecated
but kept in the repo, see the comment at the top of that file) with a
self-hosted Meilisearch index. Scoped to tutor search only, no other
module was touched.

## Why this exists

The old dictionary approach did not scale past roughly 200 subjects and
required a code change (and a deploy) every time a new subject needed an
EN/FR pairing. Meilisearch's own synonyms feature holds the same data but
as index settings rather than app code, plus gets typo tolerance and
French accent handling for free, neither of which the old approach had at
all.

## Index

One index, `tutors` (`TUTOR_INDEX_UID` in `meilisearchTutorIndex.ts`).

- Searchable, in priority order: `subjectNames`, `firstName`,
  `lastNameInitial`, `bio`, `cityName`.
- Filterable: `subjectIds`, `levelIds`, `cityId`, `teachingMode`,
  `languages`, `minRateXaf`, `maxRateXaf`, `gender`, `kycStatus`,
  `introVideoVerified`, `_geo`.
- Sortable: `compositeScore`, `boostScore`, `_geo`.
- Ranking rules: the Meilisearch defaults
  (`words, typo, proximity, attribute, sort, exactness`) followed by
  `compositeScore:desc, boostScore:desc` as final tie-breakers. Relevance
  and typo tolerance always win first, the composite score and new-tutor
  boost only decide ties.
- Synonyms: seeded from `SYNONYM_GROUPS` (the old dictionary's data,
  reused as a seed rather than rewritten), see `buildSynonymsSettings()`.

A document is only ever present in the index if the tutor currently
passes the same hard-visibility bar the old search always enforced: not
soft-deleted, `kycStatus: ACTIVE`, verified intro video, at least one
approved+open-for-booking subject. See `isSearchVisible()` in
`meilisearchTutorIndex.ts`. A tutor that stops qualifying gets removed
from the index entirely rather than flagged hidden, so a filter bug can
never leak them into results.

## Sync

No webhook, no polling cron. `indexTutor(tutorProfileId)` is called from
`recomputeTutorScore()` in `searchScore.processor.ts`, the same function
every tutor-affecting mutation already funnels through via
`queueScoreRecompute()` (profile edits, subject approval, availability
changes, ratings, KYC suspend/unsuspend). The nightly `sweepAllActiveTutors()`
job that already existed for compositeScore doubles as a full-index
safety net for free.

Known gap: direct profile-field edits (bio, city, teachingMode, languages)
were not confirmed during this work to route through `queueScoreRecompute()`.
If a tutor's document does not update after one of those edits, that call
site is the first place to check.

## EN/FR handling

No per-document language field, no separate language detection step.
Meilisearch's default tokenizer already handles French accents and
diacritics correctly, and the synonyms settings (see above) cover the
cross-language subject-name pairs the old dictionary hardcoded.

## New-tutor boost

`boostScore` is `1` or `0` on each document, computed at index time from
the same `isNewTutorBoostEligible()` check `compositeScore.ts` already
used. It only ever breaks a tie after relevance and `compositeScore`, per
"slight ranking boost," not a way for a new tutor to outrank a
well-established one on relevance alone.

## Geo (home-session search only)

Geo point comes from the tutor's **city centroid**, not per-tutor
precision. `City.latitude`/`City.longitude` (nullable, migration
`add_city_coordinates`) are copied onto the document at index time,
only when the tutor's `teachingMode` includes `HOME` and their city has
been geocoded. A tutor without a `_geo` field on their document simply
never participates in geo sort, it does not error.

Geo sort only activates when `query.mode === 'HOME_ONLY'`
(`shouldApplyGeoSort()` in `tutorSearch.service.ts`) and an origin could
be resolved for the request. `BOTH` does not trigger it, "either is fine"
is not the same signal as "I want in-person."

**Origin resolution** (`searchOrigin.resolver.ts`), in priority order:
1. `lat`/`lng` query params, sent by the client when it has GPS
   permission.
2. Self-hosted MaxMind GeoLite2 City lookup against the request IP.
   Requires `GEOLITE2_DB_PATH` pointing at a `.mmdb` file, downloaded
   manually (MaxMind requires a free account plus license key, not
   npm-installable), and refreshed periodically. Optional: unset just
   means this tier is skipped, not an error.
3. No origin at all, geo sort is skipped and the search falls back to
   plain relevance/compositeScore/boostScore ranking. Never blocks or
   errors a search for missing location.

Geo is sort-only right now, not a radius filter, there is no `radiusKm`
param in the query contract. Adding one is possible later via
Meilisearch's `_geoRadius()` filter, but that is a contract change and
needs the same sign-off any other contract change does.

## One-time setup

- `npm run search:backfill-cities` — geocodes existing `City` rows via
  OpenStreetMap's Nominatim search (`cli/backfillCityCoordinates.ts`), no
  API key, no billing account, genuinely free. Rate-limited to 1
  request/second per Nominatim's usage policy, which is fine for a
  one-time run over a small city list, it would not be fine to call this
  per search request (and it never is, City coordinates are geocoded once
  and reused as a centroid). Safe to re-run, only touches rows still
  missing coordinates.
- `npm run search:backfill-tutors` — configures the index settings, then
  indexes every existing tutor profile. Safe to re-run any time.
- `MEILI_MASTER_KEY` must be set before `docker compose up`, the compose
  file refuses to start the service without it (no default/open key).
- `GEOLITE2_DB_PATH` is optional, see the geo section above. To get the
  actual database file:
  1. Create a free MaxMind account at
     https://www.maxmind.com/en/geolite2/signup (no cost, no credit card).
  2. Generate a license key under Account -> My License Keys.
  3. Download `GeoLite2-City.mmdb` from
     https://www.maxmind.com/en/accounts/current/geoip/downloads
     (or via MaxMind's `geoipupdate` CLI tool for automatic periodic
     refreshes, recommended if this goes to production, MaxMind updates
     the database roughly weekly).
  4. Place the file at `geoip/GeoLite2-City.mmdb` in the repo root
     (already gitignored, this is licensed data, not source) and point
     `GEOLITE2_DB_PATH` at that path.

## Request/response contract

`GET /tutor-search/tutors` kept its exact existing query schema and
response shape (`data`/`meta` with `nextCursor`/`hasNextPage`/`refineNudge`,
plus the `fallback` zero-result shapes). The only additions are two new
optional query params, `lat`/`lng`, for GPS-origin passthrough. Everything
else about the contract is unchanged, cursor pagination still means "the
id of the last tutor on the previous page," Meilisearch's own offset
pagination is an internal implementation detail translated back into that
same cursor shape by `fetchPageForCandidateIds()`.
