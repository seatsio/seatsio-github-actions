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

### Linear release + notify

`linear-release-notify` records a Linear continuous-release for the commits in a deploy and, when given OAuth app credentials, comments on each released issue @mentioning its assignee — "✅ Merged & on staging" or "🚀 Shipped to production". This nudges assignees to verify their work on staging and tells them when it reaches production.

Two requirements:

- Run `actions/checkout` with `fetch-depth: 0` **before** the action — the release action needs full git history. A shallow checkout produces an empty release.
- `linear_access_key` is the per-pipeline key that selects which Linear pipeline/environment the release lands in, so **staging and production use different keys**. The `environment` input only controls the comment wording, so keep it consistent with the key you pass (it defaults to `production`).

`linear_client_id` / `linear_client_secret` are a Linear **OAuth app** (client-credentials grant) used to post the @mention comments **as a bot**: the app is not a paid Linear seat and is not tied to a person, and because the bot (not you) authors the comment, the assignee actually gets notified. The action mints a short-lived app token at run time, so you only ever store the client id/secret. Create the app under **Settings → API → OAuth applications** with the `read` and `comments:create` scopes and the client-credentials grant enabled. Omit both inputs to record the release without commenting. Notifications are best-effort: a Linear API problem is reported as a workflow `::warning::` annotation but never fails the deploy.

#### Staging

```yaml
  linear-release-staging:
    runs-on: ubuntu-latest
    needs: [ deploy-staging ]
    if: success() && github.ref == 'refs/heads/master'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: seatsio/seatsio-github-actions/linear-release-notify@v1
        with:
          linear_access_key: ${{ secrets.LINEAR_STAGING_ACCESS_KEY }}
          linear_client_id: ${{ secrets.LINEAR_CLIENT_ID }}
          linear_client_secret: ${{ secrets.LINEAR_CLIENT_SECRET }}
          environment: staging
```

#### Production

```yaml
  linear-release-production:
    runs-on: ubuntu-latest
    needs: [ deploy-production ]
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

## Releasing
Non breaking changes (e.g. tweaks to the messages) can simply be released under the current version tag. This makes the changes available to all projects using the action, without having to bump versions there. 

In order to do this (if v1 is the current version):
```shell
git push origin master
git tag -f v1
git push --force origin v1
```


