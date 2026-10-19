"use client";
import { useEOC } from "@/context/EOCContext";
import { useEffect, useState } from "react";
import { AlertTriangle, Ambulance, Biohazard, CalendarDays, CircleCheck, ClipboardList, Home, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Button, ReadOnlyNotice, inputClass } from "@/components/admin/crud";
import { MetricCard, MetricGrid } from "@/components/common/MetricCards";
import { EmptyPanel, PageHero, Panel, heroInputClass, heroPrimaryButtonClass } from "@/components/common/ThemePanels";
import { formatNumber } from "@/lib/adminApi";
import { showDeleteConfirm, showError, showSuccess, showWarning } from '@/lib/sweetAlert';
import { FLOOD_DISEASE_CHOICES, buildDiseaseChoices } from '@/lib/diseaseNames';

// จำนวนผู้ป่วยของรายงานหนึ่งรายการ (มือถืออยู่ใต้ชื่อโรค · จอใหญ่อยู่ด้านขวา)
function CaseCounts({ report, className = "" }) {
    return (
        <dl className={`grid-cols-3 gap-1.5 text-center text-xs ${className}`}>
            <div className="rounded-lg bg-red-50 px-2.5 py-1"><dt className="text-red-700">ป่วยใหม่</dt><dd className="text-base font-bold tabular-nums text-red-700">{report.new_cases}</dd></div>
            <div className="rounded-lg bg-emerald-50 px-2.5 py-1"><dt className="text-emerald-700">หาย</dt><dd className="text-base font-bold tabular-nums text-emerald-700">{report.recovered}</dd></div>
            <div className="rounded-lg bg-amber-50 px-2.5 py-1"><dt className="text-amber-800">ส่ง รพ.</dt><dd className="text-base font-bold tabular-nums text-amber-800">{report.hospitalized}</dd></div>
        </dl>
    );
}

