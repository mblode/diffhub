---
"diffhub": minor
---

Add Bun support as an alternative runtime to Node.js. The CLI now spawns the standalone server with whatever runtime launched it (`process.execPath`) instead of hardcoding `node`, and the startup gate accepts Bun 1.0.23+ (the version that added `import.meta.dirname`/`filename`, mirroring the existing Node 20.11+ floor). The `open-in-diffhub.sh` launcher detects `node` or `bun` and picks a matching build command.
