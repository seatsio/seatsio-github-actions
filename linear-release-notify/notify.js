#!/usr/bin/env node
// Comments on each released issue, @mentioning its assignee.

const { warn, getAccessToken, graphql, addComment, restrictSubscribersToAssignee } = require("../lib/linear");

const { LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, RELEASE_ID, ENVIRONMENT } = process.env;
const message = ENVIRONMENT === "staging" ? "✅ Merged & on staging" : "🚀 Shipped to production";

async function main() {
  const token = await getAccessToken(LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET);
  if (!token) return warn("could not obtain app token; skipped");

  const res = await graphql(
    token,
    `query($id:String!){ release(id:$id){ issues(first:50){ nodes{ id identifier assignee{ id url } } } } }`,
    { id: RELEASE_ID }
  );
  if (res.errors) return warn(`could not fetch release issues: ${JSON.stringify(res.errors)}`);

  const issues = (res.data?.release?.issues?.nodes ?? []).filter((i) => i.assignee);
  for (const issue of issues) {
    if (!(await restrictSubscribersToAssignee(token, issue.id, issue.assignee.id)))
      warn(`could not restrict subscribers on ${issue.identifier}; commenting anyway`);
    const { ok, errors } = await addComment(token, issue.id, `${message} — ${issue.assignee.url}`);
    if (!ok) warn(`comment on ${issue.identifier} failed: ${JSON.stringify(errors)}`);
  }
}

main().catch((e) => warn(`unexpected error: ${e.message}`));
