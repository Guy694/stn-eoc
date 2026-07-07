const EOC_TYPE_LABELS = {
    flood: 'น้ำท่วม',
    drought: 'ภัยแล้ง',
    tsunami: 'สึนามิ',
    earthquake: 'แผ่นดินไหว',
    disease: 'โรคระบาด',
    accident: 'อุบัติเหตุ',
    'festival-accidents': 'อุบัติเหตุช่วงเทศกาล'
};

export function getEocTypeLabel(eocType) {
    return EOC_TYPE_LABELS[eocType] || eocType || 'EOC';
}

export function formatEocDisplayName(eocOrType) {
    const eoc = typeof eocOrType === 'string' ? { eoc_type: eocOrType } : (eocOrType || {});
    const eocType = eoc.eoc_type || eoc.type;
    const baseName = eoc.name_th || getEocTypeLabel(eocType);
    const diseaseName = String(eoc.disease_name || eoc.diseaseName || '').trim();

    if (eocType !== 'disease' || !diseaseName) return baseName;
    if (diseaseName.startsWith(baseName)) return diseaseName;
    if (baseName.includes(diseaseName)) return baseName;
    return `${baseName} ${diseaseName}`;
}
