import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";

function parseNumber(value) {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const parsed = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
}

function toDbNumber(value) {
    const parsed = parseNumber(value);
    return parsed === null ? 0 : parsed;
}

function sum(values) {
    return values.reduce((total, value) => total + Number(value || 0), 0);
}

function normalizeAgencyName(value) {
    return String(value || "")
        .replace(/\s+/g, "")
        .replace(/^รพท\./, "รพ.")
        .replace(/^รพช\./, "รพ.")
        .replace(/^โรงพยาบาล/, "รพ.")
        .replace(/จังหวัดสตูล$/, "")
        .replace(/จ\.สตูล$/, "")
        .trim();
}

function buildFacilityMap(facilities) {
    const map = new Map();

    facilities.forEach((facility) => {
        map.set(normalizeAgencyName(facility.name), facility);
    });

    return map;
}

function aggregateBy(rows, key) {
    const map = new Map();

    rows.forEach((row) => {
        const id = row[key];
        if (!map.has(id)) {
            map.set(id, {
                id,
                label: key === "item_code" ? row.item_name : row.agency_name,
                unit: key === "item_code" ? row.unit : undefined,
                agency_type: key === "agency_id" ? row.agency_type : undefined,
                rows: 0,
                opening_qty: 0,
                received_qty: 0,
                issued_qty: 0,
                balance_qty: 0,
                not_recorded: 0
            });
        }

        const item = map.get(id);
        item.rows += 1;
        item.opening_qty += Number(row.opening_qty || 0);
        item.received_qty += Number(row.received_qty || 0);
        item.issued_qty += Number(row.issued_qty || 0);
        item.balance_qty += Number(row.balance_qty || 0);
        item.not_recorded += row.data_status === "not_recorded" ? 1 : 0;
    });

    return [...map.values()].sort((a, b) => b.balance_qty - a.balance_qty);
}

async function loadHealthFacilities() {
    return query(
        `SELECT id, name, typecode, district_name, tambon, lat, lon
         FROM health_facilities
         WHERE is_active = 1
         ORDER BY name ASC`,
        []
    );
}

async function ensureMedicalInventoryTables() {
    await query(`
        CREATE TABLE IF NOT EXISTS medical_inventory_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            external_event_id INT NULL,
            eoc_type VARCHAR(50) NOT NULL DEFAULT 'flood',
            session_number INT NULL,
            event_name VARCHAR(255) NOT NULL,
            source_file VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_inventory_event (eoc_type, session_number, event_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `, []);

    await query(`
        CREATE TABLE IF NOT EXISTS medical_inventory_stock (
            id INT AUTO_INCREMENT PRIMARY KEY,
            inventory_event_id INT NOT NULL,
            inventory_agency_id INT NOT NULL,
            health_facility_id INT NULL,
            agency_name VARCHAR(255) NOT NULL,
            agency_name_original VARCHAR(255) NULL,
            agency_type VARCHAR(80) NULL,
            item_code VARCHAR(80) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            unit VARCHAR(80) NULL,
            movement_tracked BOOLEAN NOT NULL DEFAULT TRUE,
            opening_qty DECIMAL(14,2) NULL,
            received_qty DECIMAL(14,2) NULL,
            issued_qty DECIMAL(14,2) NULL,
            balance_qty DECIMAL(14,2) NULL,
            data_status ENUM('recorded', 'not_recorded') NOT NULL DEFAULT 'recorded',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_medical_inventory_stock_event
                FOREIGN KEY (inventory_event_id) REFERENCES medical_inventory_events(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_medical_inventory_stock_health_facility
                FOREIGN KEY (health_facility_id) REFERENCES health_facilities(id)
                ON DELETE SET NULL,
            UNIQUE KEY unique_inventory_stock_facility_item (inventory_event_id, health_facility_id, item_code),
            KEY idx_inventory_stock_inventory_agency (inventory_agency_id),
            KEY idx_inventory_stock_health_facility (health_facility_id),
            KEY idx_inventory_stock_item (item_code),
            KEY idx_inventory_stock_status (data_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `, []);

    await query(`
        CREATE TABLE IF NOT EXISTS medical_inventory_movements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            stock_id INT NOT NULL,
            movement_type ENUM('receive', 'issue', 'adjust') NOT NULL,
            movement_qty DECIMAL(14,2) NOT NULL,
            balance_before DECIMAL(14,2) NULL,
            balance_after DECIMAL(14,2) NULL,
            requested_by VARCHAR(255) NULL,
            requested_team VARCHAR(255) NULL,
            eoc_session_id INT NULL,
            note TEXT NULL,
            movement_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_medical_inventory_movements_stock
                FOREIGN KEY (stock_id) REFERENCES medical_inventory_stock(id)
                ON DELETE CASCADE,
            KEY idx_inventory_movements_stock (stock_id),
            KEY idx_inventory_movements_type (movement_type),
            KEY idx_inventory_movements_session (eoc_session_id),
            KEY idx_inventory_movements_at (movement_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `, []);
}

