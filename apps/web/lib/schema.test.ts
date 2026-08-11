import { expect, test } from "vitest";

import { plainAnswer } from "./faq";
import { schemaId, zoneGraph } from "./schema";

/**
 * The JSON-LD contract, not the JSON-LD content. Asserting the graph's literal
 * shape would only restate `schema.ts`, so these check the four properties that
 * have actually broken here: one graph per page, ids that are unique, ids that
 * resolve, and FAQ answers that match what the page renders.
 *
 * Rules 3 and 4 of zone-conventions.md are the source; the comments in
 * `schema.ts` record the two bugs (a duplicated `BreadcrumbList` `@id`, then a
 * zone-wide `WebPage` `@id` on every inner page) that motivated them.
 */

const faqs = [
  { answer: "Yes. `npx diffhub@latest` runs it without installing.", question: "Is it free?" },
  { answer: "No. It runs on localhost.", question: "Does it phone home?" },
];

const page = {
  description: "How to view a git diff in cmux.",
  name: "How to view a git diff in cmux",
  url: "https://blode.co/diffhub/cmux-git-diff",
};

type Node = Record<string, unknown>;

const nodesOf = (graph: ReturnType<typeof zoneGraph>) => graph["@graph"] as Node[];

const find = (graph: ReturnType<typeof zoneGraph>, id: string) =>
  nodesOf(graph).find((node) => node["@id"] === id);

/** Every `{"@id": …}` that is a reference rather than a definition. */
const references = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) {
      references(item, out);
    }
    return out;
  }
  if (value === null || typeof value !== "object") {
    return out;
  }
  const node = value as Node;
  for (const [key, child] of Object.entries(node)) {
    if (key === "@id") {
      continue;
    }
    if (
      child !== null &&
      typeof child === "object" &&
      !Array.isArray(child) &&
      Object.keys(child as Node).length === 1 &&
      typeof (child as Node)["@id"] === "string"
    ) {
      out.push((child as Node)["@id"] as string);
      continue;
    }
    references(child, out);
  }
  return out;
};

test("the zone root keeps the ids it has always published", () => {
  // Google has already resolved these two. Changing either orphans an entity,
  // which is why per-page ids use the `${url}/#webpage` shape: it reproduces
  // these strings exactly when the url is the zone root's.
  const graph = zoneGraph();

  expect(find(graph, "https://blode.co/diffhub/#webpage")).toBeDefined();
  expect(find(graph, "https://blode.co/diffhub/#breadcrumb")).toBeDefined();
  expect(schemaId.webPage).toBe("https://blode.co/diffhub/#webpage");
  expect(schemaId.breadcrumb).toBe("https://blode.co/diffhub/#breadcrumb");
});

test("an inner page does not claim the zone root's identity", () => {
  const graph = zoneGraph({ page, trail: [{ name: page.name, url: page.url }] });
  const webPage = find(graph, `${page.url}/#webpage`);

  expect(webPage).toBeDefined();
  expect(webPage?.url).toBe(page.url);
  expect(webPage?.name).toBe(page.name);
  // The bug this replaced: an inner page publishing the root's `@id`.
  expect(find(graph, schemaId.webPage)).toBeUndefined();
  expect(find(graph, schemaId.breadcrumb)).toBeUndefined();
});

test("ids are unique within a graph", () => {
  const graph = zoneGraph({ faqs, page, trail: [{ name: page.name, url: page.url }] });
  const ids = nodesOf(graph).map((node) => node["@id"]);

  expect(ids).toStrictEqual([...new Set(ids)]);
});

test("every id reference resolves in-graph or points at blode.co", () => {
  // A dangling `@id` is worse than the collision it replaced: the graph names a
  // node that is not there. The breadcrumb reference is the one at risk, since
  // its value lives in two places.
  const graph = zoneGraph({ faqs, page, trail: [{ name: page.name, url: page.url }] });
  const defined = new Set(nodesOf(graph).map((node) => node["@id"]));

  for (const reference of references(nodesOf(graph))) {
    expect(defined.has(reference) || reference.startsWith("https://blode.co/#")).toBe(true);
  }
});

test("the WebPage breadcrumb reference matches the BreadcrumbList it ships with", () => {
  const graph = zoneGraph({ page, trail: [{ name: page.name, url: page.url }] });
  const webPage = find(graph, `${page.url}/#webpage`);
  const breadcrumb = nodesOf(graph).find((node) => node["@type"] === "BreadcrumbList");

  const reference = webPage?.breadcrumb as Node | undefined;

  expect(reference?.["@id"]).toBe(breadcrumb?.["@id"]);
});

test("FAQ answers in the markup match the answers the page renders", () => {
  // The mismatch Google acts on. Both sides read the same array, so this can
  // only fail if `plainAnswer` and the node builder disagree.
  const graph = zoneGraph({ faqs, page });
  const webPage = find(graph, `${page.url}/#webpage`);
  const questions = webPage?.mainEntity as Node[];

  expect(webPage?.["@type"]).toStrictEqual(["WebPage", "FAQPage"]);
  expect(questions).toHaveLength(faqs.length);
  for (const [index, question] of questions.entries()) {
    expect(question.name).toBe(faqs[index].question);
    expect((question.acceptedAnswer as Node).text).toBe(plainAnswer(faqs[index].answer));
    expect((question.acceptedAnswer as Node).text).not.toContain("`");
    // Questions are never parsed, so a backtick here would reach the heading
    // and the schema as a literal character.
    expect(question.name).not.toContain("`");
  }
});

test("a page without FAQs is unchanged by the FAQ support", () => {
  const graph = zoneGraph({ page });
  const webPage = find(graph, `${page.url}/#webpage`);

  expect(webPage?.["@type"]).toBe("WebPage");
  expect(webPage).not.toHaveProperty("mainEntity");
  expect(webPage).not.toHaveProperty("dateModified");
});

test("updatedAt surfaces as dateModified", () => {
  const graph = zoneGraph({ page, updatedAt: "2026-08-10" });

  expect(find(graph, `${page.url}/#webpage`)?.dateModified).toBe("2026-08-10");
});
