

Optional inputs (with their defaults):

| input | default | description |
| --- | --- | --- |
| `version` | `''` | Version to bump to. Empty ⇒ latest published on NPM. |
| `node_version` | `24` | Node version to use. |
| `base_branch` | `master` | Branch to open the PR against. |
| `install_command` | `yarn install` | Command that refreshes the lockfile. |
| `build_command` | `yarn build` | Build command. Empty string ⇒ skip the build. |
| `lockfile` | `yarn.lock` | Lockfile to include in the PR. |
| `working_directory` | `.` | Directory containing the `package.json` to updateIt expects `@seatsio/seatsio-types` in `dependencies`, refuses to downgrade, and fails if the package is already at the requested version. It assumes yarn (`yarn install` + `yarn build`).
