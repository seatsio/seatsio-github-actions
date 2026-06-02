#!/usr/bin/env node
// Comments on a merged PR's Linear issue, @mentioning its assignee.

const { LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, PR_URL, PR_TITLE, PR_BODY, BRANCH_NAME, MESSAGE } = process.env;
const warn = (m) => console.log(`::warning::Linear notify: ${m}`);
const info = (m) => console.log(`Linear notify: ${m}`);

async function main() {
  const token = await mintToken();
  if (!token) return warn("could not obtain app token; skipped");

  const gql = async (query, variables) => {
    try {
      const r = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      return await r.json();
    } catch (e) {
      return { errors: [{ message: e.message }] };
    }
  };

  // branch → PR attachment → SEATS-### in title/body
  const issue =
    (await byBranch(gql, BRANCH_NAME)) ||
    (await byUrl(gql, PR_URL)) ||
    (await byMention(gql, `${PR_TITLE || ""} ${PR_BODY || ""}`));
  if (!issue) return info("no Linear issue found for this PR; skipped");
  if (!issue.assignee) return info(`${issue.identifier} has no assignee; skipped`);

  const res = await gql(
    `mutation($id:String!,$body:String!){ commentCreate(input:{issueId:$id,body:$body}){ success } }`,
    { id: issue.id, body: `${MESSAGE} — ${issue.assignee.url}` }
  );
  if (!res.data?.commentCreate?.success)
    warn(`comment on ${issue.identifier} failed: ${JSON.stringify(res.errors ?? res.data)}`);
}

async function byBranch(gql, branch) {
  if (!branch) return null;
  const r = await gql(
    `query($b:String!){ issueVcsBranchSearch(branchName:$b){ id identifier assignee{ url } } }`,
    { b: branch }
  );
  return r.data?.issueVcsBranchSearch ?? null;
}

async function byUrl(gql, url) {
  if (!url) return null;
  const r = await gql(
    `query($u:String!){ attachmentsForURL(url:$u){ nodes{ issue{ id identifier assignee{ url } } } } }`,
    { u: url }
  );
  return r.data?.attachmentsForURL?.nodes?.[0]?.issue ?? null;
}

async function byMention(gql, text) {
  const m = text.match(/([A-Z][A-Z0-9]*)-(\d+)/);
  if (!m) return null;
  const [identifier, key, number] = m;
  const r = await gql(
    `query($k:String!,$n:Float!){ issues(filter:{team:{key:{eq:$k}},number:{eq:$n}}, first:1){ nodes{ id identifier assignee{ url } } } }`,
    { k: key, n: Number(number) }
  );
  const node = r.data?.issues?.nodes?.[0];
  return node && node.identifier === identifier ? node : null; // exact-match guard
}

function mintToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: LINEAR_CLIENT_ID,
    client_secret: LINEAR_CLIENT_SECRET,
    scope: "read,comments:create",
  });
  return fetch("https://api.linear.app/oauth/token", { method: "POST", body })
    .then((r) => r.json())
    .then((j) => j.access_token)
    .catch(() => null);
}

main().catch((e) => warn(`unexpected error: ${e.message}`));
