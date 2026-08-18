import type { Metadata } from "next";
import { ProtoPage } from "../_site/Page";
import { PRODUCT_HTML } from "../_site/html";

export const metadata: Metadata = { title: "Product — TailorCV" };

export default function Page() {
  return <ProtoPage html={PRODUCT_HTML} />;
}
