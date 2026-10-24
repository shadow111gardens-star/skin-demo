import { useState } from "react";
import { Modal } from "../../components";
import { DEMO_DATE, type RecordItem } from "../../data";
import { useClinic } from "../../store";
import { OperationForm, options } from "../operations/OperationsUI";
import { doctors, calculateAge, likelyDuplicates } from "../../patientServices";
import { leadStages, type LeadStage } from "./model";
import {
  saveLead,
  changeLeadStage,
  logLeadContact,
  convertLead,
  leadMatches,
  type ConversionFields,
} from "./services";
export function useCRMSave() {
  const { state, setState, notify } = useClinic(),
    [error, setError] = useState("");
  return {
    state,
    error,
    save: (fn: (s: typeof state) => typeof state, message: string) => {
      try {
        setState(fn(state));
        setError("");
        notify(message);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unable to save enquiry";
        setError(msg);
        notify(msg, "error");
        return false;
      }
    },
  };
}
export function LeadEditor({
  record,
  onClose,
}: {
  record?: RecordItem;
  onClose: () => void;
}) {
  const { state, error, save } = useCRMSave(),
    d = record?.lead,
    employees = [
      ...new Set([
        "Riya Malhotra",
        "Aarav Singh",
        "Neha Rao",
        ...state.records["Staff & Roles"].map((r) => r.name),
        d?.assignedTo || "",
      ]),
    ].filter(Boolean);
  return (
    <OperationForm
      title={record ? "Edit enquiry" : "Create enquiry"}
      initial={{
        name: record?.name || "",
        phone: d?.phone || "",
        email: d?.email || "",
        treatmentId: d?.treatmentId || "",
        source: d?.source || "Website",
        assignedTo: d?.assignedTo || "Riya Malhotra",
        createdDate: d?.createdDate || DEMO_DATE,
        nextFollowup: d?.nextFollowup || "",
        amount: String(record?.amount || 0),
        notes: d?.notes || "",
      }}
      fields={[
        { key: "name", label: "Full name", required: true },
        { key: "phone", label: "Mobile", type: "tel", required: true },
        { key: "email", label: "Email", type: "email" },
        {
          key: "treatmentId",
          label: "Interested treatment",
          required: true,
          options: [
            { value: "", label: "Select treatment" },
            ...state.records["Treatment Catalogue"].map((t) => ({
              value: t.id,
              label: t.name,
            })),
          ],
        },
        {
          key: "source",
          label: "Lead source",
          required: true,
          options: options([
            ...new Set([
              "Website",
              "Instagram",
              "Referral",
              "Walk-in",
              "Google Ads",
              "Other",
              d?.source || "Website",
            ]),
          ]),
        },
        {
          key: "assignedTo",
          label: "Assigned employee",
          required: true,
          options: options(employees),
        },
        {
          key: "createdDate",
          label: "Enquiry date",
          type: "date",
          required: true,
          readOnly: !!record,
        },
        { key: "nextFollowup", label: "Next follow-up", type: "date" },
        {
          key: "amount",
          label: "Estimated value (INR)",
          type: "number",
          required: true,
          help: "An estimate only; never counted as invoiced or collected revenue.",
        },
        { key: "notes", label: "Enquiry notes", type: "textarea" },
      ]}
      onClose={onClose}
      onSave={(v) =>
        save(
          (s) =>
            saveLead(s, {
              ...record,
              id: record?.id || "lead-" + crypto.randomUUID(),
              name: v.name,
              status: record?.status || "New Enquiry",
              amount: Number(v.amount),
              date: v.createdDate,
              detail: v.notes,
              lead: {
                phone: v.phone,
                email: v.email,
                treatmentId: v.treatmentId,
                source: v.source,
                assignedTo: v.assignedTo,
                createdDate: v.createdDate,
                nextFollowup: v.nextFollowup || undefined,
                notes: v.notes,
                contacts: d?.contacts || [],
                events: d?.events || [],
              },
            }),
          "Enquiry saved",
        )
      }
    >
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </OperationForm>
  );
}
export function LeadStageForm({
  record,
  onClose,
}: {
  record: RecordItem;
  onClose: () => void;
}) {
  const { save, error } = useCRMSave();
  return (
    <OperationForm
      title="Move enquiry stage"
      initial={{
        stage: record.status,
        note: "",
        employee: record.lead!.assignedTo,
      }}
      fields={[
        {
          key: "stage",
          label: "New stage",
          required: true,
          options: options([...leadStages]),
        },
        { key: "employee", label: "Employee", required: true },
        {
          key: "note",
          label: "Stage-change reason",
          type: "textarea",
          required: true,
        },
      ]}
      confirmation="I confirm this staff-entered stage change, including closing or reopening the enquiry. No clinical booking or purchase is created by this action."
      onClose={onClose}
      onSave={(v, c) =>
        save(
          (s) =>
            changeLeadStage(
              s,
              record.id,
              v.stage as LeadStage,
              v.note,
              v.employee,
              c,
            ),
          "Lead stage updated",
        )
      }
    >
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </OperationForm>
  );
}
export function ContactForm({
  record,
  onClose,
}: {
  record: RecordItem;
  onClose: () => void;
}) {
  const { save, error } = useCRMSave(),
    [id] = useState(() => crypto.randomUUID());
  return (
    <OperationForm
      title="Log lead contact"
      initial={{
        date: DEMO_DATE,
        method: "Phone",
        outcome: "Reached",
        employee: record.lead!.assignedTo,
        note: "",
        nextFollowup: record.lead?.nextFollowup || "",
      }}
      fields={[
        { key: "date", label: "Contact date", type: "date", required: true },
        {
          key: "method",
          label: "Contact method",
          options: options([
            "Phone",
            "WhatsApp draft",
            "Email draft",
            "In person",
          ]),
        },
        {
          key: "outcome",
          label: "Contact outcome",
          options: options([
            "Reached",
            "No answer",
            "Requested callback",
            "Not interested",
            "Draft prepared",
          ]),
        },
        { key: "employee", label: "Employee", required: true },
        {
          key: "note",
          label: "Contact note",
          type: "textarea",
          required: true,
        },
        { key: "nextFollowup", label: "Next follow-up", type: "date" },
      ]}
      onClose={onClose}
      onSave={(v) =>
        save(
          (s) =>
            logLeadContact(
              s,
              record.id,
              {
                id,
                date: v.date,
                method: v.method,
                outcome: v.outcome,
                employee: v.employee,
                note: v.note,
              },
              v.nextFollowup,
            ),
          "Contact log saved; no message sent",
        )
      }
    >
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p className="crm-note">
        Manually document an actual contact outcome or draft preparation. This
        form does not call, email or send a message.
      </p>
    </OperationForm>
  );
}
export function ConvertLeadForm({
  record,
  onClose,
  onConverted,
}: {
  record: RecordItem;
  onClose: () => void;
  onConverted: (id: string) => void;
}) {
  const { state, setState, notify } = useClinic(),
    [fields, setFields] = useState<ConversionFields>({
      name: record.name,
      phone: record.lead!.phone,
      email: record.lead!.email,
      dob: "",
      gender: "Prefer not to say",
      address: "",
      doctor: doctors[0],
      preference: "Phone",
      consent: "Pending",
    }),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false),
    [confirm, setConfirm] = useState(false);
  const matches = [
    ...new Map(
      [
        ...leadMatches(state, record),
        ...likelyDuplicates(state.patients, fields.phone, fields.email),
      ].map((p) => [p.id, p]),
    ).values(),
  ];
  function convert(reuseId?: string) {
    try {
      if (!confirm)
        throw new Error("Confirm linking or registering the patient first.");
      const result = convertLead(state, record.id, fields, reuseId);
      setState(result.state);
      notify(
        reuseId
          ? "Existing patient linked; no duplicate created"
          : "Patient registered and enquiry linked",
      );
      onClose();
      onConverted(result.patient.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Conversion failed";
      setError(msg);
      notify(msg, "error");
    }
  }
  const close = () => (dirty ? setDiscard(true) : onClose());
  return (
    <>
      <Modal
        title="Convert enquiry to patient"
        className="operations-modal"
        onClose={close}
      >
        <p className="crm-note">
          Reuse a matching patient to keep appointments, scans, courses and
          payments on one record. Conversion does not book a consultation or
          record a sale.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            convert();
          }}
          onChange={() => {
            setDirty(true);
            setConfirm(false);
          }}
        >
          {matches.length > 0 && (
            <section className="crm-match">
              <h3>Likely existing patients</h3>
              <p>
                Registration is blocked while a matching mobile or email exists.
                Review and reuse the appropriate record.
              </p>
              {matches.map((p) => (
                <div key={p.id}>
                  <strong>{p.name}</strong>
                  <small>
                    {p.id} · {p.phone} · {p.status}
                  </small>
                  <button
                    type="button"
                    className="button"
                    disabled={p.status === "Archived"}
                    onClick={() => convert(p.id)}
                  >
                    Reuse {p.id}
                  </button>
                  {p.status === "Archived" && (
                    <small>
                      Restore the archived patient in Patients before reusing.
                    </small>
                  )}
                </div>
              ))}
            </section>
          )}
          <div className="operations-form">
            {(
              [
                ["name", "Full name", "text"],
                ["phone", "Mobile", "tel"],
                ["email", "Email", "email"],
                ["dob", "Date of birth", "date"],
                ["address", "Address", "text"],
              ] as const
            ).map(([key, label, type]) => (
              <label key={key}>
                {label}
                {["name", "phone", "dob"].includes(key) ? " *" : ""}
                <input
                  aria-label={"Conversion " + label.toLowerCase()}
                  type={type}
                  required={["name", "phone", "dob"].includes(key)}
                  max={type === "date" ? DEMO_DATE : undefined}
                  value={fields[key]}
                  onChange={(e) =>
                    setFields({ ...fields, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <label>
              Calculated age
              <input
                aria-label="Conversion calculated age"
                readOnly
                value={calculateAge(fields.dob) ?? "Enter date of birth"}
              />
            </label>
            {(
              [
                ["doctor", "Assigned doctor", doctors],
                [
                  "gender",
                  "Gender",
                  ["Prefer not to say", "Female", "Male", "Other"],
                ],
                [
                  "preference",
                  "Communication preference",
                  ["Phone", "WhatsApp", "Email"],
                ],
                [
                  "consent",
                  "Consent status",
                  ["Pending", "Recorded", "Declined"],
                ],
              ] as const
            ).map(([key, label, values]) => (
              <label key={key}>
                {label}
                <select
                  aria-label={"Conversion " + label.toLowerCase()}
                  value={fields[key]}
                  onChange={(e) =>
                    setFields({ ...fields, [key]: e.target.value })
                  }
                >
                  {values.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="operations-confirm">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => {
                e.stopPropagation();
                setConfirm(e.target.checked);
              }}
            />
            I reviewed the patient details and confirm registration or linking
            to the selected existing record.
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="button" onClick={close}>
              Cancel
            </button>
            <button
              className="button primary"
              type="submit"
              disabled={matches.length > 0}
            >
              Register & link patient
            </button>
          </div>
        </form>
      </Modal>
      {discard && (
        <Modal
          title="Discard unsaved conversion?"
          onClose={() => setDiscard(false)}
        >
          <p>No patient will be registered.</p>
          <div className="modal-actions">
            <button className="button" onClick={() => setDiscard(false)}>
              Keep editing
            </button>
            <button className="button danger" onClick={onClose}>
              Discard changes
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
