/** Renders one prototype page string. The strings carry their own nav + footer. */
export function ProtoPage({ html }: { html: string }) {
  return <div className="proto-page" dangerouslySetInnerHTML={{ __html: html }} />;
}
