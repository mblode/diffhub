import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST } from "./route";

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
    delete process.env.DIFFHUB_USER;
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

  it("rejects non-positive and non-integer line numbers", async () => {
    for (const lineNumber of [0, -1, 1.5]) {
      const response = await POST(
        new Request("http://localhost/api/comments", {
          body: JSON.stringify({
            body: "Review this hunk",
            file: "src/a.ts",
            lineNumber,
            side: "right",
            tag: "",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toStrictEqual({
        error: "lineNumber must be a positive integer",
      });
    }
  });

  it("requires an id to delete a comment", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/comments", { method: "DELETE" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({ error: "id required" });
  });

  it("resolves, replies, and unresolves comments through PATCH", async () => {
    process.env.DIFFHUB_USER = "Route Tester";
    const createResponse = await POST(
      new Request("http://localhost/api/comments", {
        body: JSON.stringify({
          body: "Review this hunk",
          file: "src/a.ts",
          lineNumber: 12,
          side: "right",
          tag: "",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );
    const created = (await createResponse.json()) as { id: string };

    const resolveResponse = await PATCH(
      new Request(`http://localhost/api/comments?id=${created.id}`, {
        body: JSON.stringify({ action: "resolve" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
    );
    expect(resolveResponse.status).toBe(200);
    await expect(resolveResponse.json()).resolves.toMatchObject({
      resolved: true,
      resolvedAt: expect.any(String),
      resolvedBy: "Route Tester",
    });

    const replyResponse = await PATCH(
      new Request(`http://localhost/api/comments?id=${created.id}`, {
        body: JSON.stringify({ action: "reply", body: "Fixed now" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
    );
    expect(replyResponse.status).toBe(200);
    await expect(replyResponse.json()).resolves.toMatchObject({
      replies: [{ at: expect.any(String), body: "Fixed now", by: "Route Tester" }],
      resolved: true,
    });

    const unresolveResponse = await PATCH(
      new Request(`http://localhost/api/comments?id=${created.id}`, {
        body: JSON.stringify({ action: "unresolve" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
    );
    expect(unresolveResponse.status).toBe(200);
    const unresolved = (await unresolveResponse.json()) as {
      resolved: boolean;
      resolvedAt?: string;
      resolvedBy?: string;
    };
    expect(unresolved.resolved).toBeFalsy();
    expect(unresolved.resolvedAt).toBeUndefined();
    expect(unresolved.resolvedBy).toBeUndefined();
  });

  it("validates PATCH requests", async () => {
    const missingIdResponse = await PATCH(
      new Request("http://localhost/api/comments", {
        body: JSON.stringify({ action: "resolve" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
    );
    expect(missingIdResponse.status).toBe(400);
    await expect(missingIdResponse.json()).resolves.toStrictEqual({ error: "id required" });

    const unknownCommentResponse = await PATCH(
      new Request("http://localhost/api/comments?id=missing-id", {
        body: JSON.stringify({ action: "resolve" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
    );
    expect(unknownCommentResponse.status).toBe(404);
    await expect(unknownCommentResponse.json()).resolves.toStrictEqual({
      error: "comment not found",
    });

    const invalidActionResponse = await PATCH(
      new Request("http://localhost/api/comments?id=missing-id", {
        body: JSON.stringify({ action: "invalid" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
    );
    expect(invalidActionResponse.status).toBe(400);
    await expect(invalidActionResponse.json()).resolves.toStrictEqual({
      error: "invalid action",
    });

    const emptyReplyResponse = await PATCH(
      new Request("http://localhost/api/comments?id=missing-id", {
        body: JSON.stringify({ action: "reply", body: " " }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      }),
    );
    expect(emptyReplyResponse.status).toBe(400);
    await expect(emptyReplyResponse.json()).resolves.toStrictEqual({ error: "body is required" });
  });
});
