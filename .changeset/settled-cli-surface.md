---
"diffhub": major
---

Release 1.0.

DiffHub is used through its commands, its keyboard shortcuts, and the local server
it opens, and 37 releases across the 0.x line have moved all three: the file watcher
that drove auto-refresh was removed in favour of an explicit refresh, and the
runtime dependency set was cut to `chokidar` and `commander` while `engines.node`
relaxed to `>=20.11`.

None of that could be signalled from 0.x in a way a version range would respect.
1.0 is the commitment that it can be from here: a removed command, shortcut, or
supported Node version now costs a major.
