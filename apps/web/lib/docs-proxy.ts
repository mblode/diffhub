import { basePath } from "./config";

const DOCS_ORIGIN = "https://diffhub.blode.md";

/**
 * Static chunks are served only from the apex, not from the per-tenant host:
 * `diffhub.blode.md` emits the asset URLs but 404s on them.
 */
const DOCS_ASSET_ORIGIN = "https://blode.md";

/** Where the docs are published, from a reader's point of view. */
const PUBLIC_DOCS_PATH = `${basePath}/docs`;

/**
 * The docs origin emits root-relative asset URLs. Those resolve against
 * blode.co, which fronts many projects and has no route for them, so every
 * stylesheet and script 404s and comes back as the HTML 404 page, which the
 * browser then refuses to execute for having the wrong MIME type.
 *
 * Serving the docs through a handler lets us repoint those URLs at a path
 * blode.co already forwards to us, and map them back on the way out. A plain
 * rewrite cannot do this: it has no access to the response body.
 *
 * The upstream prefix tracks blode.md rather than anything in this repo. It
 * moved once, silently, and every docs page lost its CSS and JS until this
 * caught up. If the docs render unstyled again, check what the upstream HTML
 * actually asks for before looking anywhere else.
 *
 * `_next` must not survive into the public URL. Vercel resolves that segment
 * against this app's own build output before the request reaches this route,
 * even when it appears below `/docs`. The neutral `_chunks` segment keeps the
 * request routable and also retires the old immutable cache key.
 */
const UPSTREAM_ASSET_PREFIX = "/_docs/_next/";
const PUBLIC_ASSET_SEGMENT = "_chunks";
const PUBLIC_ASSET_PREFIX = `${PUBLIC_DOCS_PATH}/${PUBLIC_ASSET_SEGMENT}/`;

const isAssetSlug = (slug: string[]): boolean => slug[0] === PUBLIC_ASSET_SEGMENT;

/** Map a public path onto the path the docs origin actually serves. */
export const toUpstreamPath = (slug: string[]): string => {
  if (isAssetSlug(slug)) {
    return `${UPSTREAM_ASSET_PREFIX}${slug.slice(1).join("/")}`;
  }
  return slug.length ? `/docs/${slug.join("/")}` : "/docs";
};

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "if-modified-since",
  "if-none-match",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "next-router-state-tree",
  "next-url",
  "range",
  "rsc",
  "user-agent",
];

const isRewritableDocsBody = (contentType: string) =>
  contentType.includes("text/html") || contentType.includes("text/x-component");

const getForwardHeaders = (request: Request): Headers => {
  const headers = new Headers();
  for (const header of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }
  return headers;
};

/**
 * `fetch` transparently decompresses the body, so the upstream
 * content-encoding describes bytes we are no longer sending; forwarding it
 * makes the browser fail to decode an otherwise healthy 200. The upstream Link
 * header advertises preloads at un-prefixed `/_next/...` paths that do not
 * exist here. Neither survives the hop.
 *
 * No `vary: accept-encoding` here, and that is not an oversight. These routes
 * answer with `vary: rsc, next-router-state-tree, ...`, Next's own list, which
 * omits accept-encoding and cannot be added to from a route handler. It was
 * raised as a risk that a br variant could be served to Bingbot or an AI
 * crawler that does not advertise br. Measured against production on
 * 2026-08-10, on cache HITs, all three docs routes: a br client gets br, a
 * gzip-only client gets gzip, and a client sending no accept-encoding at all
 * gets identity HTML. Nothing is mis-served.
 *
 * The reason is above: deleting content-encoding means this origin always
 * returns identity bytes, so compression is entirely Vercel's edge, which
 * negotiates per request and keys its own cache on encoding rather than on
 * this header. Re-measure before acting on a `vary` audit finding for these
 * routes, because the header is genuinely incomplete and the behaviour is
 * still correct.
 */
const normaliseHeaders = (source: Headers, ok: boolean, cacheable: boolean): Headers => {
  const headers = new Headers(source);
  for (const header of ["content-encoding", "content-length", "link"]) {
    headers.delete(header);
  }
  if (!(ok && cacheable)) {
    // Never let a transient upstream failure get pinned at the edge.
    for (const header of ["cdn-cache-control", "vercel-cdn-cache-control"]) {
      headers.delete(header);
    }
    headers.set("cache-control", "no-store");
  }
  return headers;
};

const ASSET_URL_PATTERN = new RegExp(`(["'(])${UPSTREAM_ASSET_PREFIX}`, "g");

/**
 * The upstream `<head>` points its metadata at root-absolute paths. Assets are
 * handled above; these are the rest, and they escape the zone the same way.
 * They resolve against blode.co, which answers 200 with the root site's own
 * files, so a DiffHub docs page advertises the personal site's llms.txt,
 * manifest and icons. Nothing 404s, which is why no crawler flags it, and
 * llms.txt is the worst of them: an agent told to read the documentation index
 * for these docs is handed a different site's index instead.
 *
 * The two llms files are docs content, so they come from the docs path, where
 * the platform already publishes its own. The manifest and icons are site
 * chrome, and this zone serves its own from `apps/web/app`, so they come from
 * the zone root. Nothing here points at a docs path that does not exist:
 * `/docs/manifest.json` upstream is a 404, which would be worse than the
 * wrong-content 200 it replaced.
 */
