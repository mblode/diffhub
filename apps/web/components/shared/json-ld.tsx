/* biome-ignore-all lint/security/noDangerouslySetInnerHtml: JSON-LD must be emitted as raw script content. */
/* eslint-disable react/no-danger -- JSON-LD must be emitted as raw script content. */
interface JsonLdProps {
  data: Record<string, unknown>;
}

export const JsonLd = ({ data }: JsonLdProps): React.JSX.Element => (
  <script dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} type="application/ld+json" />
);
