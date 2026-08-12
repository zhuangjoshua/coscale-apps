"use client";

import { useState } from "react";

export default function NewFormFields() {
  const [sheetUrl, setSheetUrl] = useState("");
  const hasSheet = sheetUrl.trim() !== "";

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-[#3d3a35]">
          Google Sheet URL{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          name="spreadsheet"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Leave empty and we’ll create a new sheet in your Google Drive.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {hasSheet && (
          <div>
            <label className="block text-sm font-medium text-[#3d3a35]">
              Tab name
            </label>
            <input
              name="sheet_name"
              placeholder="Sheet1"
              className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Which tab of that sheet to write to (defaults to Sheet1).
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-[#3d3a35]">
            Redirect URL (optional)
          </label>
          <input
            name="redirect_url"
            placeholder="https://yoursite.com/thanks"
            className="mt-1 w-full rounded-brand border px-3 py-2 text-sm"
          />
        </div>
      </div>
    </>
  );
}
