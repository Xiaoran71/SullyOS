# Upstream synchronization

This fork deliberately uses two kinds of branches:

- `master` is the deployable custom release. It contains the official SullyOS history plus the local shortcut-action commits.
- `upstream-mirror` is an automation-owned mirror of `qegj567-cloud/SullyOS:master`. Never add custom commits to it.
- `automation/sync-upstream` is a temporary, replaceable branch used for a verified merge pull request.

Keeping `master` as the custom release avoids deploying an official build that silently omits shortcut actions. The separation is still explicit: official commits remain intact, local changes remain ordinary commits above the common base, and the mirror provides a clean official reference.

## Normal update flow

The `Sync upstream SullyOS` workflow runs weekly and can also be started manually.

1. Fetch the official `master` branch.
2. Refresh `upstream-mirror` from the official commit.
3. Attempt a normal Git merge into a branch created from this fork's `master`.
4. Stop and open/update an issue if Git reports conflicts. The workflow aborts the merge and does not push partially resolved files.
5. If the merge is clean, install the locked dependencies and run `pnpm run build`.
6. Only after a successful build, push `automation/sync-upstream` and open or update a pull request into `master`.

Merging the pull request is intentionally the final safety gate. Enable GitHub auto-merge for that PR if fully unattended clean updates are desired; branch protection can require the build checks before GitHub completes it.

## Local commands

The local `upstream` remote is:

```text
https://github.com/qegj567-cloud/SullyOS.git
```

To inspect updates without changing the working branch:

```bash
git fetch upstream --prune
git log --oneline master..upstream/master
```

To reproduce an update manually, first create a safety branch from the current custom release, then merge normally:

```bash
git switch master
git pull --ff-only origin master
git branch backup/custom-before-upstream-sync
git merge --no-ff upstream/master
pnpm install --frozen-lockfile
pnpm run build
```

If Git reports conflicts, do not use `ours`, `theirs`, a hard reset, or a force push to hide them. Resolve only after checking shortcut actions, backup round trips, character-card privacy stripping, and the chat action panel. Use `git merge --abort` to return to the pre-merge state.
