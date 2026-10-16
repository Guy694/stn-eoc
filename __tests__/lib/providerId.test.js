/**
 * @jest-environment node
 */
import {
  ProviderIdError, buildHealthIdAuthorizeUrl, exchangeHealthIdCode, fetchProviderProfile, getProviderIdConfigError, normalizeProviderProfile,
  protectHashCid, requestProviderToken, signLinkIntent, verifyLinkIntent
} from "@/lib/providerId";
import { resolveProviderLogin } from "@/lib/providerIdLogin";

const config = {
  healthIdUrl: "https://uat-moph.id.th", providerUrl: "https://uat-provider.id.th",
  healthClientId: "hc", healthClientSecret: "hs", providerClientId: "pc", providerSecretKey: "ps",
  redirectUri: "https://eoc.example/stn-eoc/api/auth/provider-id/callback/"
};
const reply = (status, json) => async () => ({ status, ok: status < 400, text: async () => JSON.stringify(json) });

beforeAll(() => { process.env.SECRET_KEY = "test-secret"; });

describe("Health ID / Provider ID client", () => {
  it("สร้างลิงก์ไปหน้า Health ID ตามคู่มือ", () => {
    const url = new URL(buildHealthIdAuthorizeUrl(config, "abc"));
    expect(url.origin + url.pathname).toBe("https://uat-moph.id.th/oauth/redirect");
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: "hc", redirect_uri: config.redirectUri, response_type: "code", state: "abc" });
  });

  it("บอกค่าที่ยังไม่ได้ตั้ง", () => {
    expect(getProviderIdConfigError({ ...config, providerSecretKey: "" })).toMatch(/PROVIDER_ID_PRD_SECRET_KEY/);
    expect(getProviderIdConfigError(config)).toBeNull();
  });

  it("แลก code เป็น token: ส่งแบบ form-urlencoded พร้อม client_secret", async () => {
    const fetchImpl = jest.fn(reply(200, { status: "success", data: { access_token: "HT" } }));
    await expect(exchangeHealthIdCode(config, "CODE", fetchImpl)).resolves.toBe("HT");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://uat-moph.id.th/api/v1/token");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(init.body))).toMatchObject({ grant_type: "authorization_code", code: "CODE", client_secret: "hs" });
  });

  it("redirect uri ไม่ตรง → ข้อความภาษาไทย", async () => {
    await expect(exchangeHealthIdCode(config, "C", reply(422, { message: "Redirect uri is invalid" }))).rejects.toThrow("Redirect URI ไม่ตรง");
  });

  it("ไม่มี Provider ID → error no_provider", async () => {
    const error = await requestProviderToken(config, "HT", reply(400, { message: "This user has not provider id" })).catch((err) => err);
    expect(error).toBeInstanceOf(ProviderIdError);
    expect(error.code).toBe("no_provider");
  });

  it("ขอ token Provider ID ด้วย token_by = Health ID และดึง profile ด้วย header client-id/secret-key", async () => {
    const tokenFetch = jest.fn(reply(200, { status: 200, data: { access_token: "PT" } }));
    await expect(requestProviderToken(config, "HT", tokenFetch)).resolves.toBe("PT");
    expect(JSON.parse(tokenFetch.mock.calls[0][1].body)).toEqual({ client_id: "pc", secret_key: "ps", token_by: "Health ID", token: "HT" });
    const profileFetch = jest.fn(reply(200, { status: 200, data: { account_id: "1" } }));
    await fetchProviderProfile(config, "PT", profileFetch);
    expect(profileFetch.mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer PT", "client-id": "pc", "secret-key": "ps" });
  });

  it("แปลง profile และไม่เก็บเลขบัตร", () => {
    const profile = normalizeProviderProfile({
      account_id: "544x5794", hash_cid: "7a56", provider_id: "0111111111X21", special_title_th: "นายแพทย์", name_th: "หมอพร้อม สงบสุข",
      firstname_th: "หมอพร้อม", lastname_th: "สงบสุข", organization: [{ hcode: "10745", hname_th: "รพ.สตูล", position: "แพทย์", address: { province: "สตูล" } }]
    });
    expect(profile).toMatchObject({ accountId: "544x5794", providerId: "0111111111X21", title: "นายแพทย์", givenName: "หมอพร้อม", familyName: "สงบสุข" });
    expect(profile.primaryOrg).toMatchObject({ hcode: "10745", name: "รพ.สตูล", province: "สตูล" });
    expect(protectHashCid("7A56")).toBe(protectHashCid("7a56"));
    expect(protectHashCid("7a56")).not.toContain("7a56");
  });

  it("cookie เชื่อมบัญชีผูกกับ state และแก้ไม่ได้", () => {
    const value = signLinkIntent(42, "state1");
    expect(verifyLinkIntent(value, "state1")).toBe(42);
    expect(verifyLinkIntent(value, "state2")).toBeNull();
    expect(verifyLinkIntent(value.replace(/^42/, "43"), "state1")).toBeNull();
    expect(verifyLinkIntent("", "state1")).toBeNull();
  });
});

