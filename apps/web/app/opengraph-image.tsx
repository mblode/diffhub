import { renderZoneOgImage } from "@/app/og-image-shared";
import { OgLogo } from "@/app/og-logo";

export { OG_CONTENT_TYPE as contentType, OG_SIZE as size } from "@/app/og-image-shared";

export const alt = "DiffHub";

/**
 * The house card (Rule 12), replacing the static `public/opengraph-image.png`.
 *
 * Converting the PNG to a generated route is also the Rule 11 fix. A static
 * metadata image in `app/` already carries `basePath`, so pointing
 * `metadataBase` at the zone while that PNG is still there produces
 * `/diffhub/diffhub/opengraph-image.png`. A generated route is not prefixed,
 * so this form is the one that cannot double.
 *
 * The matching `twitter-image.png` is gone rather than converted: Next reuses
 * this route for `twitter:image`, and the old pair were the same file twice.
 */
export default function OpengraphImage() {
  return renderZoneOgImage({
    background: "#f7f7f4",
    color: "#26251e",
    logo: <OgLogo />,
    title: "DiffHub",
  });
}
