import { spaResponse } from "@/lib/spa";

export const dynamic = "force-dynamic";

export function GET() {
  return spaResponse();
}
