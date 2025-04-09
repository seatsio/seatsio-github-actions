# Slack Notify GitHub Action

Reusable composite GitHub Action to notify a Slack channel of build success or failure.

## Inputs

- `status`: `"success"` or `"failure"`
- `webhook_url`: Slack Incoming Webhook URL
- `repository`: GitHub repository name
- `branch`: Branch name
- `commit_url`: Commit URL
- `commit_message`: Commit message

## Usage

```yaml
- uses: seatsio/seatsio-github-actions/slack-notify@v1
  with:
    status: "success"
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
    repository: ${{ github.repository }}
    branch: ${{ github.ref_name }}
    commit_url: ${{ github.event.head_commit.url }}
    commit_message: ${{ github.event.head_commit.message }}
