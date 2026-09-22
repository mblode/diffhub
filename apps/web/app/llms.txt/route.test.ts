import { expect, test } from "vitest";

import { GET } from "./route";

test("the agent-readable index leads with the page search intents", async () => {
  const response = GET();
  const text = await response.text();

  expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  expect(text).toContain(
    "[DiffHub: local git diff viewer for reviewing agent code](https://blode.co/diffhub)",
  );
  expect(text).toContain(
    "[cmux diff viewer: three ways to review a branch](https://blode.co/diffhub/cmux-git-diff)",
  );
  expect(text).toContain(
    "[Git diff viewer that runs in your browser, side by side](https://blode.co/diffhub/git-diff-viewer)",
  );
  expect(text).toContain("(https://blode.co/diffhub/claude-code-review)");
  expect(text).toContain("(https://blode.co/diffhub/agent-diff)");
  expect(text).toContain("runs on localhost, and makes no\noutbound requests");
});
