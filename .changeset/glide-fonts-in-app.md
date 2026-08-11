---
"diffhub": patch
---

Load Glide through next/font instead of serving it from public/. The woff2 files
sat in public/, so they were also fetchable raw at /glide-variable.woff2; under
app/fonts they are only reachable through the hashed URL next/font emits. The
viewer also declares the 100 to 950 range the v2 files actually carry rather
than 400 to 900, so the thin and black ends stop clamping, and it now loads the
real italic instead of leaving the browser to slant the roman.