describe("resolveProviderLogin", () => {
  const profile = normalizeProviderProfile({ account_id: "A1", hash_cid: "h1", provider_id: "P1", organization: [{ hcode: "10745", hname_th: "รพ.สตูล" }] });
  const officer = { id: 7, username: "u7", role: "staff", is_approved: 1 };

  function db(found) {
    const calls = [];
    const execute = jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      if (/^SELECT .* FROM officer\s+WHERE \(provider_account_id/s.test(sql.trim())) return [found];
      if (/^UPDATE officer SET provider_account_id = \?, provider_cid_hmac/.test(sql.trim())) return [{ affectedRows: 1 }];
      if (/^SELECT .* FROM officer WHERE id = \?/s.test(sql.trim())) return [[{ ...officer, id: params[0] }]];
      return [{ affectedRows: 1 }];
    });
    return { execute, calls };
  }

  it("เข้าสู่ระบบเมื่อเคยเชื่อมแล้ว และอัปเดตหน่วยงานล่าสุด", async () => {
    const { execute, calls } = db([officer]);
    await expect(resolveProviderLogin(execute, profile)).resolves.toMatchObject({ kind: "login", officer: { id: 7 } });
    expect(calls.some((call) => /provider_org = \?, last_login = NOW\(\)/.test(call.sql))).toBe(true);
  });

  it("ยังไม่เชื่อม → ไม่ให้เข้าและไม่จับคู่ด้วยชื่อ", async () => {
    const { execute } = db([]);
    await expect(resolveProviderLogin(execute, profile)).resolves.toMatchObject({ kind: "error", code: "provider_not_linked" });
  });

  it("เชื่อมบัญชีให้เจ้าหน้าที่ที่เข้าสู่ระบบอยู่ เก็บ HMAC ไม่ใช่ hash_cid ดิบ", async () => {
    const { execute, calls } = db([]);
    await expect(resolveProviderLogin(execute, profile, { linkOfficerId: 9 })).resolves.toMatchObject({ kind: "linked", officer: { id: 9 } });
    const update = calls.find((call) => /provider_cid_hmac = \?/.test(call.sql));
    expect(update.params[0]).toBe("A1");
    expect(update.params[1]).toBe(protectHashCid("h1"));
    expect(update.params).not.toContain("h1");
  });

  it("Provider ID นี้เชื่อมกับคนอื่นแล้ว → ไม่ยอมเชื่อมซ้ำ", async () => {
    const { execute } = db([{ ...officer, id: 3 }]);
    await expect(resolveProviderLogin(execute, profile, { linkOfficerId: 9 })).resolves.toMatchObject({ kind: "error", code: "provider_taken" });
  });
});

describe("getProviderIdConfig", () => {
  const { getProviderIdConfig } = require("@/lib/providerId");
  const { NextRequest } = require("next/server");
  const keys = ["PROVIDER_ID_ENV", "HEALTH_ID_UAT_CLIENT_ID", "HEALTH_ID_PRD_CLIENT_ID", "HEALTH_ID_CLIENT_ID", "NEXT_PUBLIC_BASE_URL", "PROVIDER_ID_REDIRECT_URI"];
  afterEach(() => keys.forEach((key) => delete process.env[key]));

  it("เลือกชุด UAT/PRD ตาม PROVIDER_ID_ENV และ URL ตามคู่มือ", () => {
    Object.assign(process.env, { HEALTH_ID_UAT_CLIENT_ID: "uat-id", HEALTH_ID_PRD_CLIENT_ID: "prd-id", NEXT_PUBLIC_BASE_URL: "https://eoc.example" });
    const request = new NextRequest("http://localhost/stn-eoc/api/auth/provider-id/authorize/");
    // ค่าเริ่มต้น = ระบบจริง
    expect(getProviderIdConfig(request)).toMatchObject({ mode: "prd", healthClientId: "prd-id", healthIdUrl: "https://moph.id.th", providerUrl: "https://provider.id.th", redirectUri: "https://eoc.example/stn-eoc/api/auth/provider-id/callback/" });
    process.env.PROVIDER_ID_ENV = "uat";
    expect(getProviderIdConfig(request)).toMatchObject({ mode: "uat", healthClientId: "uat-id", healthIdUrl: "https://uat-moph.id.th", providerUrl: "https://uat-provider.id.th" });
  });

  it("ใช้ชุดเดียวแบบไม่มี _UAT/_PRD ได้", () => {
    process.env.HEALTH_ID_CLIENT_ID = "single";
    expect(getProviderIdConfig(new NextRequest("http://localhost/x")).healthClientId).toBe("single");
  });
});
