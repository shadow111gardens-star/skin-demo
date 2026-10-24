import { useState, type FormEvent } from "react";
import { ImagePlus, Plus, Trash2, ShieldCheck } from "lucide-react";
import { Modal, SectionTitle, Badge } from "../../components";
import { useClinic, addActivity } from "../../store";
import { DEMO_DATE, type Patient, type RecordItem } from "../../data";
import { dayLabel } from "../../services";
import { PatientRecordList, EmptyPanel } from "./PatientPanels";
export function PatientPhotos({
  patient,
  canEdit,
}: {
  patient: Patient;
  canEdit: boolean;
}) {
  const { state, setState, notify } = useClinic();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const photos = (state.records["Photos"] || []).filter(
    (r) => r.patientId === patient.id,
  );
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = (
      e.currentTarget.elements.namedItem("photo") as HTMLInputElement
    ).files?.[0];
    setError("");
    if (
      !file ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 500000) {
      setError(
        "Choose an image under 500 KB to keep the local demo responsive.",
      );
      return;
    }
    if (!f.get("consent")) {
      setError("Record consent before saving this demo photo.");
      return;
    }
    if (String(f.get("title")).trim().length < 2) {
      setError("Enter a photo title with at least two characters.");
      return;
    }
    setBusy(true);
    try {
      const imageUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      const record: RecordItem = {
        id: crypto.randomUUID(),
        patientId: patient.id,
        name: String(f.get("title")).trim(),
        detail:
          String(f.get("notes")).trim() ||
          "Local demo photo · consent recorded",
        date: String(f.get("date")),
        status: "Consent recorded",
        amount: 0,
        imageUrl,
      };
      const updated = addActivity(
        {
          ...state,
          records: {
            ...state.records,
            Photos: [
              record,
              ...photos,
              ...state.records["Photos"].filter(
                (r) => r.patientId !== patient.id,
              ),
            ],
          },
        },
        `${patient.name}: clinical demo photo added.`,
        patient.id,
      );
      localStorage.setItem("mmverse-v1", JSON.stringify(updated));
      setState(updated);
      setAdding(false);
      notify("Demo photo saved locally");
    } catch {
      setError(
        "This photo could not be saved. Try a smaller image or free browser storage.",
      );
      notify("Photo was not saved", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card patient-photos">
      <SectionTitle
        title="Clinical photos"
        action={canEdit ? "Add demo photo" : undefined}
        onClick={() => {
          setAdding(true);
          setError("");
        }}
      />
      <div className="info-strip">
        <ShieldCheck size={15} />
        Use fictional demonstration images only. Photos stay in this browser; no
        analysis is performed.
      </div>
      <div className="patient-photo-grid">
        {photos.map((p) => (
          <article key={p.id}>
            <button
              className="photo-preview"
              onClick={() => {
                setSelected(p);
                setRemoving(false);
              }}
            >
              <img src={p.imageUrl} alt={p.name} />
            </button>
            <div>
              <strong>{p.name}</strong>
              <small>{p.date ? dayLabel(p.date) : "Undated"}</small>
              <Badge>{p.status}</Badge>
            </div>
          </article>
        ))}
      </div>
      {!photos.length && (
        <EmptyPanel
          title="No clinical photos recorded"
          description="Add a consent-recorded demo image to document this journey."
        />
      )}
      {adding && (
        <Modal
          title="Add clinical demo photo"
          onClose={() => {
            if (!busy) setAdding(false);
          }}
        >
          <form onSubmit={upload}>
            <label>
              Photo title
              <input name="title" minLength={2} required />
            </label>
            <label>
              Date
              <input
                type="date"
                name="date"
                defaultValue={DEMO_DATE}
                max={DEMO_DATE}
                required
              />
            </label>
            <label>
              Image (JPG, PNG or WebP · under 500 KB)
              <input
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-required="true"
              />
            </label>
            <label>
              Notes
              <textarea
                name="notes"
                placeholder="Area, view and clinician-recorded context"
              />
            </label>
            <label className="checkbox">
              <input type="checkbox" name="consent" required />
              Consent for this fictional photo is recorded.
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                <ImagePlus size={15} />
                {busy ? "Saving photo…" : "Save demo photo"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title={removing ? "Delete demo photo" : selected.name}
          onClose={() => setSelected(null)}
        >
          {removing ? (
            <>
              <p>
                Delete this photo permanently from the local demo? This cannot
                be undone.
              </p>
              <div className="form-actions">
                <button
                  className="button secondary"
                  onClick={() => setRemoving(false)}
                >
                  Keep photo
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    setState((s) =>
                      addActivity(
                        {
                          ...s,
                          records: {
                            ...s.records,
                            Photos: s.records["Photos"].filter(
                              (r) => r.id !== selected.id,
                            ),
                          },
                        },
                        `${patient.name}: demo photo deleted.`,
                        patient.id,
                      ),
                    );
                    setSelected(null);
                    notify("Demo photo deleted");
                  }}
                >
                  Delete photo
                </button>
              </div>
            </>
          ) : (
            <>
              <img
                className="large-demo-photo"
                src={selected.imageUrl}
                alt={selected.name}
              />
              <p>{selected.detail}</p>
              {canEdit && (
                <button
                  className="button secondary"
                  onClick={() => setRemoving(true)}
                >
                  <Trash2 size={14} />
                  Delete photo
                </button>
              )}
            </>
          )}
        </Modal>
      )}
    </section>
  );
}
export function PatientDocuments({
  patient,
  canEdit,
  onOpen,
}: {
  patient: Patient;
  canEdit: boolean;
  onOpen: (r: RecordItem) => void;
}) {
  const { state, setState, notify } = useClinic();
  const [adding, setAdding] = useState(false);
  const rows = state.records["Clinical Documents"].filter(
    (r) => r.patientId === patient.id,
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r: RecordItem = {
      id: crypto.randomUUID(),
      patientId: patient.id,
      name: patient.name,
      detail: String(f.get("title")).trim(),
      date: String(f.get("date")),
      status: String(f.get("status")),
      amount: 0,
    };
    setState((s) =>
      addActivity(
        {
          ...s,
          records: {
            ...s.records,
            "Clinical Documents": [r, ...s.records["Clinical Documents"]],
          },
        },
        `${patient.name}: demo consent/document recorded.`,
        patient.id,
      ),
    );
    setAdding(false);
    notify("Demo document record saved");
  }
  return (
    <section className="card">
      <SectionTitle
        title="Consents & documents"
        action={canEdit ? "Record demo document" : undefined}
        onClick={() => setAdding(true)}
      />
      <div className="info-strip">
        Procedure consent and communication preference are separate records. No
        real signatures are captured in this demo.
      </div>
      <PatientRecordList
        rows={rows}
        onOpen={onOpen}
        empty="No consent documents yet"
      />
      {adding && (
        <Modal
          title="Record demo consent/document"
          onClose={() => setAdding(false)}
        >
          <form onSubmit={submit}>
            <label>
              Document title
              <input
                name="title"
                required
                minLength={3}
                placeholder="e.g. Laser course consent"
              />
            </label>
            <label>
              Recorded date
              <input
                name="date"
                type="date"
                defaultValue={DEMO_DATE}
                max={DEMO_DATE}
                required
              />
            </label>
            <label>
              Status
              <select name="status">
                <option>Pending</option>
                <option>Signed</option>
                <option>Reviewed</option>
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" required />I am recording a fictional
              document status, not collecting a real signature.
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              <button className="button primary">
                <Plus size={15} />
                Save demo record
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
