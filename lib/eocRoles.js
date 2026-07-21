export const TEAM_ROLE_OPTIONS = [
    { value: "EOC_COMMANDER", label: "COMMANDER - ผู้บัญชาการเหตุการณ์และรองผู้บัญชาการเหตุการณ์", roleDisplayName: "ทีม COMMANDER", color: "bg-orange-100 text-orange-800" },
    { value: "SAT", label: "SAT - กลุ่มภารกิจตระหนักรู้สถานการณ์", color: "bg-blue-100 text-blue-800" },
    { value: "PLANNING", label: "PLANNING - กลุ่มภารกิจการวางแผน", color: "bg-indigo-100 text-indigo-800" },
    { value: "SCIENTIFIC", label: "SCIENTIFIC - กลุ่มภารกิจวิชาการ", color: "bg-violet-100 text-violet-800" },
    { value: "JIT", label: "JIT - กลุ่มภารกิจปฏิบัติการสอบสวนควบคุมโรค", color: "bg-orange-100 text-orange-800" },
    { value: "ACTIVE_SURV", label: "ACTIVE_SURV - กลุ่มภารกิจการเฝ้าระวังเชิงรุก", color: "bg-cyan-100 text-cyan-800" },
    { value: "CASE_MGMT", label: "CASE_MGMT - กลุ่มภารกิจการจัดการและดูแลรักษาผู้ป่วย", color: "bg-emerald-100 text-emerald-800" },
    { value: "LAB", label: "LAB - กลุ่มภารกิจห้องปฏิบัติการด้านสาธารณสุข", color: "bg-purple-100 text-purple-800" },
    { value: "RISKCOM", label: "RISKCOM - กลุ่มภารกิจสื่อสารความเสี่ยง", color: "bg-amber-100 text-amber-800" },
    { value: "VACCINE", label: "VACCINE - กลุ่มภารกิจบริหารจัดการและบริการวัคซีน", color: "bg-green-100 text-green-800" },
    { value: "MCATT", label: "MCATT - กลุ่มภารกิจช่วยเหลือเยียวยาจิตใจ", color: "bg-teal-100 text-teal-800" },
    { value: "POE", label: "POE - กลุ่มภารกิจด่านควบคุมโรคระหว่างประเทศ", color: "bg-sky-100 text-sky-800" },
    { value: "QUARANTINE", label: "QUARANTINE - กลุ่มภารกิจปฏิบัติการกักกันโรค", color: "bg-slate-100 text-slate-800" },
    { value: "MERT", label: "MERT - กลุ่มภารกิจปฏิบัติการฉุกเฉินทางการแพทย์", color: "bg-rose-100 text-rose-800" },
    { value: "SeRHT", label: "SeRHT - กลุ่มภารกิจปฏิบัติการด้านอนามัยสิ่งแวดล้อม", color: "bg-teal-100 text-teal-800" },
    { value: "LOGISTICS", label: "LOGISTICS - กลุ่มภารกิจสำรองวัสดุและส่งกำลังบำรุง", color: "bg-lime-100 text-lime-800" },
    { value: "LEGAL", label: "LEGAL - กลุ่มภารกิจกฎหมาย", color: "bg-zinc-100 text-zinc-800" },
    { value: "FINANCE", label: "FINANCE - กลุ่มภารกิจการเงินและงบประมาณ", color: "bg-yellow-100 text-yellow-800" },
    { value: "STAFFING", label: "STAFFING - กลุ่มภารกิจจัดสรรกำลังคน", color: "bg-fuchsia-100 text-fuchsia-800" },
    { value: "EOC_ADMIN", label: "ADMIN - กลุ่มภารกิจด้านบริหารและธุรการ", roleDisplayName: "ทีม ADMIN", color: "bg-gray-100 text-gray-800" },
    { value: "ITSUPPORT", label: "ITSUPPORT - กลุ่มภารกิจด้านเทคโนโลยีดิจิทัล", color: "bg-blue-100 text-blue-800" },
    { value: "LIAISON", label: "LIAISON - กลุ่มภารกิจประสานงานและเลขานุการ", color: "bg-stone-100 text-stone-800" },
    { value: "EOC_MGMT", label: "EOC_MGMT - กลุ่มภารกิจการจัดการศูนย์ปฏิบัติการ", color: "bg-red-100 text-red-800" }
];

export const TEAM_ROLE_CODES = TEAM_ROLE_OPTIONS.map((role) => role.value);
export const SYSTEM_ROLE_CODES = ["admin", "commander", "staff", ...TEAM_ROLE_CODES];
