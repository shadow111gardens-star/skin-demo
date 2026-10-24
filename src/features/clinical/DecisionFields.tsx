import type { Decision } from "./model";
import type { RecordItem } from "../../data";
export default function DecisionFields({
  value,
  onChange,
  treatments,
  disabled = false,
}: {
  value: Decision;
  onChange: (value: Decision) => void;
  treatments: RecordItem[];
  disabled?: boolean;
}) {
  const update = (key: keyof Decision, v: string | number) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="clinical-fields">
      <label>
        Treatment
        <select
          aria-label="Treatment"
          disabled={disabled}
          value={value.treatmentId}
          onChange={(e) => {
            const t = treatments.find((t) => t.id === e.target.value);
            if (t?.treatment)
              onChange({
                ...value,
                treatmentId: t.id,
                sessions: t.treatment.sessions,
                intervalDays: t.treatment.intervalDays,
                duration: t.treatment.duration,
                price: t.treatment.packagePrice,
                consent: t.treatment.consent,
              });
            else update("treatmentId", "");
          }}
        >
          <option value="">Select treatment</option>
          {treatments
            .filter((t) => t.status === "Active" || t.id === value.treatmentId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.status === "Inactive" ? " (inactive)" : ""}
              </option>
            ))}
        </select>
      </label>
      <label>
        Treatment area
        <input
          aria-label="Treatment area"
          disabled={disabled}
          value={value.area}
          onChange={(e) => update("area", e.target.value)}
          placeholder="Clinician-defined area"
        />
      </label>
      {[
        ["Proposed session count", "sessions", 100],
        ["Recommended interval (days)", "intervalDays", 3650],
        ["Expected duration (minutes)", "duration", 600],
        ["Proposed price (INR)", "price", 10000000],
      ].map(([label, key, max]) => (
        <label key={key}>
          {label}
          <input
            aria-label={String(label)}
            disabled={disabled}
            type="number"
            min={key === "price" ? 0 : 1}
            max={Number(max)}
            step="1"
            value={value[key as keyof Decision]}
            onChange={(e) =>
              update(key as keyof Decision, Number(e.target.value))
            }
          />
        </label>
      ))}
      <label className="clinical-span">
        Instructions
        <textarea
          aria-label="Treatment instructions"
          disabled={disabled}
          value={value.instructions}
          onChange={(e) => update("instructions", e.target.value)}
          placeholder="Clinician-entered instructions"
        />
      </label>
      <label className="clinical-span">
        Consent requirements
        <textarea
          aria-label="Consent requirements"
          disabled={disabled}
          value={value.consent}
          onChange={(e) => update("consent", e.target.value)}
        />
      </label>
    </div>
  );
}
