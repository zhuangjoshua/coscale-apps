import type { Metadata } from "next";
import { ProtoPage } from "../_site/Page";
import { FAQ_HTML } from "../_site/html";

export const metadata: Metadata = { title: "FAQ — TailorCV" };

export default function Page() {
  return <ProtoPage html={FAQ_HTML} />;
}