async function getOrCreateInventoryEvent() {
    // Try to find an existing event for flood, session 3
    const existing = await query(
        `SELECT id, external_event_id, event_name, eoc_type, session_number, source_file
         FROM medical_inventory_events
         WHERE eoc_type = ? AND session_number = ?`,
        ["flood", 3]
    );

    if (existing.length > 0) {
        return existing[0];
    }

    // If not found, insert a new one with default values
    const result = await query(
        `INSERT INTO medical_inventory_events
         (external_event_id, eoc_type, session_number, event_name, source_file)
         VALUES (?, ?, ?, ?, ?)`,
        [null, "flood", 3, "อุทกภัย จ.สตูล", null]
    );

    return {
        id: result.insertId,
        external_event_id: null,
        eoc_type: "flood",
        session_number: 3,
        event_name: "อุทกภัย จ.สตูล",
        source_file: null
    };
}

function normalizeDbRow(row) {
    return {
        ...row,
        event_id: parseNumber(row.event_id),
        inventory_event_id: parseNumber(row.inventory_event_id),
        inventory_agency_id: parseNumber(row.inventory_agency_id),
        agency_id: parseNumber(row.agency_id),
        health_facility_id: parseNumber(row.health_facility_id),
        movement_tracked: Boolean(row.movement_tracked),
        opening_qty: parseNumber(row.opening_qty),
        received_qty: parseNumber(row.received_qty),
        issued_qty: parseNumber(row.issued_qty),
        balance_qty: parseNumber(row.balance_qty),
        matched_facility: Boolean(row.health_facility_id)
    };
}

async function loadInventoryRowsFromDb(eventId) {
    const rows = await query(
        `SELECT
            s.id,
            e.external_event_id AS event_id,
            e.event_name,
            e.eoc_type,
            e.session_number,
            s.inventory_event_id,
            s.inventory_agency_id,
            COALESCE(s.health_facility_id, s.inventory_agency_id) AS agency_id,
            s.health_facility_id,
            s.agency_name_original,
            s.agency_name,
            s.agency_type,
            s.item_code,
            s.item_name,
            s.unit,
            s.movement_tracked,
            s.opening_qty,
            s.received_qty,
            s.issued_qty,
            s.balance_qty,
            s.data_status,
            hf.district_name,
            hf.tambon,
            hf.lat,
            hf.lon
         FROM medical_inventory_stock s
         JOIN medical_inventory_events e ON e.id = s.inventory_event_id
         LEFT JOIN health_facilities hf ON hf.id = s.health_facility_id
         WHERE s.inventory_event_id = ?
         ORDER BY s.agency_name ASC, s.item_name ASC`,
        [eventId]
    );

    return rows.map(normalizeDbRow);
}

async function getInventoryContext() {
    await ensureMedicalInventoryTables();
    const facilities = await loadHealthFacilities();
    const event = await getOrCreateInventoryEvent();
    return { facilities, event };
}

