import type { SettingField } from "./settingsServices";
export default function SettingFields({
  fields,
  values,
  onChange,
}: {
  fields: SettingField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="admin-form-fields">
      {fields.map((f) => (
        <label
          className={
            f.type === "textarea" || f.type === "checks"
              ? "admin-wide-field"
              : f.type === "checkbox"
                ? "admin-checkbox"
                : ""
          }
          key={f.key}
        >
          {f.type === "checkbox" ? (
            <>
              <input
                type="checkbox"
                checked={values[f.key] === "yes"}
                onChange={(e) =>
                  onChange(f.key, e.target.checked ? "yes" : "no")
                }
              />
              {f.label}
            </>
          ) : (
            <>
              {f.label}
              {f.required ? " *" : ""}
              {f.type === "select" ? (
                <select
                  aria-label={f.label}
                  value={values[f.key] || ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "checks" ? (
                <span className="admin-check-group">
                  {f.options?.map((o) => (
                    <span key={o.value}>
                      <input
                        aria-label={o.label}
                        type="checkbox"
                        checked={(values[f.key] || "")
                          .split("|")
                          .includes(o.value)}
                        onChange={(e) =>
                          onChange(
                            f.key,
                            e.target.checked
                              ? [
                                  ...(values[f.key] || "")
                                    .split("|")
                                    .filter(Boolean),
                                  o.value,
                                ].join("|")
                              : (values[f.key] || "")
                                  .split("|")
                                  .filter((v) => v !== o.value)
                                  .join("|"),
                          )
                        }
                      />
                      {o.label}
                    </span>
                  ))}
                </span>
              ) : f.type === "textarea" ? (
                <textarea
                  aria-label={f.label}
                  required={f.required}
                  value={values[f.key] || ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              ) : (
                <input
                  aria-label={f.label}
                  required={f.required}
                  type={f.type || "text"}
                  min={f.type === "number" ? 0 : undefined}
                  step={f.type === "number" ? "any" : undefined}
                  value={values[f.key] || ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}
            </>
          )}
          {f.help && <small>{f.help}</small>}
        </label>
      ))}
    </div>
  );
}
