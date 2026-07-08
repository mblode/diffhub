---
"diffhub": patch
---

Fix cmux launcher commands so stale debug socket environment variables no longer break `diffhub cmux`. The CLI now scrubs inherited cmux routing state and targets a live cmux socket when opening splits or sending notifications.
