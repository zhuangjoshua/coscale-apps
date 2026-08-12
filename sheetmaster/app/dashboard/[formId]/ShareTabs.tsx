"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function ShareTabs({
  hostedUrl,
  htmlExport,
}: {
  hostedUrl: string;
  htmlExport: string;
}) {
  const [tab, setTab] = useState<"link" | "embed" | "code" | "qr">("link");
  const [copied, setCopied] = useState(false);
  const [qrPng, setQrPng] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(hostedUrl, { width: 480, margin: 2 }).then(setQrPng);
  }, [hostedUrl]);

  async function downloadSvg() {
    const svg = await QRCode.toString(hostedUrl, { type: "svg", margin: 2 });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "form-qr.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const iframeSnippet = `<iframe src="${hostedUrl}" width="100%" height="600" frameborder="0" style="border:none"></iframe>`;

  const current =
    tab === "link" ? hostedUrl : tab === "embed" ? iframeSnippet : htmlExport;

  async function copy() {
    await navigator.clipboard.writeText(current);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const tabClass = (t: string) =>
    `rounded-brand px-3 py-1.5 text-sm font-medium ${
      tab === t
        ? "bg-primary text-white"
        : "bg-muted text-muted-foreground hover:bg-line"
    }`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" className={tabClass("link")} onClick={() => setTab("link")}>
          Link
        </button>
        <button type="button" className={tabClass("embed")} onClick={() => setTab("embed")}>
          Embed in your site
        </button>
        <button type="button" className={tabClass("code")} onClick={() => setTab("code")}>
          Code
        </button>
        <button type="button" className={tabClass("qr")} onClick={() => setTab("qr")}>
          QR
        </button>
        {tab !== "qr" && (
          <button
            type="button"
            onClick={copy}
            className="ml-auto rounded-brand border border-line px-3 py-1.5 text-sm text-[#3d3a35] hover:border-primary"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>

      {tab === "link" && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Share this link anywhere — no website needed. We host the form.
          </p>
          <code className="mt-2 block rounded bg-muted px-3 py-2 text-sm break-all">
            <a href={hostedUrl} target="_blank" className="text-primary hover:underline">
              {hostedUrl}
            </a>
          </code>
        </div>
      )}
      {tab === "embed" && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Paste into your site builder&apos;s <strong>Embed</strong> block
            (Squarespace, Webflow, Wix, Carrd, Notion…). Always shows the latest
            version of your form.
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-green-300">
            {iframeSnippet}
          </pre>
        </div>
      )}
      {tab === "qr" && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Print it on flyers, table tents, posters — scanning opens your form.
            It never goes stale: edits to the form don&apos;t change the QR.
          </p>
          <div className="mt-3 flex items-center gap-6">
            {qrPng && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrPng}
                alt="QR code for your form"
                className="h-40 w-40 rounded-brand border bg-white"
              />
            )}
            <div className="space-y-2">
              {qrPng && (
                <a
                  href={qrPng}
                  download="form-qr.png"
                  className="block rounded-brand bg-primary px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-dark"
                >
                  Download PNG
                </a>
              )}
              <button
                type="button"
                onClick={downloadSvg}
                className="block w-full rounded-brand border border-line px-4 py-2 text-sm text-[#3d3a35] hover:border-primary"
              >
                Download SVG (print-sharp)
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === "code" && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Raw HTML with validation and spam protection built in. Paste into
            your own site and style it with your CSS. Re-copy after editing the
            form — this snapshot doesn&apos;t auto-update (old copies keep
            working; new fields just won&apos;t appear until you re-paste).
          </p>
          <pre className="mt-2 max-h-80 overflow-auto rounded bg-gray-900 p-3 text-xs text-green-300">
            {htmlExport}
          </pre>
        </div>
      )}
    </div>
  );
}
