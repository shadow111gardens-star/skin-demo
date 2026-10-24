import { useState } from "react";
import {
  Download,
  FileText,
  Maximize2,
  ImageOff,
  ShieldCheck,
} from "lucide-react";
import { Modal, Badge } from "../../components";
import type { RecordItem } from "../../data";
import type { ScanAsset } from "./model";
import { downloadAsset } from "./assets";
import { metricEntries } from "./services";
export function ScanSafety({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`scan-safety ${compact ? "compact" : ""}`}>
      <ShieldCheck size={16} />
      <span>
        <strong>Demonstration data · clinician review required</strong>
        {!compact && (
          <small>
            Organize reports and record clinical observations. No image
            analysis, AI diagnosis or real device connectivity.
          </small>
        )}
      </span>
    </div>
  );
}
export function MetricPanels({ record }: { record: RecordItem }) {
  const entries = metricEntries(record);
  return entries.length ? (
    <div className="analysis-metrics">
      {entries.map((m) => (
        <div className="analysis-metric" key={m.key}>
          <small>{m.label}</small>
          <strong>
            {m.value}
            <span>/100</span>
          </strong>
          <div className="analysis-index-track">
            <span style={{ width: m.value + "%" }} />
          </div>
          <span>Demonstration index</span>
        </div>
      ))}
    </div>
  ) : (
    <div className="scan-inline-empty">
      <FileText size={20} />
      <span>
        No measurement values were provided. Uploaded images do not generate
        measurements.
      </span>
    </div>
  );
}
export function ScanAssetPreview({
  asset,
  caption,
  onExpand,
}: {
  asset: ScanAsset;
  caption?: string;
  onExpand?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="scan-asset-preview">
      {asset.kind === "image" ? (
        <button
          type="button"
          className="scan-image-button"
          onClick={onExpand}
          aria-label={`View original ${asset.name}`}
          disabled={!onExpand}
        >
          {failed ? (
            <span className="image-unavailable">
              <ImageOff size={27} />
              Preview unavailable. The attached original can still be
              downloaded.
            </span>
          ) : (
            <img
              src={asset.dataUrl}
              alt={caption || asset.name}
              onError={() => setFailed(true)}
            />
          )}
          <span className="image-view-tag">
            {asset.view || "Original image"}
            {onExpand && <Maximize2 size={12} />}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="scan-pdf-preview"
          onClick={onExpand}
          aria-label={`View original ${asset.name}`}
          disabled={!onExpand}
        >
          <FileText size={31} />
          <strong>{asset.name}</strong>
          <span>Original PDF report</span>
        </button>
      )}
      {caption && <p>{caption}</p>}
    </div>
  );
}
export function AssetViewer({
  asset,
  onClose,
}: {
  asset: ScanAsset;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Original scan asset"
      className="scan-asset-modal"
      onClose={onClose}
    >
      <div className="asset-viewer-heading">
        <span>
          <strong>{asset.name}</strong>
          <small>
            {asset.kind === "image"
              ? asset.view || "Original view"
              : "PDF report"}{" "}
            · original file
          </small>
        </span>
        <button
          className="button secondary"
          onClick={() => downloadAsset(asset)}
        >
          <Download size={14} />
          Download original
        </button>
      </div>
      {asset.kind === "image" ? (
        <img
          className="scan-original-image"
          src={asset.dataUrl}
          alt={asset.name}
        />
      ) : (
        <>
          <iframe
            className="scan-original-pdf"
            src={asset.dataUrl}
            title={asset.name}
          />
          <p className="scan-caption">
            If your browser cannot preview this PDF, use Download original.
          </p>
        </>
      )}
      <div className="scan-asset-disclaimer">
        <Badge>
          {asset.demonstration
            ? "Seeded demonstration asset"
            : "Uploaded demo asset"}
        </Badge>
        <span>
          Original aspect ratio preserved · no image-derived measurements
        </span>
      </div>
    </Modal>
  );
}
