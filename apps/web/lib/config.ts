export const basePath = "/diffhub";

export const asset = (path: string) => `${basePath}${path}`;

export const siteUrl = `https://blode.co${basePath}`;

export const siteConfig = {
  description:
    "DiffHub is a cmux git diff viewer for agent code review. See a whole branch, refresh changes as you edit, and leave inline comments without sending code away.",
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
  title: "cmux git diff viewer for agent code review | DiffHub",
  url: siteUrl,
};
