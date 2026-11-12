/**
 * Renders schema.org data as a JSON-LD script. Dumb.
 *
 * `<` is escaped so a string in the data can never close the script tag
 * early (the standard guard against injection through JSON-LD).
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
