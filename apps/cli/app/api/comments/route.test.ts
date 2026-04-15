import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "./route";

const tempPaths: string[] = [];

const createTempRepo = (): string => {
  const repoPath = mkdtempSync(join(tmpdir(), "diffhub-comments-route-"));
  mkdirSync(join(repoPath, ".git"));
  tempPaths.push(repoPath);
  return repoPath;
};

describe("/api/comments", () => {
  beforeEach(() => {
    process.env.DIFFHUB_REPO = createTempRepo();
  });

  afterEach(() => {
    delete process.env.DIFFHUB_REPO;

    for (const tempPath of tempPaths.splice(0)) {
      rmSync(tempPath, { force: true, recursive: true });
    }
  });

  it("returns an empty list when no comment store exists", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual([]);
  });

  it("accepts diff annotation sides and persists normalized comment sides", async () => {
    const response = await POST(
      new Request("http://localhost/api/comments", {
        body: JSON.stringify({
          body: "Review this hunk",
          file: "src/a.ts",
          lineNumber: 12,
          side: "additions",
          tag: "",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      body: "Review this hunk",
      file: "src/a.ts",
      lineNumber: 12,
      side: "right",
      tag: "",
    });

    const storedComments = JSON.parse(
      readFileSync(
        join(process.env.DIFFHUB_REPO as string, ".git", "diffhub-comments.json"),
        "utf-8",
      ),
    ) as Record<string, unknown>[];
    expect(storedComments).toHaveLength(1);
    expect(storedComments[0]?.side).toBe("right");
  });

  it("rejects invalid side values", async () => {
    const response = await POST(
      new Request("http://localhost/api/comments", {
        body: JSON.stringify({
          body: "Review this hunk",
          file: "src/a.ts",
          lineNumber: 12,
          side: "center",
          tag: "",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({
      error: "side must be 'left', 'right', 'deletions', or 'additions'",
    });
  });

  it("requires an id to delete a comment", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/comments", { method: "DELETE" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({ error: "id required" });
  });
});
