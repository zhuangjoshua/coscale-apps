"use client";

import { useState } from "react";

export default function NewFormFields() {
  const [sheetUrl, setSheetUrl] = useState("");
  const hasSheet = sheetUrl.trim() !== "";

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Google Sheet URL{" "}
          <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input
          name="spreadsheet"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Leave empty and we’ll create a new sheet in your Google Drive.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {hasSheet && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tab name
            </label>
            <input
              name="sheet_name"
              placeholder="Sheet1"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Which tab of that sheet to write to (defaults to Sheet1).
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Redirect URL (optional)
          </label>
          <input
            name="redirect_url"
            placeholder="https://yoursite.com/thanks"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>
    </>
  );
}
