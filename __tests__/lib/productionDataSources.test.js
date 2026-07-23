const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("production data source safeguards", () => {
    test("Flood Session 3 summary has no production seed fallback", () => {
        const source = read("app/api/public/flood-disease-summary/route.js");
        expect(source).not.toContain("floodSession3DiseaseMatrix");
        expect(source).not.toContain("buildFloodSession3SeedPayload");
        expect(source).not.toContain("google_sheet_seed");
    });

    test("homepage has no static announcement fallback", () => {
        const source = read("app/page.jsx");
        expect(source).not.toContain('id: "static-1"');
        expect(source).not.toContain('date: "2025-12-17"');
    });

    test("production source does not import deleted mock datasets", () => {
        const productionRoots = ["app", "components", "lib", "src"];
        const files = [];
        const walk = (directory) => {
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                const fullPath = path.join(directory, entry.name);
                if (entry.isDirectory()) walk(fullPath);
                else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) files.push(fullPath);
            }
        };
        productionRoots.forEach((directory) => walk(path.join(root, directory)));
        const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");

        expect(source).not.toMatch(/data_mode:\s*["']mock/);
        expect(source).not.toMatch(/data_source:\s*["']google_sheet_seed/);
        expect(source).not.toContain("role_access_mock");
        expect(source).not.toContain("@/data/eoc-flood-management.json");
        expect(source).not.toContain("@/lib/diseaseOutbreakMockData");
    });

    test("meeting linkage is committed through the shared database transaction", () => {
        const source = read("app/api/eoc/flood/management/resources/route.js");
        expect(source).toContain("await transaction(async (execute)");
        expect(source).toContain("INSERT INTO decision_logs");
        expect(source).toContain("INSERT INTO missions");
        expect(source).toContain("UPDATE decision_logs SET linked_mission_id");
    });

    test("team report workflow requires verification before approval", () => {
        const source = read("app/api/eoc/sessions/[sessionId]/teams/[sessionTeamId]/reports/[reportId]/review/route.js");
        expect(source).toContain('body.status === "approved" ? "verified"');
        expect(source).toContain('["verified", "approved", "returned"]');
    });

    test("notifications are always scoped to the authenticated recipient", () => {
        const source = read("app/api/officer/notifications/route.js");
        expect(source).toContain("WHERE recipient_user_id = ?");
        expect(source).toContain("[auth.user.id]");
    });

    test("public routes never read unapproved team reports", () => {
        const publicRoot = path.join(root, "app", "api", "public");
        const files = [];
        const walk = (directory) => {
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                const fullPath = path.join(directory, entry.name);
                if (entry.isDirectory()) walk(fullPath);
                else if (entry.name.endsWith(".js")) files.push(fullPath);
            }
        };
        walk(publicRoot);
        const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
        expect(source).not.toContain("eoc_team_reports");
    });

    test("village polygon pagination does not bind LIMIT/OFFSET on incompatible MySQL", () => {
        const source = read("app/api/admin/village-polygons/route.js");
        expect(source).not.toContain("LIMIT ? OFFSET ?");
        expect(source).toContain("Math.min(requestedLimit, 100)");
    });

    test("mutation feedback uses the shared toast service instead of message boxes", () => {
        const mutationPages = [
            "app/admin/data-management/page.jsx",
            "app/admin/master-data/[type]/page.jsx",
            "app/admin/eoc-management/page.jsx",
            "app/admin/upload-infographics/page.jsx",
            "app/eoc/flood/operations-team/page.jsx",
            "app/profile/page.jsx",
            "app/settings/page.jsx",
            "app/resources/medical-inventory/page.jsx",
            "components/eoc/FloodEocManagementDashboard.jsx",
            "src/features/eoc/teams/shared/components/base-team-records.jsx",
        ];
        const source = mutationPages.map(read).join("\n");
        expect(source).toContain("showSuccess(");
        expect(source).toContain("showError(");
        expect(source).not.toContain("setMessage(");
        expect(source).not.toMatch(/const\s+\[message,\s*setMessage\]/);
    });
});
