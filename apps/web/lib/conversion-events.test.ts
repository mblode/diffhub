import { readFileSync } from "node:fs";
import path from "node:path";

import posthog from "posthog-js";
import { afterEach, expect, test, vi } from "vitest";

import {
  captureConversion,
  captureDemoOpened,
  captureInstallCommandCopied,
  conversionEventForHref,
  conversionLocation,
  conversionProperties,
  CTA_CLICKED_EVENT,
  DEMO_OPENED_EVENT,
  DOWNLOAD_CLICKED_EVENT,
  INSTALL_COMMAND_COPIED_EVENT,
  isDownloadHref,
} from "./conversion-events";

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

const read = (relative: string) => readFileSync(path.join(import.meta.dirname, relative), "utf-8");

afterEach(() => {
  vi.mocked(posthog.capture).mockReset();
});

test("conversion events reuse the existing Taste Training names", () => {
  expect(CTA_CLICKED_EVENT).toBe("cta_clicked");
  expect(DOWNLOAD_CLICKED_EVENT).toBe("download_clicked");
});

test("the landing-page contract adds events without renaming the old ones", () => {
  expect(INSTALL_COMMAND_COPIED_EVENT).toBe("install_command_copied");
  expect(DEMO_OPENED_EVENT).toBe("demo_opened");

  captureInstallCommandCopied("cmux");
  captureDemoOpened();

  expect(posthog.capture).toHaveBeenCalledWith("install_command_copied", {
    site: "diffhub",
    variant: "cmux",
  });
  expect(posthog.capture).toHaveBeenCalledWith("demo_opened", { site: "diffhub" });

  vi.mocked(posthog.capture).mockImplementation(() => {
    throw new Error("analytics down");
  });
  expect(() => captureDemoOpened()).not.toThrow();
});

test("cta_clicked carries href, label, location, $pathname, and $current_url", () => {
  const properties = conversionProperties({
    href: "https://github.com/mblode/diffhub",
    label: "GitHub",
    location: "/diffhub",
  });

  expect(properties).toEqual({
    $current_url: "https://blode.co/diffhub",
    $pathname: "/diffhub",
    href: "https://github.com/mblode/diffhub",
    label: "GitHub",
    location: "/diffhub",
    site: "diffhub",
  });
  expect(conversionEventForHref(properties.href)).toBe(CTA_CLICKED_EVENT);
});

test("conversion $current_url uses https://blode.co plus pathname", () => {
  expect(read("./conversion-events.ts")).toMatch(
    /\$current_url: `https:\/\/blode\.co\$\{pathname\}`/u,
  );
});

test("a product slug stays on location and does not invent $pathname", () => {
  const properties = conversionProperties({
    href: "https://blode.co/diffhub",
    label: "DiffHub",
    location: "diffhub",
  });

  expect(properties.location).toBe("diffhub");
  expect(properties.$pathname).toBeUndefined();
  expect(properties.$current_url).toBeUndefined();
});

test("zip and dmg hrefs use download_clicked", () => {
  expect(isDownloadHref("https://blode.co/glide/glide.zip")).toBe(true);
  expect(isDownloadHref("https://blode.co/convene/Convene.dmg")).toBe(true);
  expect(isDownloadHref("https://blode.co/commandment/app.dmg?x=1")).toBe(true);
  expect(conversionEventForHref("https://blode.co/glide/glide.zip")).toBe(DOWNLOAD_CLICKED_EVENT);
  expect(isDownloadHref("https://blode.co/diffhub")).toBe(false);
  expect(isDownloadHref("https://github.com/mblode/diffhub")).toBe(false);
  expect(isDownloadHref("npx diffhub@latest cmux")).toBe(false);
  expect(conversionEventForHref("npx diffhub@latest cmux")).toBe(CTA_CLICKED_EVENT);
  expect(conversionEventForHref("https://www.npmjs.com/package/diffhub")).toBe(CTA_CLICKED_EVENT);
});

test("location falls back to an explicit pathname or product slug", () => {
  expect(conversionLocation("/diffhub")).toBe("/diffhub");
  expect(conversionLocation("diffhub")).toBe("diffhub");
  expect(conversionLocation()).toBe("");
});

test("captureConversion sends cta_clicked and never throws", () => {
  captureConversion({
    href: "/oven-sh/bun/pull/16000",
    label: "Try a live review",
    location: "/diffhub",
  });

  expect(posthog.capture).toHaveBeenCalledWith("cta_clicked", {
    $current_url: "https://blode.co/diffhub",
    $pathname: "/diffhub",
    href: "/oven-sh/bun/pull/16000",
    label: "Try a live review",
    location: "/diffhub",
    site: "diffhub",
  });

  vi.mocked(posthog.capture).mockImplementation(() => {
    throw new Error("analytics down");
  });

  expect(() =>
    captureConversion({ href: "https://github.com/mblode/diffhub", label: "GitHub" }),
  ).not.toThrow();
});

test("primary marketing CTAs fire conversion events", () => {
  const homepage = read("../app/(marketing)/page.tsx");
  const install = read("../components/marketing/install-command.tsx");
  const islands = read("../components/marketing/home-islands.tsx");
  const demo = read("../components/marketing/review-demo.tsx");
  const guide = read("../app/(marketing)/cmux-git-diff/page.tsx");
  const guideCommand = read("../components/guides/guide-command.tsx");
  const guides = [
    "git-diff-viewer",
    "review-ai-generated-code",
    "claude-code-review",
    "agent-diff",
  ].map((slug) => read(`../app/(marketing)/${slug}/page.tsx`));
  const navbar = read("../components/shared/navbar.tsx");
  const footer = read("../components/shared/footer.tsx");
  const launcher = read("../components/shared/demo-launcher.tsx");
  const copyButton = read("../components/ui/copy-button.tsx");
  const tracked = read("../components/tracked-cta.tsx");

  expect(tracked).toMatch(/captureConversion/u);
  expect(tracked).toMatch(/TrackedCta/u);

  expect(homepage).toMatch(/label="Try a live review"/u);
  expect(homepage).toMatch(/label="Live demo screenshot"/u);
  expect(homepage).toMatch(/label="Read the install guide"/u);
  expect(homepage).toMatch(/opensDemo/u);
  expect(install).toMatch(/label="Copy install command"/u);
  expect(islands).toMatch(/captureInstallCommandCopied/u);
  expect(demo).toMatch(/opensDemo/u);
  // Guide install commands copy through one island, which fires both the
  // `cta_clicked` label and `install_command_copied`.
  expect(guide).toMatch(/<GuideCommand/u);
  expect(guideCommand).toMatch(/label="Copy install command"/u);
  expect(guideCommand).toMatch(/captureInstallCommandCopied/u);
  for (const page of guides) {
    expect(page).toMatch(/<GuideCommand/u);
  }
  expect(guide).toMatch(/label="Try guide live demo"/u);
  expect(guide).toMatch(/location="\/diffhub\/cmux-git-diff"/u);
  expect(copyButton).toMatch(/captureConversion/u);

  expect(navbar).toMatch(/label="Live demo"/u);
  expect(navbar).toMatch(/label="Docs"/u);
  expect(navbar).toMatch(/label="GitHub"/u);
  expect(footer).toMatch(/label="GitHub"/u);
  expect(footer).toMatch(/label="npm"/u);

  expect(launcher).toMatch(/label: "Open PR"/u);
  expect(launcher).toMatch(/captureConversion/u);
  expect(launcher).toMatch(/captureDemoOpened/u);
});
