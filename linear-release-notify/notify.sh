#!/usr/bin/env bash
# Comments on each issue in the Linear release, @mentioning its assignee.
set -uo pipefail

warn() { echo "::warning::Linear notify: $*"; }

case "$ENVIRONMENT" in
  staging) msg="✅ Merged & on staging" ;;
  *)       msg="🚀 Shipped to production" ;;
esac

# 1. Get Token
token=$(curl -s https://api.linear.app/oauth/token \
  --data-urlencode grant_type=client_credentials \
  --data-urlencode "client_id=$LINEAR_CLIENT_ID" \
  --data-urlencode "client_secret=$LINEAR_CLIENT_SECRET" \
  --data-urlencode 'scope=read,comments:create' | jq -r '.access_token // empty')
[ -n "$token" ] || { warn "could not obtain app token; skipped"; exit 0; }

gql() {
  curl -s https://api.linear.app/graphql \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    --data @-
}

# 2. Fetch every issue in the release together with its assignee.
read_q='query($id:String!){ release(id:$id){ issues(first:250){ nodes{ id identifier assignee{ url } } } } }'
resp=$(jq -n --arg q "$read_q" --arg id "$RELEASE_ID" '{query:$q,variables:{id:$id}}' | gql)
errs=$(jq -rc '.errors // empty' <<<"$resp" 2>/dev/null)
[ -z "$errs" ] || { warn "could not fetch release issues: $errs"; exit 0; }

# 3. Comment on each assigned issue.
comment_m='mutation($id:String!,$body:String!){ commentCreate(input:{issueId:$id,body:$body}){ success } }'
jq -c '.data.release.issues.nodes[]? | select(.assignee)' <<<"$resp" | while read -r issue; do
  id=$(jq -r '.id' <<<"$issue")
  ref=$(jq -r '.identifier' <<<"$issue")
  body="$msg — $(jq -r '.assignee.url' <<<"$issue")"
  out=$(jq -n --arg q "$comment_m" --arg id "$id" --arg body "$body" \
    '{query:$q,variables:{id:$id,body:$body}}' | gql)
  [ "$(jq -r '.data.commentCreate.success // false' <<<"$out")" = "true" ] \
    || warn "comment on $ref failed: $(jq -rc '.errors // empty' <<<"$out")"
done
