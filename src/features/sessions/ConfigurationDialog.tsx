import { DiscardDialog } from "../clinical/ClinicalComponents";
import { useState } from "react";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { Modal } from "../../components";
import { clinicDoctors } from "../admin/access";
import { useClinic } from "../../store";
import { configureDevice, savePolicy } from "./services";
import {
  defaultPolicy,
  type DeviceDocumentation,
  type SessionPolicy,
} from "./model";
import type { ClinicState } from "../../data";
export default function ConfigurationDialog({
  machineId,
  role,
  onClose,
  onSave,
}: {
  machineId?: string;
  role: string;
  onClose: () => void;
  onSave: (s: ClinicState, message: string) => boolean;
}) {
  const { state } = useClinic();
  const machine = state.records["Machines & Equipment"].find(
    (m) => m.id === machineId,
  );
  const [config, setConfig] = useState<DeviceDocumentation>(() =>
    structuredClone(
      machine?.deviceDocumentation || {
        fields: [],
        source: "",
        configuredBy: clinicDoctors(state)[0] || "",
        version: 0,
      },
    ),
  );
  const [policy, setPolicy] = useState<SessionPolicy>({
    ...defaultPolicy,
    ...state.sessionPolicy,
  });
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const [initial] = useState(() => JSON.stringify({ config, policy }));
  const requestClose = () => {
    if (initial !== JSON.stringify({ config, policy })) setDiscard(true);
    else onClose();
  };
  return (
    <>
      <Modal
        title={
          machine
            ? "Device documentation configuration"
            : "Clinic session checks"
        }
        className="session-config-modal"
        onClose={requestClose}
      >
        <div className="clinical-form">
          <p className="clinical-footnote">
            {machine
              ? "Define documentation labels and units from clinic-verified device documentation. These are not manufacturer specifications, operating ranges or prescribed settings. No parameter values are generated. Saving a changed configuration clears this sitting’s unsaved parameter values and requires fresh approval."
              : "Clinic-configured operational checks. Patient identity, relevant consent and clinician completion review remain mandatory."}
          </p>
          {machine ? (
            <>
              <h3>
                <Settings2 size={16} /> {machine.name}
              </h3>
              <label>
                Documentation source / reference
                <input
                  aria-label="Device documentation source"
                  value={config.source}
                  onChange={(e) =>
                    setConfig({ ...config, source: e.target.value })
                  }
                  placeholder="Clinic-verified manual or configuration reference"
                />
              </label>
              <label>
                Configuring clinician
                <select
                  value={config.configuredBy}
                  onChange={(e) =>
                    setConfig({ ...config, configuredBy: e.target.value })
                  }
                >
                  {clinicDoctors(state).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <p className="clinical-footnote">
                Add only source-supported fields: energy, pulse duration,
                frequency, spot size, shot count, cooling or
                manufacturer-specific entries. Record each unit from the
                clinic-verified source.
              </p>
              <div className="device-config-fields">
                {config.fields.map((f, i) => (
                  <div key={f.id}>
                    <label>
                      Field label
                      <input
                        aria-label={"Parameter field label " + (i + 1)}
                        value={f.label}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            fields: config.fields.map((v) =>
                              v.id === f.id
                                ? { ...v, label: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Unit from source
                      <input
                        aria-label={"Parameter field unit " + (i + 1)}
                        value={f.unit}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            fields: config.fields.map((v) =>
                              v.id === f.id
                                ? { ...v, unit: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Value type
                      <select
                        value={f.type}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            fields: config.fields.map((v) =>
                              v.id === f.id
                                ? {
                                    ...v,
                                    type: e.target.value as "text" | "number",
                                  }
                                : v,
                            ),
                          })
                        }
                      >
                        <option value="number">Number</option>
                        <option value="text">Text</option>
                      </select>
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            fields: config.fields.map((v) =>
                              v.id === f.id
                                ? { ...v, required: e.target.checked }
                                : v,
                            ),
                          })
                        }
                      />
                      Required
                    </label>
                    <button
                      className="icon"
                      aria-label={"Remove field " + (i + 1)}
                      onClick={() =>
                        setConfig({
                          ...config,
                          fields: config.fields.filter((v) => v.id !== f.id),
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="button secondary"
                onClick={() =>
                  setConfig({
                    ...config,
                    fields: [
                      ...config.fields,
                      {
                        id: crypto.randomUUID(),
                        label: "",
                        unit: "",
                        type: "number",
                        required: true,
                      },
                    ],
                  })
                }
              >
                <Plus size={14} />
                Add documentation field
              </button>
              <p className="clinical-footnote">
                Typical labels may include energy/fluence, pulse duration,
                frequency, spot size, shot count, cooling and
                manufacturer-specific notes. Enter only fields and units
                supported by the clinic’s source.
              </p>
            </>
          ) : (
            Object.entries({
              requireConsentDocument:
                "Require a linked recorded consent document",
              requireHistoryReview: "Require allergy, alert and history review",
              requireParameterReview:
                "Require documented clinician parameter/protocol approval",
              requireMachineCheck:
                "Require operator machine-readiness confirmation",
              requirePaidPackage: "Require package payment before starting",
              requireValidPackage: "Require a valid unexpired package",
            }).map(([key, label]) => (
              <label className="checkbox" key={key}>
                <input
                  type="checkbox"
                  checked={policy[key as keyof SessionPolicy]}
                  onChange={(e) =>
                    setPolicy({ ...policy, [key]: e.target.checked })
                  }
                />
                {label}
              </label>
            ))
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button secondary" onClick={requestClose}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                try {
                  const next = machine
                    ? configureDevice(state, machine.id, config, role)
                    : savePolicy(state, policy, role);
                  if (
                    onSave(
                      next,
                      machine
                        ? "Device documentation fields saved"
                        : "Clinic session checks saved",
                    )
                  )
                    onClose();
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              Save configuration
            </button>
          </div>
        </div>
      </Modal>
      {discard && (
        <DiscardDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />
      )}
    </>
  );
}
