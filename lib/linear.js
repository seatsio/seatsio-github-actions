const GRAPHQL_URL = "https://api.linear.app/graphql";
const OAUTH_URL = "https://api.linear.app/oauth/token";

function warn(message) {
  console.log(`::warning::Linear notify: ${message}`);
}

async function getAccessToken(clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "read,comments:create",
  });
  try {
    const res = await fetch(OAUTH_URL, { method: "POST", body });
    return (await res.json()).access_token || null;
  } catch {
    return null;
  }
}

async function graphql(token, query, variables) {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    return await res.json();
  } catch (e) {
    return { errors: [{ message: e.message }] };
  }
}

async function addComment(token, issueId, body) {
  const res = await graphql(
    token,
    `mutation($id:String!,$body:String!){ commentCreate(input:{issueId:$id,body:$body}){ success } }`,
    { id: issueId, body }
  );
  const ok = Boolean(res.data?.commentCreate?.success);
  return { ok, errors: ok ? null : res.errors ?? res.data };
}

module.exports = { warn, getAccessToken, graphql, addComment };
