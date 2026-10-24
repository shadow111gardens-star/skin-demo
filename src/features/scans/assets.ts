import type { ScanAsset } from "./model";
export function demonstrationFace(view = "Front", variant = 0): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="760" viewBox="0 0 600 760"><rect width="600" height="760" fill="#f0f3ed"/><path d="M40 80h25M40 80v25M560 80h-25M560 80v25M40 650h25M40 650v-25M560 650h-25M560 650v-25" fill="none" stroke="#9eb09a" stroke-width="2"/><text x="42" y="43" font-family="sans-serif" font-size="11" fill="#82947d" letter-spacing="2">MMVERSE / DEMONSTRATION CAPTURE</text><g fill="none" stroke="#a8b8a1"><path d="M300 138C201 138 160 219 170 338C176 436 214 512 300 552C386 512 424 436 430 338C440 219 399 138 300 138Z" stroke-width="2"/><path d="M230 514v59l-83 44M370 514v59l83 44M217 293q28-19 52-1M331 292q24-18 52 1M220 318q23-14 45 1M335 319q22-15 45-1M300 306l-19 91q19 12 38 0M263 445q37-15 74 0q-37 21-74 0M183 355q117 81 234 0M195 407q105 72 210 0M201 251q99-48 198 0M181 312q119-39 238 0M225 181q-34 157 0 295M375 181q34 157 0 295M300 140v115" stroke-width="1.3"/><path d="M191 362q28 23 54 25M355 387q26-2 54-25" stroke-dasharray="4 5" stroke="#7f9e75"/></g><g fill="${variant ? "#a7b59a" : "#b4bea8"}" opacity=".65">${[
    [211, 349],
    [232, 372],
    [367, 359],
    [385, 386],
    [252, 271],
    [348, 265],
    [244, 403],
    [356, 416],
  ]
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${(i % 3) + 2}"/>`)
    .join(
      "",
    )}</g><rect x="185" y="584" width="230" height="35" rx="17" fill="#e1e9db"/><text x="300" y="606" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#7a9171">${view.toUpperCase()} / ILLUSTRATIVE FACE MAP</text><text x="300" y="690" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#92a288">Not a patient photograph. No measurements derived from this image.</text><text x="300" y="718" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#a1ae96">FICTIONAL DEMO ASSET / PRESERVED ORIGINAL ASPECT RATIO</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function demoPdf() {
  const lines = [
    "MMVerse - Demonstration Scan Report",
    "Fictional report for a browser-local clinic demo.",
    "No patient photograph, diagnosis or device connection.",
    "Measurement values are demonstration indices only.",
  ];
  const stream =
    "BT /F1 18 Tf 48 730 Td " +
    lines.map((s, i) => `${i ? "0 -32 Td " : ""}(${s}) Tj`).join(" ") +
    " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return "data:application/pdf;base64," + btoa(pdf);
}
export function demoAssets(variant = 0): ScanAsset[] {
  return [
    {
      id: "demo-front-" + variant,
      name: "demo-front-face-map.svg",
      mime: "image/svg+xml",
      size: 4200,
      kind: "image",
      view: "Front",
      dataUrl: demonstrationFace("Front", variant),
      demonstration: true,
    },
    {
      id: "demo-report-" + variant,
      name: "mmverse-demonstration-report.pdf",
      mime: "application/pdf",
      size: 1200,
      kind: "report",
      dataUrl: demoPdf(),
      demonstration: true,
    },
  ];
}
export function downloadAsset(asset: ScanAsset) {
  const a = document.createElement("a");
  a.href = asset.dataUrl;
  a.download = asset.name;
  a.click();
}
export function readAsset(
  file: File,
  kind: "image" | "report",
): Promise<ScanAsset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error(`Could not read ${file.name}. Please try again.`));
    reader.onload = () =>
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        mime: file.type,
        size: file.size,
        dataUrl: String(reader.result),
        kind,
        view: kind === "image" ? "Front" : undefined,
      });
    reader.readAsDataURL(file);
  });
}
export function validateUpload(file: File, kind: "image" | "report") {
  if (file.size > 650000)
    return `${file.name}: choose a file under 650 KB for this local demo.`;
  if (!file.size) return `${file.name}: this file is empty.`;
  const allowed =
    kind === "image"
      ? ["image/jpeg", "image/png", "image/webp"]
      : ["application/pdf"];
  const ext = kind === "image" ? /\.(jpe?g|png|webp)$/i : /\.pdf$/i;
  if (!allowed.includes(file.type) || !ext.test(file.name))
    return `${file.name}: ${kind === "image" ? "use JPG, PNG or WebP images" : "use a PDF report"}.`;
  return "";
}
