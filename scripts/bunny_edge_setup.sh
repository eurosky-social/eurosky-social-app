#!/usr/bin/env bash
# Eurosky fork: configure the Bunny.net pull zone (5945167) for the mu.social
# bot-crawl incident. Two parts:
#
#   A. Global network limits (per client IP, whole zone) - the real bandwidth
#      guard. A throttled/blocked request costs a few hundred bytes instead of
#      a ~2 MB JS bundle, so this is what caps anything ignoring robots.txt.
#
#   B. Three edge rules - caching hygiene (1, 2) plus a cheap block for naive
#      library scrapers (3). Caching does NOT lower the bill (Bunny bills
#      edge->client delivery on every hit); it only saves origin reads and
#      improves hit ratio/latency.
#
# We do NOT block Googlebot (66.249.64.0/19) here - robots.txt already stops it
# crawling the high-cardinality paths, and hard-blocking it can hurt ranking.
#
# Reads from the environment (or ./.env):
#   BUNNY_API_KEY       account-level API key (Account Settings -> API)
#   BUNNY_PULLZONE_ID   numeric pull zone id, required (5945167 = prod, or the
#                       staging/dev zone id). No default - see the check below.
#
# Usage (from the repo root):
#   ./scripts/bunny_edge_setup.sh
#
# Idempotent: the pull-zone update overwrites those fields, and each edge rule
# is matched to an existing one by its Description (see merge_guid) so re-runs
# update in place instead of creating duplicates. Safe to run repeatedly.
#
# API refs:
#   Update pull zone:  POST https://api.bunny.net/pullzone/{id}
#   Add/update rule:   POST https://api.bunny.net/pullzone/{id}/edgerules/addOrUpdate
#
# Field mappings verified against the official BunnyWay Terraform provider
# (internal/api/pullzone.go), 2026-07 - the dashboard "Network limits" inputs:
#   Requests limits (req/s per IP) -> RequestLimit
#   Burst requests                 -> BurstSize
#   Maximum connections per IP     -> ConnectionLimitPerIPCount
#   Download speed limits (kB/s)   -> LimitRatePerSecond   (NOT requests!)
#   Limit after (kB)               -> LimitRateAfter
#   Monthly bandwidth limit (bytes)-> MonthlyBandwidthLimit
#
# Edge-rule enums (docs.bunny.net):
#   ActionType:  OverrideCacheTime=3  BlockRequest=4  OverrideBrowserCacheTime=16
#   TriggerType: Url=0  RequestHeader=1
#   MatchType:   MatchAny=0
# ActionParameter1 carries the action's value (seconds for the cache overrides).
set -euo pipefail

if [[ -z "${BUNNY_API_KEY:-}" || -z "${BUNNY_PULLZONE_ID:-}" ]]; then
  if [[ -f .env ]]; then set -a; . ./.env; set +a; fi
fi
: "${BUNNY_API_KEY:?set BUNNY_API_KEY (account-level API key)}"
# Required, no default: this script runs against prod (5945167), staging, and
# dev zones. A silent prod fallback here would let a staging/dev deploy with a
# missing/empty pull-zone secret reconfigure PRODUCTION. Fail loudly instead.
: "${BUNNY_PULLZONE_ID:?set BUNNY_PULLZONE_ID (numeric pull zone id, e.g. 5945167 for prod)}"

API="https://api.bunny.net/pullzone/${BUNNY_PULLZONE_ID}"
HDR_KEY="AccessKey: ${BUNNY_API_KEY}"
HDR_JSON="Content-Type: application/json"

say() { printf '\n== %s\n' "$*"; }

# Snapshot of existing edge rules, fetched once so re-runs are idempotent.
# addOrUpdate CREATES when no Guid is given and UPDATES when a Guid is given -
# but a Guid that does not exist yet 404s ("edge_rule_not_found"). So we never
# hardcode a Guid: instead we match an existing rule by its Description and
# reuse its Guid, otherwise create fresh.
PZ_FILE="$(mktemp)"
trap 'rm -f "$PZ_FILE"' EXIT
curl -sS "$API" -H "$HDR_KEY" > "$PZ_FILE"

# Inject the Guid of the already-existing rule with the same Description (if
# any) into the given body, so a re-run updates in place instead of adding a
# duplicate. Prints the (possibly augmented) body.
merge_guid() {
  BODY="$1" PZ="$PZ_FILE" python3 -c '
import os, json
body = json.loads(os.environ["BODY"])
try:
    pz = json.load(open(os.environ["PZ"]))
    for r in pz.get("EdgeRules", []):
        if r.get("Description") == body.get("Description"):
            body["Guid"] = r["Guid"]
            break
except Exception:
    pass
print(json.dumps(body))'
}

