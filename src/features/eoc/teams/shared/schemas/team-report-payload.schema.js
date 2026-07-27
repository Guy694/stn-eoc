import { getTeamReportDefinition } from "../../../registries/team-report-definition.registry";
import { normalizeTeamCode } from "../../../registries/team.registry";

const MAX_FIELD_LENGTH = 10000;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function fieldError(field, value) {
  if (isBlank(value)) return null;
  if (String(value).length > MAX_FIELD_LENGTH) return `${field.label} มีข้อมูลยาวเกินกำหนด`;
  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) return `${field.label} ต้องเป็นตัวเลข`;
    if (number < (field.min ?? 0)) return `${field.label} ต้องไม่น้อยกว่า ${field.min ?? 0}`;
    if (field.max !== undefined && number > field.max) return `${field.label} ต้องไม่เกิน ${field.max}`;
  }
  if (field.type === "select" && !field.options.includes(String(value))) {
    return `${field.label} มีค่าไม่ถูกต้อง`;
  }
  if (field.type === "datetime-local" && Number.isNaN(new Date(value).getTime())) {
    return `${field.label} ต้องเป็นวันเวลาที่ถูกต้อง`;
  }
  return null;
}

export function validateTeamReportPayload(teamCodeValue, payload, { requireComplete = false } = {}) {
  const teamCode = normalizeTeamCode(teamCodeValue);
  const definition = teamCode ? getTeamReportDefinition(teamCode) : null;
  if (!definition || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, message: "รูปแบบข้อมูลรายงานไม่ถูกต้อง", fieldErrors: {} };
  }

  const knownFields = new Set(definition.fields.map((item) => item.name));
  const unknownField = Object.keys(payload).find((name) => !knownFields.has(name));
  if (unknownField) {
    return { success: false, message: `พบช่องข้อมูลที่ระบบไม่รองรับ: ${unknownField}`, fieldErrors: { [unknownField]: "ไม่รองรับช่องข้อมูลนี้" } };
  }

  const requiredNames = new Set(requireComplete
    ? definition.submitRequiredFields
    : definition.fields.filter((item) => item.required).map((item) => item.name));
  const fieldErrors = {};
  for (const field of definition.fields) {
    const value = payload[field.name];
    if (requiredNames.has(field.name) && isBlank(value)) fieldErrors[field.name] = `กรุณากรอก ${field.label}`;
    else {
      const error = fieldError(field, value);
      if (error) fieldErrors[field.name] = error;
    }
  }

  const firstError = Object.values(fieldErrors)[0];
  const completed = definition.submitRequiredFields.filter((name) => !isBlank(payload[name])).length;
  const total = definition.submitRequiredFields.length;
  return {
    success: !firstError,
    message: firstError || null,
    fieldErrors,
    completeness: {
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 100,
      missing: definition.submitRequiredFields.filter((name) => isBlank(payload[name])),
    },
  };
}
