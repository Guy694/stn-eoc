/**
 * @typedef {"flood"|"dengue"|"storm"|"drought"|"epidemic"|"fire"|"festival-accidents"} EocType
 */

export const eocTypeRegistry = Object.freeze({
  flood: { code: "flood", legacyCodes: [], name: "อุทกภัย", enabled: true },
  dengue: { code: "dengue", legacyCodes: ["disease"], name: "ไข้เลือดออก", enabled: true },
  storm: { code: "storm", legacyCodes: [], name: "วาตภัย", enabled: true },
  drought: { code: "drought", legacyCodes: [], name: "ภัยแล้ง", enabled: true },
  epidemic: { code: "epidemic", legacyCodes: [], name: "โรคระบาด", enabled: true },
  fire: { code: "fire", legacyCodes: [], name: "อัคคีภัย", enabled: true },
  "festival-accidents": {
    code: "festival-accidents",
    legacyCodes: ["accident"],
    name: "อุบัติเหตุช่วงเทศกาล",
    enabled: true,
  },
});

export const EOC_TYPES = Object.freeze(Object.keys(eocTypeRegistry));

const eocTypeAliases = Object.freeze(
  Object.values(eocTypeRegistry).reduce((aliases, item) => {
    aliases[item.code] = item.code;
    item.legacyCodes.forEach((legacyCode) => { aliases[legacyCode] = item.code; });
    return aliases;
  }, {})
);

export function normalizeEocType(value) {
  if (typeof value !== "string") return null;
  return eocTypeAliases[value.trim().toLowerCase()] || null;
}

export function isValidEocType(value) {
  const code = normalizeEocType(value);
  return Boolean(code && eocTypeRegistry[code]?.enabled);
}

export function getEocType(value) {
  const code = normalizeEocType(value);
  return code ? eocTypeRegistry[code] : null;
}
