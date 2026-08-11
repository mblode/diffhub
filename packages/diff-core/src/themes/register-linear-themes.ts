"use client";

import type { ThemeRegistration } from "@pierre/diffs";
import { registerCustomTheme } from "@pierre/diffs";
import { LINEAR_DARK_THEME_ID, LINEAR_LIGHT_THEME_ID } from "./diff-themes";

// The Linear themes ship as VS Code / Shiki JSON in
// github.com/mblode/linear-theme and are vendored here, so unlike every other
// id in DIFF_THEMES they are in nobody's bundle: @pierre/diffs can only resolve
// them once we register a loader. Registration has to happen on the main
// thread (resolveTheme throws in a worker context — WorkerPoolManager resolves
// there and transfers the result), and before the first render that asks for
// one of these ids, hence the module-scope call in DiffsWorkerProvider.
//
// resolveTheme asserts the loaded theme's `name` equals the id it was
// registered under, so the upstream display name ("Linear Dark") is rewritten
// to the id here. The JSON stays byte-identical to upstream so it can be
// re-copied when the palette changes.

// The loader is a thunk rather than a path so the bundler can still see a
// static `import()` and split the JSON into its own lazily-fetched chunk.
const register = (id: string, load: () => Promise<{ default: unknown }>): void => {
  registerCustomTheme(id, async () => {
    const themeModule = await load();
    return { ...(themeModule.default as ThemeRegistration), name: id };
  });
};

let registered = false;

export const registerLinearThemes = (): void => {
  if (registered) {
    return;
  }
  registered = true;

  register(LINEAR_LIGHT_THEME_ID, () => import("./linear-light.json"));
  register(LINEAR_DARK_THEME_ID, () => import("./linear-dark.json"));
};
