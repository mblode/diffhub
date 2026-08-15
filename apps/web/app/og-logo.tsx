import { readFileSync } from "node:fs";
import path from "node:path";

const mark = `data:image/png;base64,${readFileSync(
  path.join(process.cwd(), "lib/og-assets/logo.png"),
).toString("base64")}`;

/** The stack tile from blode.co/stack. Satori only supports `<img>`. */
export const OgLogo = () => (
  // oxlint-disable-next-line no-img-element -- Satori (ImageResponse) only supports <img>
  <img alt="" height={64} src={mark} style={{ borderRadius: 16 }} width={64} />
);
