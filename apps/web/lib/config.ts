export const basePath = "/diffhub";

export const asset = (path: string) => `${basePath}${path}`;

export const siteUrl = `https://blode.co${basePath}`;

export const siteConfig = {
  description:
    "A git diff viewer for the whole branch. See every changed file, leave line comments, and send your notes back to your coding agent.",
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
  url: siteUrl,
};
