This project contains a number of reusable github actions to send slack notifications in case of build success or failure, deploys and rollbacks. 

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

## Releasing
Non breaking changes (e.g. tweaks to the messages) can simply be released under the current version tag. This makes the changes available to all projects using the action, without having to bump versions there. 

In order to do this (if v1 is the current version):
```shell
git push origin master
git tag -f v1
git push --force origin v1
```


