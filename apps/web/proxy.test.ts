import { getRewrittenUrl, isRewrite } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, expect, test, vi } from "vitest";

import { proxy } from "./proxy";

const request = (path: string) =>
  new NextRequest(`https://blode.co/diffhub${path}`, { nextConfig: { basePath: "/diffhub" } });

// Just enough of a pull request for `fetchPrMeta` to parse.
const PULL = { base: { ref: "main" }, head: { ref: "feature" }, user: null };

const github = (status: number) =>
  vi.fn(() => Promise.resolve(Response.json(status === 200 ? PULL : {}, { status })));

const NOT_FOUND = "https://blode.co/diffhub/_missing-pull-request";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("sends a malformed PR URL to the 404 page without asking GitHub", async () => {
  const fetch = github(200);
  vi.stubGlobal("fetch", fetch);
  const response = await proxy(request("/a/b/pull/abc"));
  expect(isRewrite(response)).toBe(true);
  expect(getRewrittenUrl(response)).toBe(NOT_FOUND);
  expect(fetch).not.toHaveBeenCalled();
});

test("sends a PR GitHub reports missing to the 404 page, once per URL", async () => {
  const fetch = github(404);
  vi.stubGlobal("fetch", fetch);
  const path = "/mblode/diffhub/pull/404001";
  expect(getRewrittenUrl(await proxy(request(path)))).toBe(NOT_FOUND);
  expect(getRewrittenUrl(await proxy(request(path)))).toBe(NOT_FOUND);
  expect(fetch).toHaveBeenCalledOnce();
});

test("lets an existing PR through", async () => {
  const fetch = github(200);
  vi.stubGlobal("fetch", fetch);
  expect(isRewrite(await proxy(request("/mblode/diffhub/pull/54")))).toBe(false);
  expect(fetch).toHaveBeenCalledOnce();
});

test("lets the page handle a rate limit rather than calling it missing", async () => {
  const fetch = github(403);
  vi.stubGlobal("fetch", fetch);
  expect(isRewrite(await proxy(request("/mblode/diffhub/pull/403001")))).toBe(false);
  // Not cached: the next request asks again.
  await proxy(request("/mblode/diffhub/pull/403001"));
  expect(fetch).toHaveBeenCalledTimes(2);
});
