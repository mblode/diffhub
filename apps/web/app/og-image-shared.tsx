import { readFileSync } from "node:fs";
import path from "node:path";

import { ImageResponse } from "next/og";

/**
 * The house social card, shared by every blode.co zone. Rule 12 of
 * `blode-co/apps/web/.claude/knowledge/zone-conventions.md`; the original is
 * `renderZoneOgImage` in `blode-co/apps/web/lib/og-image.tsx`.
 *
 * Copied into each zone rather than published as a package, deliberately: a
 * package would make 33 repos share a release cadence and a dependency they do
 * not otherwise need, to save an edit that happens a few times a year. See the
 * note at the bottom of the conventions file.
 *
 * Before this card existed the fleet had eighteen unrelated designs, title
 * sizes from 68px to 168px, one zone printing its own URL back at itself, and
 * one rendering Geist Sans in a fleet where every app otherwise loads Glide.
 *
 * Three constraints, all load-bearing:
 *
 * 1. **Satori cannot read woff2.** It throws `Unsupported OpenType signature
 *    wOF2`, a hard error rather than a silent fallback, so the variable woff2
 *    this app serves to browsers is unusable here. `lib/og-assets/` holds
 *    static TTF cuts instanced at wght 400 and 600 and subset to Latin-1 plus
 *    punctuation. Copy those files; do not regenerate them.
 * 2. **Satori parses neither `oklch()` nor CSS variables**, so every colour
 *    below is a hand-synced sRGB literal.
 * 3. **This is a `.tsx` route and must stay one.** Next emits a *static*
 *    metadata image file (`opengraph-image.png`) with `basePath` already on
 *    it, and `metadataBase` carries the basePath too (Rule 11), so the two
 *    stack up into `/zone/zone/opengraph-image.png`. A generated route is not
 *    prefixed, so this form is the one that cannot double.
 */

export const OG_SIZE = { height: 630, width: 1200 } as const;
export const OG_CONTENT_TYPE = "image/png";

const BRAND_GRADIENT =
  "linear-gradient(150deg, rgb(0, 144, 245) 0%, rgb(230, 214, 221) 52%, rgb(234, 176, 69) 100%)";
// Kept in sync by hand with --primary, oklch(0.52 0.23 268). Cards render light
// in both schemes: a social card is an image, and the feeds that embed it have
// no idea what the reader's OS is set to.
const PRIMARY = "#3452ea";
const BYLINE = "Matthew Blode";

const ogAsset = (file: string) => path.join(process.cwd(), "lib/og-assets", file);

// Read at build time; these cards are statically prerendered.
const glideFonts = [
  {
    data: readFileSync(ogAsset("glide-400.ttf")),
    name: "Glide",
    style: "normal" as const,
    weight: 400 as const,
  },
  {
    data: readFileSync(ogAsset("glide-600.ttf")),
    name: "Glide",
    style: "normal" as const,
    weight: 600 as const,
  },
  {
    data: readFileSync(ogAsset("glide-italic-500.ttf")),
    name: "Glide",
    style: "italic" as const,
    weight: 500 as const,
  },
  {
    data: readFileSync(ogAsset("glide-mono-400.ttf")),
    name: "Glide Mono",
    style: "normal" as const,
    weight: 400 as const,
  },
];

export const renderZoneOgImage = ({
  badge,
  eyebrow,
  subtitle,
  title,
}: {
  /** Short uppercase label for the pill, e.g. `TILLER`. */
  badge: string;
  /** The public URL, e.g. `blode.co/tiller`. */
  eyebrow: string;
  subtitle: string;
  title: string;
}) => {
  // One scale, three steps. The fleet's old range was 68px to 168px, which is
  // what made a row of shared cards look like a row of unrelated products.
  let titleSize = 64;
  if (title.length > 28) {
    titleSize = 52;
  }
  if (title.length > 44) {
    titleSize = 44;
  }

  const content = (
    <div
      style={{
        background: BRAND_GRADIENT,
        display: "flex",
        height: "100%",
        padding: 24,
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 28,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "40px 44px 36px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              color: "rgb(19,21,23)",
              display: "flex",
              fontFamily: "Glide Mono",
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: "0.04em",
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              background: PRIMARY,
              borderRadius: 999,
              color: "#ffffff",
              display: "flex",
              fontFamily: "Glide",
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.08em",
              padding: "8px 18px",
            }}
          >
            {badge}
          </div>
        </div>

        {/*
          Centred, not bottom-anchored. The /stack card fills its middle with
          tool tiles and can afford to sit its type at the edges; a text-only
          card doing the same just reads as a void with writing round it.
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            justifyContent: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              color: "rgb(19,21,23)",
              display: "flex",
              fontFamily: "Glide",
              fontSize: titleSize,
              fontStyle: "italic",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: "rgb(82,88,98)",
              display: "flex",
              fontFamily: "Glide",
              fontSize: 26,
              fontWeight: 400,
              marginTop: 14,
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            color: "rgb(107,114,126)",
            display: "flex",
            fontFamily: "Glide",
            fontSize: 20,
            fontWeight: 400,
          }}
        >
          {BYLINE}
        </div>
      </div>
    </div>
  );

  return new ImageResponse(content, { ...OG_SIZE, fonts: glideFonts });
};