export async function GET(request) {
    try {
        const auth = await requireAuth(request, ["admin", "commander", "MCATT", "SAT", "SeRHT", "staff"]);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const agencyId = searchParams.get("agency_id");
        const itemCode = searchParams.get("item_code");
        const status = searchParams.get("status");

        const { facilities, event } = await getInventoryContext();
        const allRows = await loadInventoryRowsFromDb(event.id);
        const rows = allRows.filter((row) => {
            if (agencyId && String(row.agency_id) !== agencyId) return false;
            if (itemCode && row.item_code !== itemCode) return false;
            if (status && row.data_status !== status) return false;
            return true;
        });

        const agencies = aggregateBy(allRows, "agency_id").sort((a, b) => String(a.label).localeCompare(String(b.label), "th"));
        const items = aggregateBy(allRows, "item_code").sort((a, b) => String(a.label).localeCompare(String(b.label), "th"));

        return NextResponse.json({
            success: true,
            source: "database",
            event: {
                id: event.external_event_id || event.id,
                inventory_event_id: event.id,
                name: event.event_name,
                eoc_type: event.eoc_type,
                session_number: event.session_number
            },
            summary: {
                total_rows: allRows.length,
                filtered_rows: rows.length,
                agency_count: new Set(allRows.map((row) => row.agency_id)).size,
                item_count: new Set(allRows.map((row) => row.item_code)).size,
                tracked_rows: allRows.filter((row) => row.movement_tracked).length,
                not_recorded_rows: allRows.filter((row) => row.data_status === "not_recorded").length,
                opening_qty: sum(allRows.map((row) => row.opening_qty)),
                received_qty: sum(allRows.map((row) => row.received_qty)),
                issued_qty: sum(allRows.map((row) => row.issued_qty)),
                balance_qty: sum(allRows.map((row) => row.balance_qty)),
                matched_facility_count: new Set(allRows.filter((row) => row.health_facility_id).map((row) => row.health_facility_id)).size,
                unmatched_agency_count: new Set(allRows.filter((row) => !row.health_facility_id).map((row) => row.inventory_agency_id)).size
            },
            filters: {
                agencies,
                health_facilities: facilities,
                items,
                statuses: ["recorded", "not_recorded"]
            },
            aggregates: {
                by_agency: aggregateBy(rows, "agency_id"),
                by_item: aggregateBy(rows, "item_code")
            },
            stock: allRows,
            data: rows
        });
    } catch (error) {
        console.error("Medical inventory API error:", error);
        return NextResponse.json(
            { success: false, message: "ไม่สามารถโหลดข้อมูลเวชภัณฑ์และคงคลังได้" },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const auth = await requireAuth(request, ["admin", "commander"]);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const {
            health_facility_id,
            item_code,
            item_name,
            unit,
            movement_tracked = true,
            opening_qty,
            received_qty,
            issued_qty,
            balance_qty,
            data_status = "recorded"
        } = body;

        const facilityId = Number(health_facility_id);
        const normalizedItemCode = String(item_code || "").trim().toUpperCase().replace(/\s+/g, "_");
        const normalizedItemName = String(item_name || "").trim();
        const normalizedUnit = String(unit || "").trim();

        if (!Number.isInteger(facilityId) || facilityId <= 0) {
            return NextResponse.json({ success: false, message: "กรุณาเลือกหน่วยบริการ" }, { status: 400 });
        }

        if (!normalizedItemCode || !normalizedItemName || !normalizedUnit) {
            return NextResponse.json({ success: false, message: "กรุณาระบุรหัส รายการ และหน่วยนับเวชภัณฑ์" }, { status: 400 });
        }

        const { facilities, event } = await getInventoryContext();
        const facility = facilities.find((item) => Number(item.id) === facilityId);
        if (!facility) {
            return NextResponse.json({ success: false, message: "ไม่พบหน่วยบริการในระบบ" }, { status: 400 });
        }

        const opening = toDbNumber(opening_qty);
        const received = toDbNumber(received_qty);
        const issued = toDbNumber(issued_qty);
        const balance = parseNumber(balance_qty);
        const finalBalance = balance === null ? opening + received - issued : balance;

        if (finalBalance < 0) {
            return NextResponse.json({ success: false, message: "ยอดคงเหลือต้องไม่ติดลบ" }, { status: 400 });
        }

        const existingRows = await query(
            `SELECT id, received_qty, issued_qty, balance_qty
             FROM medical_inventory_stock
             WHERE inventory_event_id = ? AND health_facility_id = ? AND item_code = ?
             LIMIT 1`,
            [event.id, facilityId, normalizedItemCode]
        );
        const existing = existingRows[0] || null;
        let stockId = existing?.id;

        if (existing) {
            await query(
                `UPDATE medical_inventory_stock
                 SET agency_name = ?,
                     agency_name_original = ?,
                     agency_type = ?,
                     item_name = ?,
                     unit = ?,
                     movement_tracked = ?,
                     opening_qty = ?,
                     received_qty = ?,
                     issued_qty = ?,
                     balance_qty = ?,
                     data_status = ?
                 WHERE id = ?`,
                [
                    facility.name,
                    facility.name,
                    facility.typecode || "",
                    normalizedItemName,
                    normalizedUnit,
                    movement_tracked ? 1 : 0,
                    opening,
                    received,
                    issued,
                    finalBalance,
                    data_status === "not_recorded" ? "not_recorded" : "recorded",
                    existing.id
                ]
            );
        } else {
            const result = await query(
                `INSERT INTO medical_inventory_stock
                 (inventory_event_id, inventory_agency_id, health_facility_id, agency_name, agency_name_original, agency_type,
                  item_code, item_name, unit, movement_tracked, opening_qty, received_qty, issued_qty, balance_qty, data_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    event.id,
                    facility.id,
                    facility.id,
                    facility.name,
                    facility.name,
                    facility.typecode || "",
                    normalizedItemCode,
                    normalizedItemName,
                    normalizedUnit,
                    movement_tracked ? 1 : 0,
                    opening,
                    received,
                    issued,
                    finalBalance,
                    data_status === "not_recorded" ? "not_recorded" : "recorded"
                ]
            );
            stockId = result.insertId;
        }

        if (movement_tracked && stockId) {
            const previousReceived = Number(existing?.received_qty || 0);
            const previousIssued = Number(existing?.issued_qty || 0);
            const previousBalance = Number(existing?.balance_qty || 0);
            const receivedDelta = received - previousReceived;
            const issuedDelta = issued - previousIssued;

            if (receivedDelta > 0) {
                await query(
                    `INSERT INTO medical_inventory_movements
                     (stock_id, movement_type, movement_qty, balance_before, balance_after, requested_team, created_by)
                     VALUES (?, 'receive', ?, ?, ?, ?, ?)`,
                    [stockId, receivedDelta, previousBalance, previousBalance + receivedDelta, "บันทึกคงคลังเวชภัณฑ์", auth.user.id]
                );
            }

            if (issuedDelta > 0) {
                await query(
                    `INSERT INTO medical_inventory_movements
                     (stock_id, movement_type, movement_qty, balance_before, balance_after, requested_team, created_by)
                     VALUES (?, 'issue', ?, ?, ?, ?, ?)`,
                    [stockId, issuedDelta, previousBalance + Math.max(receivedDelta, 0), finalBalance, "บันทึกคงคลังเวชภัณฑ์", auth.user.id]
                );
            }

            if (existing && receivedDelta <= 0 && issuedDelta <= 0 && finalBalance !== previousBalance) {
                await query(
                    `INSERT INTO medical_inventory_movements
                     (stock_id, movement_type, movement_qty, balance_before, balance_after, requested_team, created_by)
                     VALUES (?, 'adjust', ?, ?, ?, ?, ?)`,
                    [stockId, Math.abs(finalBalance - previousBalance), previousBalance, finalBalance, "ปรับยอดคงคลัง", auth.user.id]
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: existing ? "อัปเดตข้อมูลเวชภัณฑ์ในฐานข้อมูลสำเร็จ" : "เพิ่มเวชภัณฑ์ชนิดใหม่ลงฐานข้อมูลสำเร็จ"
        });
    } catch (error) {
        console.error("Save medical inventory error:", error);
        return NextResponse.json(
            { success: false, message: "ไม่สามารถบันทึกข้อมูลเวชภัณฑ์ได้" },
            { status: 500 }
        );
    }
}
