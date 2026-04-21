---
"diffhub": patch
---

Perf + UX: large diffs load ~4× faster and no longer flash "server hasn't responded" mid-request.

- Raise the loading watchdog to 20s and soften the message; show a file-count hint while loading.
- Deduplicate concurrent `/api/diff` work: in-flight promises are shared, snapshot TTL extended from 500ms to 15s, and stale-generation disk cache is no longer thrashed.
- Cache server-prerendered diff HTML in a reviewKey-keyed LRU so repeat views and toggles are instant.
- Under `diffhub cmux`, pre-warm the prerender cache whenever the watcher rebuilds a git snapshot.
- Cap prerender concurrency and add per-phase timings (`gitMs`, `prerenderMs`, cache hit/miss counts) to the response log.
- Prerender only the currently-displayed layout × theme variant instead of all four — 4× reduction in per-request Shiki work.
