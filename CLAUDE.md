# cbas-ui

The analytics service's UI: a pluggable UI for the Couchbase Administrative
Console, not an application of its own. It vendors no angular, lodash or ace —
those resolve through the admin console's importmap — so it only runs inside
one.

Two pages live here. The **Workbench** (`cbas.js` and the `cw_cbas_*` files) is
lazily loaded under `app.admin.cbas`. **Service RBAC** (`cbas_rbac.js` and the
`cw_rbac_*` files) is lazily loaded into the admin console's Security section,
and shares nothing with the workbench: it can be the first thing a user opens,
so anything it reaches for must be registered by its own module.

## Related Projects

| Path (relative to this dir) | Description |
|-----------------------------|-------------|
| `../analytics` | CBAS Java backend |
| `../columnar-ui-v1` | The admin console this plugs into, and where the UI tests live |
| `../query-ui` | Query workbench UI, which this shares components with |

## Tests

There are none in this repo. The browser suite that covers these pages lives in
`../columnar-ui-v1/test/`, because that project owns the importmap that resolves
angular and ace. `test/cbas/` there holds the cases; `test/run_ci.sh` runs them,
and the `cbas-ui-test` Jenkins job triggers on changes to either project.

`test/test_cbas_mutations.py` mutates *this* tree to prove those cases can still
fail. A mutation whose anchor text no longer exists is a failure, so reword a
line it quotes and that file needs updating with it.

## Commit Messages

Every commit message must end with the trailer, naming whichever model did the work:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

It belongs in the trailing paragraph, contiguous with `Change-Id:` — a blank line between them
splits the footer, and the `commit-msg` hook then mints a second `Change-Id` and orphans the
change. Keep the subject at 50 characters or under; Gerrit warns above that.

### Keep the body short

The body says **why** — the defect, the constraint, the reason the obvious approach was rejected.
It is not a narration of the diff: what changed is already in the diff, and restating it hunk by
hunk only leaves two accounts to keep in step. A couple of sentences is usually the right length;
a file-by-file tour is not.

The same rule as `../analytics/CLAUDE.md`, which is where it was written down first.
