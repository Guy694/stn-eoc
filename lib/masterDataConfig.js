export const MASTER_DATA_CONFIG = {
  agencies: {
    table: "agency_contacts",
    label: "หน่วยงาน",
    searchFields: ["name", "slug", "area"],
    fields: ["slug", "name", "role_description", "area", "phone", "secondary_contact", "category", "status", "source_name", "source_updated_at", "is_hotline", "is_active"],
    required: ["slug", "name", "category", "source_name"],
    booleans: ["is_hotline", "is_active"],
    unique: ["slug"],
    order: "is_active DESC, sort_order, name",
  },
  diseases: {
    table: "common_diseases",
    label: "ประเภทโรค",
    searchFields: ["name", "description"],
    fields: ["name", "description", "source_name", "source_updated_at", "is_active"],
    required: ["name", "source_name"],
    booleans: ["is_active"],
    unique: ["name"],
    order: "is_active DESC, name",
  },
  hazards: {
    table: "disaster_types",
    label: "ประเภทภัย",
    searchFields: ["type_code", "name_th", "name_en"],
    fields: ["type_code", "name_th", "name_en", "source_name", "source_updated_at", "is_active"],
    required: ["type_code", "name_th", "source_name"],
    booleans: ["is_active"],
    unique: ["type_code"],
    order: "is_active DESC, name_th",
  },
  risks: {
    table: "area_risk_profiles",
    label: "Risk profile",
    searchFields: ["district_name", "hazard_type", "model_version"],
    fields: ["district_name", "hazard_type", "susceptibility_score", "model_version", "source_name", "source_updated_at", "is_active"],
    required: ["district_name", "hazard_type", "model_version", "source_name"],
    numbers: ["susceptibility_score"],
    booleans: ["is_active"],
    unique: ["district_name", "hazard_type", "model_version"],
    order: "is_active DESC, district_name, hazard_type",
  },
  routes: {
    table: "route_corridors",
    label: "Route corridor",
    searchFields: ["corridor_key", "corridor_name", "route_hint"],
    fields: ["corridor_key", "corridor_name", "district_names", "route_hint", "source_name", "source_updated_at", "is_active"],
    required: ["corridor_key", "corridor_name", "district_names", "source_name"],
    json: ["district_names"],
    booleans: ["is_active"],
    unique: ["corridor_key"],
    order: "is_active DESC, corridor_name",
  },
};

export function normalizeMasterData(type, body) {
  const config = MASTER_DATA_CONFIG[type];
  if (!config) return { ok: false, message: "ประเภท Master Data ไม่ถูกต้อง" };
  const values = {};
  for (const field of config.fields) {
    if (body[field] === undefined) continue;
    if (config.booleans?.includes(field)) values[field] = body[field] ? 1 : 0;
    else if (config.numbers?.includes(field)) {
      const value = Number(body[field]);
      if (!Number.isFinite(value)) return { ok: false, message: `${field} ต้องเป็นตัวเลข` };
      values[field] = value;
    } else if (config.json?.includes(field)) {
      let value = body[field];
      if (typeof value === "string") {
        try { value = JSON.parse(value); } catch { return { ok: false, message: `${field} ต้องเป็น JSON ที่ถูกต้อง` }; }
      }
      if (!Array.isArray(value) && (typeof value !== "object" || value === null)) return { ok: false, message: `${field} ต้องเป็น JSON` };
      values[field] = JSON.stringify(value);
    } else values[field] = typeof body[field] === "string" ? body[field].trim() || null : body[field];
  }
  const missing = config.required.find((field) => values[field] === undefined || values[field] === null || values[field] === "");
  if (missing) return { ok: false, message: `กรุณาระบุ ${missing}` };
  return { ok: true, config, values };
}

