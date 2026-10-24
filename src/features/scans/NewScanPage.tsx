import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useClinic } from "../../store";
import { canCreateScan } from "./model";
import ScanWizard from "./ScanWizard";
import type { Role } from "../../auth";
export default function NewScanPage({ role }: { role: Role }) {
  const navigate = useNavigate();
  const { scanId } = useParams();
  const [params] = useSearchParams();
  const { state } = useClinic();
  const existing = state.records["Skin Analysis"].find((r) => r.id === scanId);
  if (!canCreateScan(role))
    return (
      <section className="card empty">
        <h1>Scan capture is unavailable for this demo role</h1>
        <p>
          Choose Doctor, Clinic Owner or Laser Technician to prepare a scan.
        </p>
      </section>
    );
  if (scanId && (!existing || existing.status !== "Draft"))
    return (
      <section className="card empty">
        <h1>Draft unavailable</h1>
        <button
          className="button secondary"
          onClick={() => navigate("/skin-analysis")}
        >
          Scan library
        </button>
      </section>
    );
  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PATIENT-LINKED CAPTURE</div>
          <h1>{existing ? "Edit scan draft" : "New skin scan"}</h1>
          <p>Organize source files, then request a clinician review.</p>
        </div>
      </div>
      <section className="card scan-new-page">
        <ScanWizard
          key={existing?.id || params.toString()}
          existing={existing}
          initialPatientId={params.get("patientId") || ""}
          initialArea={params.get("area") || "Full face"}
          onClose={() =>
            navigate(
              existing ? "/skin-analysis/" + existing.id : "/skin-analysis",
            )
          }
          onSaved={(r, review) =>
            navigate("/skin-analysis/" + r.id + (review ? "/review" : ""))
          }
        />
      </section>
    </div>
  );
}
