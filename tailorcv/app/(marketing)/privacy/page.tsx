import type { Metadata } from "next";
import { ProtoPage } from "../_site/Page";
import { PRIVACY_HTML } from "../_site/html";

export const metadata: Metadata = { title: "Privacy — TailorCV" };

export default function Page() {
  return <ProtoPage html={PRIVACY_HTML} />;
}
