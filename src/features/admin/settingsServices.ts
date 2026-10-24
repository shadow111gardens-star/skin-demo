import { type ClinicState } from "../../data";
import { addActivity } from "../../store";
import { validPhone, validEmail } from "../../patientServices";
import { saveTreatment } from "../clinical/services";
import { saveMachine, saveRoom } from "../operations/services";
import { savePackage, saveTaxConfiguration } from "../finance/services";
import { configureDevice } from "../sessions/services";
import {
  defaultAdminSettings,
  notificationCategories,
  type SettingSection,
  type MessageTemplate,
} from "./model";
import type { DeviceDocumentation } from "../sessions/model";
import type { TaxConfig } from "../finance/model";
export interface SettingField {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "textarea"
    | "checkbox"
    | "email"
    | "tel"
    | "date"
    | "select"
    | "checks";
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
}
export const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));
export function sectionOptions(s: ClinicState, section: SettingSection) {
  if (
    ["Treatments", "Treatment Intervals", "Appointment Durations"].includes(
      section,
    )
  )
    return s.records["Treatment Catalogue"]
      .filter((r) => r.treatment)
      .map((r) => ({ value: r.id, label: r.name }));
  if (["Machines", "Session Parameter Schemas"].includes(section))
    return s.records["Machines & Equipment"].map((r) => ({
      value: r.id,
      label: r.name,
    }));
  if (section === "Rooms")
    return s.records["Rooms & Resources"].map((r) => ({
      value: r.id,
      label: r.room?.code + " · " + r.name,
    }));
  if (section === "Package Validity")
    return s.records["Package Catalogue"].map((r) => ({
      value: r.id,
      label: r.name,
    }));
  if (section === "Reminder Templates")
    return (s.adminSettings?.reminderTemplates || []).map((t) => ({
      value: t.id,
      label: t.name,
    }));
  if (section === "Consent Templates")
    return (s.adminSettings?.consentTemplates || []).map((t) => ({
      value: t.id,
      label: t.name,
    }));
  return [];
}
export function settingsForm(
  s: ClinicState,
  section: SettingSection,
  id: string,
): { fields: SettingField[]; values: Record<string, string>; note: string } {
  const a = s.adminSettings || defaultAdminSettings();
  let fields: SettingField[] = [],
    values: Record<string, string> = {},
    note = "Changes are saved only in this browser.";
  const r = (key: string) => s.records[key].find((r) => r.id === id);
  if (section === "Clinic Profile") {
    fields = [
      { key: "name", label: "Clinic name", required: true },
      {
        key: "address",
        label: "Clinic address",
        type: "textarea",
        required: true,
      },
      { key: "phone", label: "Reception mobile", type: "tel", required: true },
      { key: "email", label: "Clinic email", type: "email", required: true },
      { key: "website", label: "Website" },
      {
        key: "timezone",
        label: "Scheduling timezone",
        required: true,
        help: "The demo schedules in Asia/Kolkata (IST); Asia/Calcutta is accepted as its alias.",
      },
    ];
    values = { name: s.clinicName, ...a.profile };
  }
  if (
    ["Treatments", "Treatment Intervals", "Appointment Durations"].includes(
      section,
    )
  ) {
    const t = r("Treatment Catalogue");
    if (!t?.treatment)
      return {
        fields: [],
        values: {},
        note: "Create a treatment in Treatment Catalogue first.",
      };
    const d = t.treatment;
    if (section === "Treatments") {
      fields = [
        { key: "name", label: "Treatment name", required: true },
        { key: "category", label: "Category", required: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: options(["Active", "Inactive"]),
        },
        {
          key: "sessions",
          label: "Default session count",
          type: "number",
          required: true,
        },
        {
          key: "individualPrice",
          label: "Individual price (INR)",
          type: "number",
          required: true,
        },
        {
          key: "packagePrice",
          label: "Default package price (INR)",
          type: "number",
          required: true,
        },
        {
          key: "machineIds",
          label: "Compatible machines (clinic configuration)",
          type: "checks",
          options: s.records["Machines & Equipment"].map((m) => ({
            value: m.id,
            label: m.name,
          })),
        },
        {
          key: "documentation",
          label: "Required documentation",
          type: "textarea",
          required: true,
        },
        {
          key: "consent",
          label: "Consent requirements",
          type: "textarea",
          required: true,
        },
      ];
      values = {
        name: t.name,
        status: t.status,
        category: d.category,
        sessions: String(d.sessions),
        individualPrice: String(d.individualPrice),
        packagePrice: String(d.packagePrice),
        documentation: d.documentation,
        consent: d.consent,
        machineIds: d.machineIds.join("|"),
      };
    }
    if (section === "Treatment Intervals") {
      fields = [
        {
          key: "intervalDays",
          label: "Default interval (days)",
          type: "number",
          required: true,
        },
      ];
      values = { intervalDays: String(d.intervalDays) };
    }
    if (section === "Appointment Durations") {
      fields = [
        {
          key: "duration",
          label: "Treatment appointment duration (minutes)",
          type: "number",
          required: true,
        },
        {
          key: "defaultAppointmentMinutes",
          label: "Fallback duration for new appointments (minutes)",
          type: "number",
          required: true,
        },
      ];
      values = {
        duration: String(d.duration),
        defaultAppointmentMinutes: String(a.defaultAppointmentMinutes),
      };
    }
    note =
      "Configurable clinic defaults, not universal clinical protocols. Existing approved courses and booked visits retain their own configuration.";
  }
  if (section === "Machines") {
    const m = r("Machines & Equipment");
    if (m?.machine) {
      const d = m.machine;
      fields = [
        { key: "name", label: "Machine name", required: true },
        { key: "brand", label: "Brand", required: true },
        { key: "model", label: "Model", required: true },
        { key: "serial", label: "Serial number", required: true },
        { key: "category", label: "Category", required: true },
        {
          key: "roomId",
          label: "Home room",
          type: "select",
          options: s.records["Rooms & Resources"].map((r) => ({
            value: r.id,
            label: r.room!.code,
          })),
        },
        { key: "lastService", label: "Last service", type: "date" },
        { key: "nextMaintenance", label: "Next maintenance", type: "date" },
        {
          key: "planningMinutes",
          label: "Planning capacity (minutes per day)",
          type: "number",
          required: true,
        },
      ];
      values = {
        name: m.name,
        brand: d.brand,
        model: d.model,
        serial: d.serial,
        category: d.category,
        roomId: d.roomId,
        lastService: d.lastService || "",
        nextMaintenance: d.nextMaintenance || "",
        planningMinutes: String(d.planningMinutes),
      };
      note =
        "Manual equipment metadata and planning capacity. Change operational availability through Equipment/Maintenance so service-clearance checks apply. No live telemetry.";
    }
  }
  if (section === "Rooms") {
    const room = r("Rooms & Resources");
    if (room?.room) {
      fields = [
        { key: "name", label: "Room name", required: true },
        { key: "code", label: "Room code", required: true },
        {
          key: "capacity",
          label: "Seating capacity",
          type: "number",
          required: true,
        },
        {
          key: "status",
          label: "Availability",
          type: "select",
          options: options(["Available", "Unavailable"]),
        },
        { key: "notes", label: "Room notes", type: "textarea" },
      ];
      values = {
        name: room.name,
        code: room.room.code,
        capacity: String(room.room.capacity),
        status: room.status,
        notes: room.room.notes,
      };
      note =
        "Rooms remain exclusive appointment resources regardless of seating capacity. Unavailable rooms are rejected by booking validation.";
    }
  }
  if (section === "Package Validity") {
    const p = r("Package Catalogue");
    if (p?.packageConfig) {
      fields = [
        {
          key: "validityDays",
          label: "Package validity (days)",
          type: "number",
          required: true,
        },
        {
          key: "defaultPackageDays",
          label: "Default validity for newly created packages (days)",
          type: "number",
          required: true,
        },
      ];
      values = {
        validityDays: String(p.packageConfig.validityDays),
        defaultPackageDays: String(a.defaultPackageDays),
      };
      note =
        "Applies to catalogue configuration and new purchases only. Existing course expiry dates and purchased sessions are retained.";
    }
  }
  if (section === "Reminder Templates" || section === "Consent Templates") {
    const reminders = section === "Reminder Templates",
      templates = reminders ? a.reminderTemplates : a.consentTemplates,
      t = templates.find((t) => t.id === id),
      defaultId = reminders ? a.defaultReminderId : a.defaultConsentId;
    fields = [
      { key: "name", label: "Template name", required: true },
      {
        key: "body",
        label: reminders ? "Reminder draft text" : "Consent template text",
        type: "textarea",
        required: true,
      },
      { key: "active", label: "Active template", type: "checkbox" },
      {
        key: "makeDefault",
        label: "Use as default template",
        type: "checkbox",
      },
    ];
    values = {
      name: t?.name || "",
      body: t?.body || "",
      active: t?.active === false ? "no" : "yes",
      makeDefault: defaultId === id ? "yes" : "no",
    };
    note = reminders
      ? "Supported placeholders: {firstName}, {clinicName}, {date}, {datePhrase}. Routine reminders should avoid sensitive details. This creates drafts, never sends messages."
      : "Templates support clinician documentation only. Saving a template never records a patient signature or consent. Newly recorded session consent keeps a template snapshot.";
  }
  if (section === "Currency") {
    fields = [
      {
        key: "locale",
        label: "Number grouping",
        type: "select",
        options: [
          { value: "en-IN", label: "Indian grouping (1,00,000)" },
          { value: "en-GB", label: "International grouping (100,000)" },
        ],
      },
      {
        key: "display",
        label: "Currency display",
        type: "select",
        options: [
          { value: "symbol", label: "Rupee symbol (₹)" },
          { value: "code", label: "INR currency code" },
        ],
      },
      {
        key: "minimumDigits",
        label: "Minimum decimal places",
        type: "number",
        required: true,
      },
      {
        key: "maximumDigits",
        label: "Maximum decimal places",
        type: "number",
        required: true,
      },
    ];
    values = {
      locale: a.currency.locale,
      display: a.currency.display,
      minimumDigits: String(a.currency.minimumDigits),
      maximumDigits: String(a.currency.maximumDigits),
    };
    note =
      "The shared ledger remains denominated in INR; no currency conversion is performed. Presentation changes apply to shared INR amounts.";
  }
  if (section === "Notification Preferences") {
    fields = [
      ...notificationCategories.map((c) => ({
        key: c,
        label: c,
        type: "checkbox" as const,
      })),
      {
        key: "appointmentDays",
        label: "Upcoming appointment horizon (days)",
        type: "number",
        required: true,
      },
      {
        key: "expiryDays",
        label: "Package expiry horizon (days)",
        type: "number",
        required: true,
      },
      {
        key: "maintenanceDays",
        label: "Maintenance reminder horizon (days)",
        type: "number",
        required: true,
      },
    ];
    values = {
      ...Object.fromEntries(
        notificationCategories.map((c) => [
          c,
          a.notifications.enabled[c] ? "yes" : "no",
        ]),
      ),
      appointmentDays: String(a.notifications.appointmentDays),
      expiryDays: String(a.notifications.expiryDays),
      maintenanceDays: String(a.notifications.maintenanceDays),
    };
    note =
      "Applies to in-app demo alerts only. No push, email, WhatsApp or external notification is sent.";
  }
  return { fields, values, note };
}
const integer = (v: string, min: number, max: number, label: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return n;
};
export function saveSettingsSection(
  s: ClinicState,
  section: SettingSection,
  id: string,
  v: Record<string, string>,
  confirmed = false,
) {
  const a = s.adminSettings || defaultAdminSettings(),
    find = (key: string) => s.records[key].find((r) => r.id === id);
  let next = s;
  if (section === "Clinic Profile") {
    if (
      v.name.trim().length < 2 ||
      !v.address.trim() ||
      !validPhone(v.phone) ||
      !v.email.trim() ||
      !validEmail(v.email) ||
      !["Asia/Kolkata", "Asia/Calcutta"].includes(v.timezone)
    )
      throw new Error(
        "Enter clinic name/address, a valid Indian mobile/email and Asia/Kolkata (or Asia/Calcutta) timezone.",
      );
    if (v.website && !/^https?:\/\/[^\s]+$/.test(v.website))
      throw new Error("Website must use an http or https URL, or be blank.");
    next = {
      ...s,
      clinicName: v.name.trim(),
      adminSettings: {
        ...a,
        profile: {
          address: v.address.trim(),
          phone: v.phone,
          email: v.email,
          website: v.website,
          timezone: "Asia/Kolkata",
        },
      },
    };
  }
  if (
    ["Treatments", "Treatment Intervals", "Appointment Durations"].includes(
      section,
    )
  ) {
    const r = find("Treatment Catalogue");
    if (!r?.treatment) throw new Error("Choose a treatment.");
    const d = { ...r.treatment };
    if (section === "Treatments") {
      d.category = v.category;
      d.sessions = integer(v.sessions, 1, 100, "Default sessions");
      d.individualPrice = Number(v.individualPrice);
      d.packagePrice = Number(v.packagePrice);
      d.documentation = v.documentation;
      d.consent = v.consent;
      d.machineIds = v.machineIds ? v.machineIds.split("|") : [];
      if (
        d.machineIds.some(
          (id) => !s.records["Machines & Equipment"].some((m) => m.id === id),
        )
      )
        throw new Error("Choose registered machines.");
    }
    if (section === "Treatment Intervals")
      d.intervalDays = integer(v.intervalDays, 1, 3650, "Interval");
    if (section === "Appointment Durations")
      d.duration = integer(v.duration, 5, 480, "Appointment duration");
    next = saveTreatment(s, {
      ...r,
      name: section === "Treatments" ? v.name : r.name,
      status: section === "Treatments" ? v.status : r.status,
      treatment: d,
    });
    if (section === "Appointment Durations")
      next = {
        ...next,
        adminSettings: {
          ...a,
          defaultAppointmentMinutes: integer(
            v.defaultAppointmentMinutes,
            5,
            480,
            "Fallback duration",
          ),
        },
      };
  }
  if (section === "Machines") {
    const r = find("Machines & Equipment");
    if (!r?.machine) throw new Error("Choose a machine.");
    const treatmentIds = s.records["Treatment Catalogue"]
      .filter((t) => t.treatment?.machineIds.includes(id))
      .map((t) => t.id);
    next = saveMachine(
      s,
      {
        ...r,
        name: v.name,
        machine: {
          ...r.machine,
          brand: v.brand,
          model: v.model,
          serial: v.serial,
          category: v.category,
          roomId: v.roomId,
          lastService: v.lastService || undefined,
          nextMaintenance: v.nextMaintenance || undefined,
          planningMinutes: Number(v.planningMinutes),
        },
      },
      treatmentIds,
      "Clinic Owner",
    );
  }
  if (section === "Rooms") {
    const r = find("Rooms & Resources");
    if (!r?.room) throw new Error("Choose a room.");
    if (r.status !== v.status && !confirmed)
      throw new Error("Confirm the room availability change.");
    next = saveRoom(
      s,
      {
        ...r,
        name: v.name,
        status: v.status,
        room: {
          ...r.room,
          code: v.code,
          capacity: Number(v.capacity),
          notes: v.notes,
        },
      },
      "Clinic Owner",
      true,
    );
  }
  if (section === "Package Validity") {
    const r = find("Package Catalogue");
    if (!r?.packageConfig) throw new Error("Choose a package.");
    next = savePackage(s, {
      ...r,
      packageConfig: {
        ...r.packageConfig,
        validityDays: integer(v.validityDays, 1, 3650, "Package validity"),
      },
    });
    next = {
      ...next,
      adminSettings: {
        ...a,
        defaultPackageDays: integer(
          v.defaultPackageDays,
          1,
          3650,
          "New package validity",
        ),
      },
    };
  }
  if (section === "Reminder Templates" || section === "Consent Templates") {
    const reminders = section === "Reminder Templates",
      key = reminders ? "reminderTemplates" : "consentTemplates",
      defaultKey = reminders ? "defaultReminderId" : "defaultConsentId";
    if (!v.name.trim() || !v.body.trim() || v.body.length > 4000)
      throw new Error(
        "Enter a template name and text, up to 4,000 characters.",
      );
    if (
      reminders &&
      [...v.body.matchAll(/\{([^}]+)\}/g)].some(
        (m) =>
          !["firstName", "clinicName", "date", "datePhrase"].includes(m[1]),
      )
    )
      throw new Error("Use only the supported reminder placeholders.");
    if (
      a[key].some(
        (t) =>
          t.id !== id && t.name.toLowerCase() === v.name.trim().toLowerCase(),
      )
    )
      throw new Error("A template with this name already exists.");
    if ((v.makeDefault === "yes" || a[defaultKey] === id) && v.active !== "yes")
      throw new Error(
        "The default template must remain active. Choose a different active default first.",
      );
    const template: MessageTemplate = {
      id,
      name: v.name.trim(),
      body: v.body.trim(),
      active: v.active === "yes",
    };
    const templates = a[key].some((t) => t.id === id)
      ? a[key].map((t) => (t.id === id ? template : t))
      : [...a[key], template];
    next = {
      ...s,
      adminSettings: {
        ...a,
        [key]: templates,
        [defaultKey]: v.makeDefault === "yes" ? id : a[defaultKey],
      },
    };
  }
  if (section === "Currency") {
    const min = integer(v.minimumDigits, 0, 2, "Minimum decimals"),
      max = integer(v.maximumDigits, 0, 2, "Maximum decimals");
    if (
      min > max ||
      !["en-IN", "en-GB"].includes(v.locale) ||
      !["symbol", "code"].includes(v.display)
    )
      throw new Error(
        "Choose supported grouping/display and minimum decimals no greater than maximum.",
      );
    next = {
      ...s,
      adminSettings: {
        ...a,
        currency: {
          code: "INR",
          locale: v.locale as "en-IN" | "en-GB",
          display: v.display as "symbol" | "code",
          minimumDigits: min,
          maximumDigits: max,
        },
      },
    };
  }
  if (section === "Notification Preferences")
    next = {
      ...s,
      adminSettings: {
        ...a,
        notifications: {
          enabled: Object.fromEntries(
            notificationCategories.map((c) => [c, v[c] === "yes"]),
          ) as typeof a.notifications.enabled,
          appointmentDays: integer(
            v.appointmentDays,
            0,
            30,
            "Appointment horizon",
          ),
          expiryDays: integer(v.expiryDays, 1, 365, "Expiry horizon"),
          maintenanceDays: integer(
            v.maintenanceDays,
            0,
            90,
            "Maintenance horizon",
          ),
        },
      },
    };
  return addActivity(next, `${section}: local clinic settings saved.`);
}
export function saveSchema(
  s: ClinicState,
  id: string,
  config: DeviceDocumentation,
  confirmed: boolean,
) {
  const old = s.records["Machines & Equipment"].find((r) => r.id === id);
  if (!old) throw new Error("Choose a machine.");
  if (!confirmed)
    throw new Error(
      "Confirm that changed documentation fields require renewed clinician review.",
    );
  if (config.fields.length)
    return addActivity(
      configureDevice(s, id, config, "Clinic Owner"),
      "Session documentation schema saved. No parameter values generated.",
    );
  return addActivity(
    {
      ...s,
      records: {
        ...s.records,
        "Machines & Equipment": s.records["Machines & Equipment"].map((m) =>
          m.id === id
            ? {
                ...m,
                deviceDocumentation: {
                  ...config,
                  source: "Not configured",
                  version: (old.deviceDocumentation?.version || 0) + 1,
                },
              }
            : m,
        ),
      },
    },
    "Device documentation schema cleared; clinician configuration is required before a new session.",
  );
}
export function saveTaxes(s: ClinicState, taxes: TaxConfig[]) {
  return saveTaxConfiguration(s, taxes);
}
