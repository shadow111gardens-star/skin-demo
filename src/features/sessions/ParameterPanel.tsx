import { Settings2, AlertTriangle } from "lucide-react";
import { clinicDoctors } from "../admin/access";
import type { ClinicState } from "../../data";
import { clinicalActor, type SessionData } from "./model";
import { parameterFields } from "./services";
export default function ParameterPanel({
  state,
  draft,
  update,
  role,
  readOnly,
  onConfigure,
}: {
  state: ClinicState;
  draft: SessionData;
  update: (d: Partial<SessionData>) => void;
  role: string;
  readOnly: boolean;
  onConfigure: () => void;
}) {
  const machine = state.records["Machines & Equipment"].find(
    (m) => m.id === draft.machineId,
  );
  const fields = readOnly
    ? draft.parameterSchema
    : parameterFields(state, draft.machineId);
  const configurationChanged =
    !readOnly &&
    !!draft.parameterSchema.length &&
    draft.configurationVersion !== machine?.deviceDocumentation?.version;
  function setValue(id: string, value: string) {
    update({
      parameters: { ...draft.parameters, [id]: value },
      checks: { ...draft.checks, parameters: false },
      parameterApprovalBy: "",
      parameterApprovalNote: "",
      parameterApprovedAt: undefined,
    });
  }
  return (
    <>
      <div className="session-panel-intro">
        <p>
          Clinician-approved documentation only. Values are blank until entered.
          Prior settings are never copied or prescribed.
        </p>
        {machine && clinicalActor(role) && !readOnly && (
          <button className="button secondary" onClick={onConfigure}>
            <Settings2 size={13} />
            Configure fields & units
          </button>
        )}
      </div>
      {configurationChanged && (
        <div className="session-warning">
          <strong>Device documentation changed</strong>
          <p>
            Previously recorded values are withheld because their units or
            fields may have changed. Clear them and record the
            clinician-approved values against the current documentation.
          </p>
          <button
            className="button secondary"
            onClick={() =>
              update({
                parameters: {},
                parameterSchema: fields,
                configurationVersion: machine?.deviceDocumentation?.version,
                checks: { ...draft.checks, parameters: false },
                parameterApprovalBy: "",
                parameterApprovalNote: "",
                parameterApprovedAt: undefined,
              })
            }
          >
            Clear prior settings for new configuration
          </button>
        </div>
      )}
      {!machine ? (
        <div className="session-routine">
          <p>
            No machine selected. Record any required manual procedure/protocol
            approval below.
          </p>
        </div>
      ) : !fields.length ? (
        <div className="session-warning">
          <AlertTriangle size={17} />
          <div>
            <strong>Device documentation not configured</strong>
            <p>
              No settings or units have been invented for {machine.name}. A
              clinician must enter the clinic-verified documentation schema
              before a machine-based sitting can start.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="session-device-source">
            <strong>{machine.name}</strong>
            <span>
              Documentation version{" "}
              {readOnly
                ? draft.configurationVersion
                : machine.deviceDocumentation?.version}
            </span>
            <small>
              Clinic-entered source:{" "}
              {(readOnly
                ? draft.parameterSource
                : machine.deviceDocumentation?.source) || "Source not recorded"}
              . No hardware specification or operating range is asserted.
            </small>
          </div>
          <div className="session-parameter-grid">
            {fields.map((f) => (
              <label key={f.id}>
                {f.label}
                {f.required ? " *" : ""}
                <div>
                  <input
                    aria-label={f.label}
                    disabled={readOnly || configurationChanged}
                    type={f.type === "number" ? "number" : "text"}
                    step={f.type === "number" ? "any" : undefined}
                    value={
                      configurationChanged ? "" : draft.parameters[f.id] || ""
                    }
                    onChange={(e) => setValue(f.id, e.target.value)}
                    placeholder="Not recorded"
                  />
                  <span>{f.unit}</span>
                </div>
              </label>
            ))}
          </div>
        </>
      )}
      <div className="session-approval-fields clinical-fields">
        <label>
          Approving clinician
          <select
            aria-label="Parameter approving clinician"
            value={draft.parameterApprovalBy}
            disabled={readOnly || configurationChanged}
            onChange={(e) => update({ parameterApprovalBy: e.target.value })}
          >
            <option value="">Select clinician</option>
            {clinicDoctors(state).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          Approval / protocol reference
          <input
            aria-label="Parameter approval note"
            value={draft.parameterApprovalNote}
            disabled={readOnly || configurationChanged}
            onChange={(e) => update({ parameterApprovalNote: e.target.value })}
            placeholder="Enter the recorded clinician approval reference"
          />
        </label>
      </div>
      <label className="session-checkbox">
        <input
          type="checkbox"
          disabled={readOnly || configurationChanged}
          checked={draft.checks.parameters}
          onChange={(e) =>
            update({
              checks: { ...draft.checks, parameters: e.target.checked },
              parameterApprovedAt: e.target.checked
                ? new Date().toISOString()
                : undefined,
            })
          }
        />
        These documented parameters / protocol were approved by the named
        clinician for this sitting.
      </label>
    </>
  );
}