export default function ShelterDiseaseReports() {
    const { eocStatus } = useEOC();
    const [sessionId, setSessionId] = useState(null);
    const [activatedShelters, setActivatedShelters] = useState([]);
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState({});
    const [commonDiseases, setCommonDiseases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showForm, setShowForm] = useState(false);
    // สิทธิ์จากเซิร์ฟเวอร์: CASE MGMT / SAT บันทึกได้ ทีมอื่นดูอย่างเดียว
    const [permissions, setPermissions] = useState({ can_edit: false, read_only_message: null });
    const canEdit = permissions.can_edit === true;
    const [formData, setFormData] = useState({
        shelter_id: '',
        disease_type: '',
        new_cases: 0,
        recovered: 0,
        hospitalized: 0,
        deaths: 0,
        severity: 'low',
        symptoms: '',
        treatment_given: '',
        notes: ''
    });

    const floodEOC = eocStatus?.flood;
    const isActive = floodEOC?.is_active;

    // ดึง session ID
    useEffect(() => {
        const fetchActiveSession = async () => {
            try {
                const response = await fetch('/stn-eoc/api/eoc/flood/area-status');
                const result = await response.json();
                if (result.hasActiveSession && result.activeSession) {
                    setSessionId(result.activeSession.id);
                }
            } catch (error) {
                console.error('Error fetching active session:', error);
            }
        };
        fetchActiveSession();
    }, []);

    // ดึงรายการโรคจาก common_diseases table
    useEffect(() => {
        const fetchDiseases = async () => {
            try {
                const response = await fetch('/stn-eoc/api/common/diseases');
                const result = await response.json();
                if (result.success && result.data) {
                    // รายการเดียวกับฟอร์มในชุมชน: โรคหลังน้ำท่วมขึ้นก่อน ชื่อมาตรฐานไม่ซ้ำ "อื่นๆ" ท้ายสุด
                    setCommonDiseases(buildDiseaseChoices(result.data, FLOOD_DISEASE_CHOICES).map((name) => ({ name })));
                }
            } catch (error) {
                console.error('Error fetching diseases:', error);
                // ใช้รายการ default
                setCommonDiseases(buildDiseaseChoices([], FLOOD_DISEASE_CHOICES).map((name) => ({ name })));
            }
        };
        fetchDiseases();
    }, []);

    // ดึงศูนย์พักพิงที่ activate และรายงานโรค
    useEffect(() => {
        if (!sessionId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // ดึงศูนย์พักพิงที่ activate
                const sheltersRes = await fetch(`/stn-eoc/api/eoc/shelter-activations?session_id=${sessionId}&eoc_type=flood`);
                const sheltersData = await sheltersRes.json();
                if (sheltersData.success) {
                    setActivatedShelters(sheltersData.data?.filter(s => s.is_activated_for_session) || []);
                }

                // ดึงรายงานโรค
                const reportsRes = await fetch(`/stn-eoc/api/eoc/shelter-disease-reports?session_id=${sessionId}&report_date=${selectedDate}`);
                const reportsData = await reportsRes.json();
                if (reportsData.success) {
                    setReports(reportsData.data || []);
                    setStats(reportsData.stats || {});
                    if (reportsData.permissions) setPermissions(reportsData.permissions);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [sessionId, selectedDate]);

    // บันทึกรายงาน
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.shelter_id || !formData.disease_type) {
            showWarning('กรุณาเลือกศูนย์พักพิงและประเภทโรค');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch('/stn-eoc/api/eoc/shelter-disease-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    session_id: sessionId,
                    report_date: selectedDate
                })
            });

            const result = await response.json();
            if (result.success) {
                // Refresh data
                const reportsRes = await fetch(`/stn-eoc/api/eoc/shelter-disease-reports?session_id=${sessionId}&report_date=${selectedDate}`);
                const reportsData = await reportsRes.json();
                if (reportsData.success) {
                    setReports(reportsData.data || []);
                    setStats(reportsData.stats || {});
                }
                setShowForm(false);
                setFormData({
                    shelter_id: '',
                    disease_type: '',
                    new_cases: 0,
                    recovered: 0,
                    hospitalized: 0,
                    deaths: 0,
                    severity: 'low',
                    symptoms: '',
                    treatment_given: '',
                    notes: ''
                });
                showSuccess('บันทึกรายงานโรคสำเร็จ');
            } else {
                showError(result.message || 'เกิดข้อผิดพลาดในการบันทึก');
            }
        } catch (error) {
            console.error('Error saving report:', error);
            showError(error.message || 'เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setSaving(false);
        }
    };

    // ลบรายงาน
    const handleDelete = async (id) => {
        if (!await showDeleteConfirm('ต้องการลบรายงานนี้หรือไม่?')) return;

        try {
            const response = await fetch(`/stn-eoc/api/eoc/shelter-disease-reports?id=${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) {
                setReports(reports.filter(r => r.id !== id));
                showSuccess('ลบรายงานสำเร็จ');
            } else {
                showError(result.message || 'ไม่สามารถลบรายงานได้');
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            showError(error.message || 'เกิดข้อผิดพลาดในการลบรายงาน');
        }
    };

    const SEVERITY = {
        low: { label: 'ต่ำ', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
        medium: { label: 'ปานกลาง', className: 'bg-amber-50 text-amber-800 ring-amber-100' },
        high: { label: 'สูง', className: 'bg-orange-50 text-orange-700 ring-orange-100' },
        critical: { label: 'วิกฤต', className: 'bg-red-50 text-red-700 ring-red-100' }
    };
    const setNumber = (key) => (e) => setFormData({ ...formData, [key]: parseInt(e.target.value, 10) || 0 });
    const label = "mb-1 block text-sm font-medium text-slate-700";
    const dateText = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('th-TH', { dateStyle: 'long' });

    if (!isActive) {
        return (
            <EmptyPanel
                icon={AlertTriangle}
                tone="amber"
                title="ยังไม่มีเหตุการณ์อุทกภัยที่เปิดอยู่"
                text="เปิด EOC อุทกภัยก่อน จึงจะบันทึกรายงานโรคในศูนย์พักพิงได้"
            />
        );
    }

    return (
        <div className="space-y-4 font-[family-name:var(--font-kanit)]">
            <PageHero
                icon={Biohazard}
                eyebrow="โรคและสุขภาพช่วงน้ำท่วม"
                title="รายงานโรคในศูนย์พักพิง"
                subtitle="บันทึกผู้ป่วยรายวันของศูนย์พักพิงชั่วคราวที่เปิดอยู่"
                meta={`ศูนย์พักพิงที่เปิดอยู่ ${activatedShelters.length} แห่ง · ข้อมูลวันที่ ${dateText}`}
                actions={(
                    <>
                        <label className="sr-only" htmlFor="shelter-report-date">วันที่รายงาน</label>
                        <input
                            id="shelter-report-date"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className={heroInputClass}
                        />
                        {canEdit ? (
                            <button type="button" onClick={() => setShowForm(!showForm)} className={heroPrimaryButtonClass} aria-expanded={showForm}>
                                {showForm ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                                {showForm ? 'ปิดแบบฟอร์ม' : 'เพิ่มรายงาน'}
                            </button>
                        ) : null}
                    </>
                )}
            />

            {!canEdit && permissions.read_only_message ? <ReadOnlyNotice message={permissions.read_only_message} /> : null}

            <MetricGrid>
                <MetricCard icon={ClipboardList} label="รายงานทั้งหมด" value={formatNumber(stats.total_reports || 0)} unit="รายการ" tone="blue" />
                <MetricCard icon={UserPlus} label="ผู้ป่วยใหม่" value={formatNumber(stats.total_new_cases || 0)} unit="ราย" tone={stats.total_new_cases > 0 ? "red" : "muted"} />
                <MetricCard icon={CircleCheck} label="หายแล้ว" value={formatNumber(stats.total_recovered || 0)} unit="ราย" tone="green" />
                <MetricCard icon={Ambulance} label="ส่งต่อ รพ." value={formatNumber(stats.total_hospitalized || 0)} unit="ราย" tone={stats.total_hospitalized > 0 ? "amber" : "muted"} />
            </MetricGrid>

            {showForm && canEdit && (
                <Panel icon={Plus} title="เพิ่มรายงานโรค" subtitle={`บันทึกของวันที่ ${dateText}`} bodyClassName="p-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className={label} htmlFor="shelter-id">ศูนย์พักพิง <span className="text-red-600">*</span></label>
                                <select id="shelter-id" value={formData.shelter_id} onChange={(e) => setFormData({ ...formData, shelter_id: e.target.value })} className={inputClass} required>
                                    <option value="">เลือกศูนย์พักพิง</option>
                                    {activatedShelters.map(s => (
                                        <option key={s.id} value={s.id}>{s.sheltername} (ต.{s.tambon})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={label} htmlFor="shelter-disease">ประเภทโรค <span className="text-red-600">*</span></label>
                                <select id="shelter-disease" value={formData.disease_type} onChange={(e) => setFormData({ ...formData, disease_type: e.target.value })} className={inputClass} required>
                                    <option value="">เลือกประเภทโรค</option>
                                    {commonDiseases.map((d, i) => (
                                        <option key={i} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div>
                                <label className={label} htmlFor="shelter-new">ผู้ป่วยใหม่</label>
                                <input id="shelter-new" type="number" min="0" value={formData.new_cases} onChange={setNumber('new_cases')} className={inputClass} />
                            </div>
                            <div>
                                <label className={label} htmlFor="shelter-recovered">หายแล้ว</label>
                                <input id="shelter-recovered" type="number" min="0" value={formData.recovered} onChange={setNumber('recovered')} className={inputClass} />
                            </div>
                            <div>
                                <label className={label} htmlFor="shelter-hospitalized">ส่งต่อ รพ.</label>
                                <input id="shelter-hospitalized" type="number" min="0" value={formData.hospitalized} onChange={setNumber('hospitalized')} className={inputClass} />
                            </div>
                            <div>
                                <label className={label} htmlFor="shelter-severity">ระดับความรุนแรง</label>
                                <select id="shelter-severity" value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value })} className={inputClass}>
                                    {Object.entries(SEVERITY).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={label} htmlFor="shelter-notes">หมายเหตุ</label>
                            <textarea id="shelter-notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={inputClass} rows="2" />
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <Button variant="secondary" onClick={() => setShowForm(false)}>ยกเลิก</Button>
                            <Button type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
                        </div>
                    </form>
                </Panel>
            )}

            <Panel icon={CalendarDays} title={`รายงานวันที่ ${dateText}`} subtitle={`${reports.length} รายการ`}>
                {loading ? (
                    <div className="space-y-2 p-4" aria-busy="true">
                        {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />)}
                    </div>
                ) : reports.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-10 text-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-200"><ClipboardList className="h-6 w-6" aria-hidden="true" /></span>
                        <p className="mt-3 font-semibold text-slate-900">ยังไม่มีรายงานโรคของวันนี้</p>
                        {canEdit ? <p className="mt-1 text-sm text-slate-500">กด “เพิ่มรายงาน” ด้านบนเพื่อบันทึกผู้ป่วยในศูนย์พักพิง</p> : null}
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {reports.map((report) => {
                            const severity = SEVERITY[report.severity] || SEVERITY.low;
                            return (
                                <li key={report.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/70">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100"><Biohazard className="h-5 w-5" aria-hidden="true" /></span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="font-semibold text-slate-900">{report.disease_type}</h4>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${severity.className}`}>ความรุนแรง{severity.label}</span>
                                        </div>
                                        <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500"><Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{report.sheltername}</p>
                                        {report.notes ? <p className="mt-1 text-sm text-slate-600">{report.notes}</p> : null}
                                        <CaseCounts report={report} className="mt-2 grid sm:hidden" />
                                    </div>
                                    <CaseCounts report={report} className="hidden sm:grid" />
                                    {canEdit ? (
                                        <button type="button" onClick={() => handleDelete(report.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700" aria-label={`ลบรายงาน ${report.disease_type} ${report.sheltername}`}>
                                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    ) : null}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Panel>
        </div>
    );
}
