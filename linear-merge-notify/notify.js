#!/usr/bin/env node
// Comments on a merged PR's Linear issue, @mentioning its assignee; optionally moves it to a state.

const { warn, getAccessToken, graphql, addComment, restrictSubscribersToAssignee, moveIssueToState } = require("../lib/linear");

const { LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, PR_URL, PR_TITLE, PR_BODY, BRANCH_NAME, MESSAGE, TARGET_STATE } = process.env;
const info = (m) => console.log(`Linear notify: ${m}`);

async function main() {
  const token = await getAccessToken(LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET);
  if (!token) return warn("could not obtain app token; skipped");

  // branch → PR attachment → SEATS-### in title/body
  const issue =
    (await findIssueByBranch(token, BRANCH_NAME)) ||
    (await findIssueByPrUrl(token, PR_URL)) ||
    (await findIssueByIdentifier(token, `${PR_TITLE || ""} ${PR_BODY || ""}`));
  if (!issue) return info("no Linear issue found for this PR; skipped");

  if (TARGET_STATE) await moveState(token, issue);

  if (!issue.assignee) return info(`${issue.identifier} has no assignee; skipped`);

  if (!(await restrictSubscribersToAssignee(token, issue.id, issue.assignee.id)))
    warn(`could not restrict subscribers on ${issue.identifier}; commenting anyway`);

  const { ok, errors } = await addComment(token, issue.id, `${MESSAGE} — ${issue.assignee.url}`);
  if (!ok) warn(`comment on ${issue.identifier} failed: ${JSON.stringify(errors)}`);
}

// Moves the issue to the TARGET_STATE id unless it's already completed/canceled.
async function moveState(token, issue) {
  const type = issue.state?.type;
  if (type === "completed" || type === "canceled") return info(`${issue.identifier} already ${type}; not moving`);
  const { ok, errors } = await moveIssueToState(token, issue.id, TARGET_STATE);
  if (ok) info(`${issue.identifier} moved`);
  else warn(`could not move ${issue.identifier}: ${JSON.stringify(errors)}`);
}

async function findIssueByBranch(token, branch) {
  if (!branch) return null;
  const res = await graphql(
    token,
    `query($b:String!){ issueVcsBranchSearch(branchName:$b){ id identifier assignee{ id url } state{ type } } }`,
    { b: branch }
  );
  return res.data?.issueVcsBranchSearch ?? null;
}

async function findIssueByPrUrl(token, url) {
  if (!url) return null;
  const res = await graphql(
    token,
    `query($u:String!){ attachmentsForURL(url:$u){ nodes{ issue{ id identifier assignee{ id url } state{ type } } } } }`,
    { u: url }
  );
  return res.data?.attachmentsForURL?.nodes?.[0]?.issue ?? null;
}

async function findIssueByIdentifier(token, text) {
  const match = text.match(/([A-Z][A-Z0-9]*)-(\d+)/);
  if (!match) return null;
  const [identifier, key, number] = match;
  const res = await graphql(
    token,
    `query($k:String!,$n:Float!){ issues(filter:{team:{key:{eq:$k}},number:{eq:$n}}, first:1){ nodes{ id identifier assignee{ id url } state{ type } } } }`,
    { k: key, n: Number(number) }
  );
  const issue = res.data?.issues?.nodes?.[0];
  return issue && issue.identifier === identifier ? issue : null; // exact-match guard
}

main().catch((e) => warn(`unexpected error: ${e.message}`));
