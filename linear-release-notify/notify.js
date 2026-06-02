#!/usr/bin/env node
// Comments on each released issue, @mentioning its assignee.

const { LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, RELEASE_ID, ENVIRONMENT } = process.env;
const warn = (m) => console.log(`::warning::Linear notify: ${m}`);
const message = ENVIRONMENT === "staging" ? "✅ Merged & on staging" : "🚀 Shipped to production";

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

  const read = await gql(
    `query($id:String!){ release(id:$id){ issues(first:250){ nodes{ id identifier assignee{ url } } } } }`,
    { id: RELEASE_ID }
  );
  if (read.errors) return warn(`could not fetch release issues: ${JSON.stringify(read.errors)}`);

  const issues = (read.data?.release?.issues?.nodes ?? []).filter((i) => i.assignee);
  for (const issue of issues) {
    const res = await gql(
      `mutation($id:String!,$body:String!){ commentCreate(input:{issueId:$id,body:$body}){ success } }`,
      { id: issue.id, body: `${message} — ${issue.assignee.url}` }
    );
    if (!res.data?.commentCreate?.success)
      warn(`comment on ${issue.identifier} failed: ${JSON.stringify(res.errors ?? res.data)}`);
  }
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