# POST an edge rule body (Guid resolved via merge_guid); fail loudly on non-2xx.
add_rule() {
  local desc="$1" body code
  body="$(merge_guid "$2")"
  code=$(curl -sS -o /tmp/bunny_rule.out -w '%{http_code}' -X POST \
    "${API}/edgerules/addOrUpdate" -H "$HDR_KEY" -H "$HDR_JSON" -d "$body")
  if [[ "$code" == 2* ]]; then
    echo "  ok   ${desc}"
  else
    echo "  FAIL ${desc} (HTTP $code)"; cat /tmp/bunny_rule.out; echo; return 1
  fi
}

# ---------------------------------------------------------------------------
# A. Global network limits (per client IP)
# ---------------------------------------------------------------------------
# RequestLimit is the sustained per-IP ceiling; BurstSize absorbs the ~30-50
# request fan-out of a real cold page load so genuine users are not 429'd.
# LimitRatePerSecond / LimitRateAfter are the download-SPEED throttle (kB/s) -
# left at 0 (unlimited) because slowing a download does not reduce bytes billed
# and would hurt real users. MonthlyBandwidthLimit=0 (no hard kill-switch).
say "Updating global network limits (per-IP throttling)"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' -X POST "$API" \
  -H "$HDR_KEY" -H "$HDR_JSON" -d '{
    "RequestLimit": 4,
    "BurstSize": 50,
    "ConnectionLimitPerIPCount": 20,
    "LimitRatePerSecond": 0,
    "LimitRateAfter": 0,
    "MonthlyBandwidthLimit": 0
  }'

# ---------------------------------------------------------------------------
# B. Edge rules
# ---------------------------------------------------------------------------

# 1. Immutable long cache for content-hashed assets (/static/js, css, media).
#    OverrideCacheTime (edge) + OverrideBrowserCacheTime = 1 year.
say "Edge rule 1: cache /static/* for 1 year (immutable)"
add_rule "cache /static/ 1y" '{
  "ActionType": 3,
  "ActionParameter1": "31536000",
  "Enabled": true,
  "Description": "Cache immutable hashed assets for 1 year",
  "TriggerMatchingType": 0,
  "Triggers": [
    {"Type": 0, "PatternMatchingType": 0, "Parameter1": null,
     "PatternMatches": ["https://mu.social/static/*", "*/static/*"]}
  ],
  "ExtraActions": [
    {"ActionType": 16, "ActionParameter1": "31536000", "ActionParameter2": null}
  ]
}'

# 2. Keep the HTML shell + service worker + manifests short-lived so a deploy
#    (which also purges) is picked up immediately. 5 minutes.
say "Edge rule 2: short cache for HTML shell / index"
add_rule "cache html 5m" '{
  "ActionType": 3,
  "ActionParameter1": "300",
  "Enabled": true,
  "Description": "Short cache for index.html / SW / manifests",
  "TriggerMatchingType": 0,
  "Triggers": [
    {"Type": 0, "PatternMatchingType": 0, "Parameter1": null,
     "PatternMatches": ["https://mu.social/", "*/index.html", "*/service-worker.js", "*/manifest.json", "*/robots.txt"]}
  ]
}'

# 3. Block obvious non-browser scraper user-agents. Catches naive libraries
#    only; the JS-executing fleet spoofs real Chrome and is handled by the
#    per-IP limits above (or Bunny Shield). Extend as you spot offenders.
#
#    Bunny allows at most 5 PatternMatches per rule, so the UA list is chunked
#    into groups of 5, each emitted as its own rule ("... (group N)"). Add or
#    remove entries in UA_PATTERNS freely; the chunking adjusts automatically.
UA_PATTERNS='["*python-requests*","*python-httpx*","*Go-http-client*","*Scrapy*","*curl/*","*wget*","*libwww-perl*","*Java/*","*okhttp*","*node-fetch*","*axios*","*spider*"]'
say "Edge rule 3: block naive scraper user-agents (<=5 patterns/rule)"
while IFS= read -r body; do
  [[ -n "$body" ]] || continue
  add_rule "block scraper UAs" "$body"
done < <(UAS="$UA_PATTERNS" python3 -c '
import os, json
uas = json.loads(os.environ["UAS"])
chunks = [uas[i:i+5] for i in range(0, len(uas), 5)]
for idx, ch in enumerate(chunks, 1):
    print(json.dumps({
        "ActionType": 4,
        "Enabled": True,
        "Description": f"Block scraper user-agents (group {idx})",
        "TriggerMatchingType": 0,
        "Triggers": [{"Type": 1, "Parameter1": "User-Agent",
                      "PatternMatchingType": 0, "PatternMatches": ch}],
    }))
')

say "Done. Review the rules in the Bunny dashboard -> Pull Zone -> Edge Rules,"
echo "and the per-IP limits under Pull Zone -> Security -> Network limits."
