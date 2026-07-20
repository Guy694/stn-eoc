"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { getMapBaseLayer, MAP_BASE_LAYERS } from "@/lib/mapBaseLayers";
import AppIcon from "@/components/icons/AppIcon";

const MapContainer = dynamic(
    () => import("react-leaflet").then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import("react-leaflet").then((mod) => mod.TileLayer),
    { ssr: false }
);
const Polygon = dynamic(
    () => import("react-leaflet").then((mod) => mod.Polygon),
    { ssr: false }
);
const Popup = dynamic(
    () => import("react-leaflet").then((mod) => mod.Popup),
    { ssr: false }
);

function normalizeKey(value) {
    return String(value || "")
        .normalize("NFC")
        .replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|ตำบล|ต\.|หมู่บ้าน|บ้าน)/u, "")
        .replace(/\s+/g, "")
        .trim()
        .toLowerCase();
}

function numberValue(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function vulnerableTotal(record) {
    return numberValue(record.elderly)
        + numberValue(record.children)
        + numberValue(record.disabled)
        + numberValue(record.bedridden)
        + numberValue(record.pregnant)
        + numberValue(record.chronic_illness);
}

function getVulnerableColor(total, maxTotal) {
    if (!total) return "#E5E7EB";
    const ratio = maxTotal > 0 ? total / maxTotal : 0;
    if (ratio >= 0.75) return "#DC2626";
    if (ratio >= 0.5) return "#F97316";
    if (ratio >= 0.25) return "#FBBF24";
    return "#22C55E";
}

function buildVulnerableLookup(records) {
    const districtMap = new Map();
    const villageMap = new Map();
    const tambonMap = new Map();

    records.forEach((record) => {
        const district = normalizeKey(record.district);
        const tambon = normalizeKey(record.tambon);
        const village = normalizeKey(record.village);
        const isDistrictAggregate = /^รวม/.test(String(record.tambon || "").trim()) || /^รวม/.test(String(record.village || "").trim());
        const total = vulnerableTotal(record);
        const current = {
            total,
            elderly: numberValue(record.elderly),
            children: numberValue(record.children),
            disabled: numberValue(record.disabled),
            bedridden: numberValue(record.bedridden),
            pregnant: numberValue(record.pregnant),
            chronic_illness: numberValue(record.chronic_illness),
            notes: record.notes,
            needs: record.needs,
            source_type: record.source_type
        };

        if (isDistrictAggregate) {
            const existing = districtMap.get(district) || {
                total: 0,
                elderly: 0,
                children: 0,
                disabled: 0,
                bedridden: 0,
                pregnant: 0,
                chronic_illness: 0,
                source_type: record.source_type
            };
            existing.total += current.total;
            existing.elderly += current.elderly;
            existing.children += current.children;
            existing.disabled += current.disabled;
            existing.bedridden += current.bedridden;
            existing.pregnant += current.pregnant;
            existing.chronic_illness += current.chronic_illness;
            districtMap.set(district, existing);
            return;
        }

        const tambonKey = `${district}|${tambon}`;
        const tambonExisting = tambonMap.get(tambonKey) || {
            total: 0,
            elderly: 0,
            children: 0,
            disabled: 0,
            bedridden: 0,
            pregnant: 0,
            chronic_illness: 0,
            source_type: record.source_type
        };

        tambonExisting.total += current.total;
        tambonExisting.elderly += current.elderly;
        tambonExisting.children += current.children;
        tambonExisting.disabled += current.disabled;
        tambonExisting.bedridden += current.bedridden;
        tambonExisting.pregnant += current.pregnant;
        tambonExisting.chronic_illness += current.chronic_illness;
        tambonMap.set(tambonKey, tambonExisting);

        if (village) {
            const villageKey = `${district}|${tambon}|${village}`;
            villageMap.set(villageKey, current);
        }
    });

    return { districtMap, villageMap, tambonMap };
}

function getPolygonVulnerableInfo(poly, lookup) {
    const district = normalizeKey(poly.distname);
    const tambon = normalizeKey(poly.subdistnam);
    const villageTokens = String(poly.villname || "")
        .split(/[,，、/]+/u)
        .map(normalizeKey)
        .filter(Boolean);
    const mooToken = normalizeKey(poly.moo);

    for (const token of [...villageTokens, mooToken]) {
        const villageInfo = lookup.villageMap.get(`${district}|${tambon}|${token}`);
        if (villageInfo) return { ...villageInfo, level: "village" };
    }

    const tambonInfo = lookup.tambonMap.get(`${district}|${tambon}`);
    if (tambonInfo) return { ...tambonInfo, level: "tambon" };
    const districtInfo = lookup.districtMap.get(district);
    if (districtInfo) return { ...districtInfo, level: "district" };
    return null;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("th-TH");
}

export default function VulnerableGroupsVillageMap({ session, polygons = [] }) {
    const [records, setRecords] = useState([]);
    const [source, setSource] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [baseMap, setBaseMap] = useState("street");
    const selectedBaseLayer = getMapBaseLayer(baseMap);

    useEffect(() => {
        if (!session?.id) {
            setRecords([]);
            setSource("");
            return;
        }

        let ignore = false;
        async function fetchVulnerableGroups() {
            setLoading(true);
            setError("");
            try {
                const response = await fetch(`/stn-eoc/api/eoc/flood/vulnerable-groups?session_id=${session.id}`);
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.message || result.error || "โหลดข้อมูลกลุ่มเปราะบางไม่สำเร็จ");
                }
                if (!ignore) {
                    setRecords(Array.isArray(result.data) ? result.data : []);
                    setSource(result.source || "");
                }
            } catch (fetchError) {
                console.error("Error fetching vulnerable groups map data:", fetchError);
                if (!ignore) {
                    setRecords([]);
                    setError(fetchError.message || "โหลดข้อมูลกลุ่มเปราะบางไม่สำเร็จ");
                }
            } finally {
                if (!ignore) setLoading(false);
            }
        }

        fetchVulnerableGroups();
        return () => {
            ignore = true;
        };
    }, [session?.id]);

    const lookup = useMemo(() => buildVulnerableLookup(records), [records]);
    const mappedPolygons = useMemo(() => {
        return polygons.map((poly) => ({
            ...poly,
            vulnerableInfo: getPolygonVulnerableInfo(poly, lookup)
        }));
    }, [lookup, polygons]);
    const provinceSummary = useMemo(() => {
        return records.reduce((summary, record) => {
            summary.total += vulnerableTotal(record);
            summary.elderly += numberValue(record.elderly);
            summary.children += numberValue(record.children);
            summary.disabled += numberValue(record.disabled);
            summary.bedridden += numberValue(record.bedridden);
            summary.pregnant += numberValue(record.pregnant);
            summary.chronic_illness += numberValue(record.chronic_illness);
            return summary;
        }, { total: 0, elderly: 0, children: 0, disabled: 0, bedridden: 0, pregnant: 0, chronic_illness: 0 });
    }, [records]);
    const maxTotal = Math.max(...mappedPolygons.map((poly) => poly.vulnerableInfo?.total || 0), 0);
    const sourceLabel = source === "baseline" ? "ฐานข้อมูลกลาง" : "ข้อมูลใน Session";

    if (!session) {
        return null;
    }

    return (
        <section className="rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold text-gray-800">
                        <span className="text-3xl"><AppIcon icon="accessibility" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
                        แผนที่ข้อมูลกลุ่มเปราะบาง (ระดับหมู่บ้าน)
                    </h2>
                    <p className="text-gray-600">
                        Session #{session.session_number} • แสดงจำนวนกลุ่มเปราะบางจาก{sourceLabel}
                    </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    แผนที่พื้นหลัง
                    <select
                        value={baseMap}
                        onChange={(event) => setBaseMap(event.target.value)}
                        className="rounded border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-emerald-500"
                    >
                        {Object.entries(MAP_BASE_LAYERS).map(([key, layer]) => (
                            <option key={key} value={key}>{layer.label}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                <SummaryBox label="รวมทั้งหมด" value={provinceSummary.total} tone="emerald" />
                <SummaryBox label="ผู้สูงอายุ" value={provinceSummary.elderly} />
                <SummaryBox label="เด็กเล็ก" value={provinceSummary.children} />
                <SummaryBox label="ผู้พิการ" value={provinceSummary.disabled} />
                <SummaryBox label="ติดเตียง" value={provinceSummary.bedridden} />
                <SummaryBox label="ตั้งครรภ์" value={provinceSummary.pregnant} />
                <SummaryBox label="โรคเรื้อรัง" value={provinceSummary.chronic_illness} />
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                {loading ? (
                    <div className="flex h-[520px] items-center justify-center">
                        <div className="text-center">
                            <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                            <p className="font-semibold text-gray-600">กำลังโหลดข้อมูลกลุ่มเปราะบาง...</p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg bg-white shadow" style={{ height: "560px" }}>
                        <MapContainer
                            center={[6.6238, 100.0673]}
                            zoom={10}
                            style={{ height: "100%", width: "100%" }}
                        >
                            <TileLayer
                                url={selectedBaseLayer.url}
                                attribution={selectedBaseLayer.attribution}
                            />

                            {mappedPolygons.map((poly, index) => {
                                const info = poly.vulnerableInfo;
                                const total = info?.total || 0;
                                const fillColor = getVulnerableColor(total, maxTotal);
                                return (
                                    <Polygon
                                        key={`${poly.id || poly.villcode || index}-vulnerable`}
                                        positions={poly.coordinates}
                                        pathOptions={{
                                            fillColor,
                                            fillOpacity: total ? 0.72 : 0.12,
                                            color: total ? "#14532D" : "#94A3B8",
                                            weight: total ? 1.5 : 0.8
                                        }}
                                    >
                                        <Popup>
                                            <div className="min-w-[220px] text-sm">
                                                <strong className="text-emerald-800">{poly.villname || `หมู่ ${poly.moo}`}</strong><br />
                                                อำเภอ: {poly.distname}<br />
                                                ตำบล: {poly.subdistnam}<br />
                                                {info ? (
                                                    <>
                                                        <div className="my-2 rounded bg-emerald-50 px-2 py-1 font-bold text-emerald-800">
                                                            รวม {formatNumber(total)} คน {info.level === "district" ? "(ยอดระดับอำเภอ)" : info.level === "tambon" ? "(ยอดระดับตำบล)" : ""}
                                                        </div>
                                                        ผู้สูงอายุ: {formatNumber(info.elderly)}<br />
                                                        เด็กเล็ก: {formatNumber(info.children)}<br />
                                                        ผู้พิการ: {formatNumber(info.disabled)}<br />
                                                        ผู้ป่วยติดเตียง: {formatNumber(info.bedridden)}<br />
                                                        สตรีมีครรภ์: {formatNumber(info.pregnant)}<br />
                                                        ผู้ป่วยเรื้อรัง: {formatNumber(info.chronic_illness)}<br />
                                                        {info.needs && <><strong>ความต้องการ:</strong> {info.needs}<br /></>}
                                                        {info.notes && <><strong>หมายเหตุ:</strong> {info.notes}<br /></>}
                                                    </>
                                                ) : (
                                                    <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-slate-600">
                                                        ยังไม่มีข้อมูลกลุ่มเปราะบางในพื้นที่นี้
                                                    </div>
                                                )}
                                            </div>
                                        </Popup>
                                    </Polygon>
                                );
                            })}
                        </MapContainer>
                    </div>
                )}

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-700">
                    <LegendItem color="#DC2626" label="มากที่สุด" />
                    <LegendItem color="#F97316" label="สูง" />
                    <LegendItem color="#FBBF24" label="ปานกลาง" />
                    <LegendItem color="#22C55E" label="มีข้อมูล" />
                    <LegendItem color="#E5E7EB" label="ไม่มีข้อมูล" />
                </div>
            </div>
        </section>
    );
}

function SummaryBox({ label, value, tone = "slate" }) {
    const toneClass = tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
    return (
        <div className={`rounded-lg border p-3 ${toneClass}`}>
            <div className="text-xs font-black opacity-75">{label}</div>
            <div className="mt-1 text-2xl font-black">{formatNumber(value)}</div>
            <div className="text-xs font-semibold opacity-70">คน</div>
        </div>
    );
}

function LegendItem({ color, label }) {
    return (
        <div className="flex items-center gap-2">
            <span className="h-4 w-6 rounded border border-slate-300" style={{ backgroundColor: color }}></span>
            <span>{label}</span>
        </div>
    );
}