const ROOT_URL_REWRITES: readonly (readonly [string, string])[] = [
  ["/llms.txt", `${PUBLIC_DOCS_PATH}/llms.txt`],
  ["/llms-full.txt", `${PUBLIC_DOCS_PATH}/llms-full.txt`],
  ["/manifest.json", `${basePath}/manifest.json`],
  ["/favicon.ico", `${basePath}/favicon.ico`],
  ["/icon0.svg", `${basePath}/icon0.svg`],
  ["/icon1.png", `${basePath}/icon1.png`],
  ["/apple-icon.png", `${basePath}/apple-icon.png`],
];

/**
 * Each path is matched only where a URL can start, the same guard the asset
 * rewrite uses. That quote class also covers the escaped `\"` form, so the
 * copies carried in the flight payload are rewritten alongside the rendered
 * `<head>`. Miss those and a client-side navigation restores the old metadata.
 */
const ROOT_URL_PATTERNS = ROOT_URL_REWRITES.map(
  ([from, to]) => [new RegExp(`(["'(])${from.replaceAll(".", "\\.")}`, "g"), `$1${to}`] as const,
);

const rewriteRootUrls = (html: string): string => {
  let result = html;
  for (const [pattern, replacement] of ROOT_URL_PATTERNS) {
    result = result.replaceAll(pattern, replacement);
  }
  return result;
};

/**
 * Rule 10: person-level attribution on every route. The platform emits no
 * `twitter:creator` at all, so this injects rather than rewrites, anchored on
 * the `twitter:card` tag it does emit.
 *
 * `og:site_name` and the card image used to be patched here too. Those now
 * come from `apps/docs/docs.json` (`seo.siteName`, `metadata.ogImage`) once
 * the upstream tenant config is refreshed. Until that deploy lands, upstream
 * may still emit the product name / origin-derived card; do not reintroduce
 * the rewrite — fix the config.
 *
 * Injecting into the flight payload as well is the load-bearing half:
 * React re-renders the head on hydration from that tree, so a tag present only
 * in the served HTML is one Google's renderer can drop. The key is a string
 * rather than a number so it cannot collide with the platform's own indices.
 *
 * Guarded on the tag being absent, so this becomes a no-op rather than a
 * duplicate if blode.md ever starts emitting one itself.
 */
const TWITTER_CREATOR = "@mattblode";
const TWITTER_CARD_HEAD = /<meta name="twitter:card"[^>]*\/>/;
const TWITTER_CARD_FLIGHT =
  /\[\\"\$\\",\\"meta\\",\\"[^\\]*\\",\{\\"name\\":\\"twitter:card\\",\\"content\\":\\"[^\\]*\\"\}\]/;

const injectTwitterCreator = (html: string): string => {
  if (html.includes("twitter:creator")) {
    return html;
  }
  return html
    .replace(
      TWITTER_CARD_HEAD,
      (tag) => `${tag}<meta name="twitter:creator" content="${TWITTER_CREATOR}"/>`,
    )
    .replace(
      TWITTER_CARD_FLIGHT,
      (node) =>
        `${node},[\\"$\\",\\"meta\\",\\"zone-twitter-creator\\",{\\"name\\":\\"twitter:creator\\",\\"content\\":\\"${TWITTER_CREATOR}\\"}]`,
    );
};

export const rewriteDocsHtml = (html: string): string =>
  injectTwitterCreator(
    rewriteRootUrls(
      html
        .replaceAll(ASSET_URL_PATTERN, `$1${PUBLIC_ASSET_PREFIX}`)
        // Absolute self-references, so nothing points readers back at the origin.
        .replaceAll(`${DOCS_ORIGIN}/docs`, `https://blode.co${PUBLIC_DOCS_PATH}`)
        .replaceAll(DOCS_ORIGIN, `https://blode.co${PUBLIC_DOCS_PATH}`),
    ),
  );

const rewriteLocation = (location: string): string => {
  if (location.startsWith(`${DOCS_ORIGIN}/docs`)) {
    return `https://blode.co${PUBLIC_DOCS_PATH}${location.slice(`${DOCS_ORIGIN}/docs`.length)}`;
  }
  if (location.startsWith("/docs")) {
    return `${PUBLIC_DOCS_PATH}${location.slice("/docs".length)}`;
  }
  return location;
};

export const proxyDocsRequest = async (request: Request, slug: string[]): Promise<Response> => {
  const { search } = new URL(request.url);
  const upstream = new URL(
    `${toUpstreamPath(slug)}${search}`,
    isAssetSlug(slug) ? DOCS_ASSET_ORIGIN : DOCS_ORIGIN,
  );

  const response = await fetch(upstream, {
    headers: getForwardHeaders(request),
    method: request.method,
    redirect: "manual",
  });

  // Rewritten HTML embeds the current public asset prefix, so it must never
  // outlive a deployment. Only immutable chunk requests keep upstream caching.
  const headers = normaliseHeaders(
    response.headers,
    response.ok,
    request.method === "GET" && isAssetSlug(slug),
  );

  const location = response.headers.get("location");
  if (location) {
    headers.set("location", rewriteLocation(location));
    return new Response(null, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = isRewritableDocsBody(contentType)
    ? rewriteDocsHtml(await response.text())
    : response.body;

  return new Response(body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};
