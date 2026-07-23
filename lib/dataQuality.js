import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function evaluatePopulationRow(row) {
  const issues = [];
  const male = Number(row.male_population);
  const female = Number(row.female_population);
  const total = Number(row.population);
  if (!Number.isFinite(male) || male < 0) issues.push("male_population_invalid");
  if (!Number.isFinite(female) || female < 0) issues.push("female_population_invalid");
  if (!Number.isFinite(total) || total !== male + female) issues.push("population_total_mismatch");
  if (!row.population_scope) issues.push("population_scope_missing");
  if (!row.source_name) issues.push("source_name_missing");
  if (!row.population_year) issues.push("population_year_missing");
  return issues;
}

export function resolveManagedStoragePath(storagePath, workspaceRoot = process.cwd()) {
  if (!storagePath || typeof storagePath !== "string") return null;
  const clean = storagePath.split("?")[0].replace(/^\/+/, "");
  if (clean.includes("..")) return null;
  const relative = clean.startsWith("stn-eoc/") ? clean.slice("stn-eoc/".length) : clean;
  const resolved = path.resolve(workspaceRoot, relative.startsWith("public/") ? relative : path.join("public", relative));
  const publicRoot = path.resolve(workspaceRoot, "public");
  return resolved.startsWith(`${publicRoot}${path.sep}`) ? resolved : null;
}

async function checksum(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function inspectFileAsset(row, workspaceRoot = process.cwd()) {
  const filePath = resolveManagedStoragePath(row.storage_path, workspaceRoot);
  if (!filePath) return { ...row, issue: "invalid_storage_path" };
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) return { ...row, issue: "file_missing" };
    if (Number(row.file_size) !== stats.size) return { ...row, issue: "file_size_mismatch" };
    const actualChecksum = await checksum(filePath);
    if (actualChecksum !== row.checksum_sha256) return { ...row, issue: "checksum_mismatch" };
    return null;
  } catch (error) {
    if (error.code === "ENOENT") return { ...row, issue: "file_missing" };
    return { ...row, issue: "file_unreadable" };
  }
}

export async function findUntrackedUploadFiles(assets, workspaceRoot = process.cwd()) {
  const uploadsRoot = path.resolve(workspaceRoot, "public", "uploads");
  const tracked = new Set(assets.map((asset) => resolveManagedStoragePath(asset.storage_path, workspaceRoot)).filter(Boolean));
  const issues = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && !tracked.has(absolute)) {
        issues.push({ storage_path: path.relative(path.resolve(workspaceRoot, "public"), absolute), issue: "file_metadata_missing" });
      }
    }
  }
  await walk(uploadsRoot);
  return issues;
}

export function buildQualitySummary(issues) {
  return issues.reduce((summary, item) => {
    summary.total += 1;
    summary.by_type[item.issue_type] = (summary.by_type[item.issue_type] || 0) + 1;
    return summary;
  }, { total: 0, by_type: {} });
}
