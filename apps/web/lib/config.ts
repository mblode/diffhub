export const basePath = "/diffhub";

export const asset = (path: string) => `${basePath}${path}`;

export const siteUrl = `https://blode.co${basePath}`;

export const siteConfig = {
  description:
    "DiffHub is a local diff viewer for cmux. Review your full branch against the detected base branch, leave inline notes on any line, and copy them as a prompt.",
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
