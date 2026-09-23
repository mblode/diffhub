export const basePath = "/diffhub";

export const asset = (path: string) => `${basePath}${path}`;

export const siteUrl = `https://blode.co${basePath}`;

export const siteConfig = {
  // The brand SERP. Search Console shows `diffhub` ranking but barely clicked,
  // so the title says what the thing is in plain words before anything else,
  // and the description names the loop and the agents people search with.
  description:
    "DiffHub opens your git diff in a local browser tab or cmux split. Comment on any line, then paste every note back into Claude Code, Codex or Cursor.",
  links: {
    author: "https://blode.co",
    // Routed through next/link, which applies the basePath itself.
    demo: "/oven-sh/bun/pull/16000",
    docs: `${siteUrl}/docs`,
    github: "https://github.com/mblode/diffhub",
    loom: "https://www.loom.com/share/e0203dd97b354508a791ecd339094a02",
    npm: "https://www.npmjs.com/package/diffhub",
  },
  name: "DiffHub",
  title: "DiffHub: local git diff viewer for reviewing agent code",
  url: siteUrl,
};
