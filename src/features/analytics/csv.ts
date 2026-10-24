export type CSVValue = string | number | null | undefined;
export function encodeCSV(rows: CSVValue[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text =
              value === null || value === undefined ? "" : String(value);
            if (typeof value === "string" && /^[\s]*[=+@\-\t\r]/.test(text))
              text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
export function downloadCSV(filename: string, rows: CSVValue[][]) {
  if (typeof URL.createObjectURL !== "function")
    throw new Error("CSV download is not supported in this browser.");
  const blob = new Blob([encodeCSV(rows)], { type: "text/csv;charset=utf-8;" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
