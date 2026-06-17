This project contains a number of reusable github actions: slack notifications for build success or failure, deploys and rollbacks, and a Linear action that records continuous-release deploys and notifies the assignees of the issues that shipped. 

## Usage
See examples below. 

`${{ secrets.SLACK_WEBHOOK_URL }}` is a secret that contains the webhook URL for the slack channel you want to send notifications to. It's defined as an organisation secret in Github. It needs to be passed in as an input to the action, because github actions do not support injecting secrets, only workflows do. 

### Build success

```yaml
  notify-slack-success:
    runs-on: ubuntu-latest
    needs: [ test, deploy-google-cloud ]
    if: success() && github.ref == 'refs/heads/master'
    steps:
        - uses: seatsio/seatsio-github-actions/slack-notify-build-success@v1
          with:
             webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Build failure

```yaml
  notify-slack-failure:
    runs-on: ubuntu-latest
    needs: [ test, deploy-google-cloud ]
    if: failure() && github.ref == 'refs/heads/master'
    steps:
        - uses: seatsio/seatsio-github-actions/slack-notify-build-failure@v1
          with:
             webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Deploys

Use `technote-space/workflow-conclusion-action@v3` to get the workflow conclusion, and pass it in as `status` input. 
The status will be either `success`, `failure` or `cancelled`

```yml
  notify-slack:
    runs-on: ubuntu-latest
    needs: [deploy-google-cloud]
    if: always()
    steps:
      - uses: technote-space/workflow-conclusion-action@v3
      - uses: seatsio/seatsio-github-actions/slack-notify-deploy@v1
        with:
          webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
          status: ${{ env.WORKFLOW_CONCLUSION }}

```

### Rollbacks
Same as for deploys: use `technote-space/workflow-conclusion-action@v3`. 

```yml
  notify-slack:
    runs-on: ubuntu-latest
    needs: [rollback]
    steps:
      - uses: technote-space/workflow-conclusion-action@v3
      - uses: seatsio/seatsio-github-actions/slack-notify-rollback-deploy@v1
        with:
          webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
          status: ${{ env.WORKFLOW_CONCLUSION }}
```

### Linear notifications

Two actions nudge issue assignees in Linear. Both post **as an OAuth app (a bot)** — so no personal Linear seat is used, the comment isn't tied to a person, and the assignee actually gets notified (Linear never notifies you of your own comments). Both are best-effort: a Linear API problem is reported as a workflow `::warning::` but never fails the job.

Both need one Linear **OAuth app**: create it under **Settings → API → OAuth applications** with the `read` and `comments:create` scopes and the **client-credentials** grant enabled, then store its id/secret as the org secrets `LINEAR_CLIENT_ID` / `LINEAR_CLIENT_SECRET`. The actions mint a short-lived app token at run time, so you never store a user token.

#### Production — on deploy (`linear-release-notify`)

Records a Linear release for the commits in the production deploy and comments "🚀 Shipped to production" on each released issue, @mentioning its assignee.

- Run `actions/checkout` with `fetch-depth: 0` **before** it — the release action needs full git history; a shallow checkout produces an empty release.
- `linear_access_key` is that repo's **production** release-pipeline key. `environment` only controls the comment wording (defaults to `production`).

```yaml
  linear-release-production:
    runs-on: ubuntu-latest
    needs: [ deploy-google-cloud ]          # ← your production deploy job
    if: success() && github.ref == 'refs/heads/master'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: seatsio/seatsio-github-actions/linear-release-notify@v1
        with:
          linear_access_key: ${{ secrets.LINEAR_PRODUCTION_ACCESS_KEY }}
          linear_client_id: ${{ secrets.LINEAR_CLIENT_ID }}
          linear_client_secret: ${{ secrets.LINEAR_CLIENT_SECRET }}
          environment: production
```

#### Staging — on PR merge (`linear-merge-notify`)

Comments on the Linear issue linked to a merged PR, @mentioning its assignee (default "✅ Merged & on staging"). Optionally moves the issue to a workflow state via `target_state` (the Linear state id) — handy when a merge ships straight to production (e.g. the docs site). The move is skipped if the issue is already completed or canceled, so a later PR can't drag a finished issue backwards.

```yaml
on:
  pull_request:
    types: [closed]

jobs:
  linear-staging-nudge:
    if: github.event.pull_request.merged == true && github.event.pull_request.base.ref == 'master'
    runs-on: ubuntu-latest
    steps:
      - uses: seatsio/seatsio-github-actions/linear-merge-notify@v1
        with:
          linear_client_id: ${{ secrets.LINEAR_CLIENT_ID }}
          linear_client_secret: ${{ secrets.LINEAR_CLIENT_SECRET }}
```

Set `target_state` to also move the issue — e.g. docs that deploy to production on merge:

```yaml
      - uses: seatsio/seatsio-github-actions/linear-merge-notify@v1
        with:
          linear_client_id: ${{ secrets.LINEAR_CLIENT_ID }}
          linear_client_secret: ${{ secrets.LINEAR_CLIENT_SECRET }}
          target_state: "${{ vars.LINEAR_PROD_STATE }}" # the Linear state id to move to
          message: "🚀 Docs deployed to production"
```

## Releasing
Non breaking changes (e.g. tweaks to the messages) can simply be released under the current version tag. This makes the changes available to all projects using the action, without having to bump versions there. 

In order to do this (if v1 is the current version):
```shell
git push origin master
git tag -f v1
git push --force origin v1
```


