// เสียงเตือนบนมือถือ: AudioContext ถูกระงับจนกว่าผู้ใช้แตะหน้าจอ → ต้องปลดล็อกจากการแตะ และแจ้งเตือนผ่าน service worker
class FakeContext {
  constructor() { this.state = "suspended"; this.currentTime = 0; this.destination = {}; FakeContext.instances.push(this); }
  resume() { if (FakeContext.allowResume) this.state = "running"; return Promise.resolve(); }
  createBuffer() { return {}; }
  createBufferSource() { return { connect: () => {}, start: () => {} }; }
  createOscillator() { FakeContext.tones += 1; return { type: "", frequency: { setValueAtTime: () => {} }, connect: (n) => n, start: () => {}, stop: () => {} }; }
  createGain() { return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: (n) => n }; }
}
FakeContext.instances = [];

beforeEach(() => {
  jest.resetModules();
  FakeContext.instances = [];
  FakeContext.allowResume = false;
  FakeContext.tones = 0;
  window.AudioContext = FakeContext;
  window.__stnAlertAudioUnlock = false;
});

test("ยังไม่เคยแตะหน้าจอ (เครื่องไม่ให้ resume) → playAlert คืน false ไม่เล่นเสียง", async () => {
  const { playAlert } = require("@/lib/alertSound");
  expect(await playAlert("critical")).toBe(false);
  expect(FakeContext.tones).toBe(0);
});

test("แตะหน้าจอครั้งแรก → ปลดล็อก แล้วสัญญาณเตือนเล่นได้ และใช้ AudioContext ตัวเดียวกัน", async () => {
  const { installAlertAudioUnlock, playAlert, alertAudioReady } = require("@/lib/alertSound");
  installAlertAudioUnlock();
  FakeContext.allowResume = true; // การแตะจริงทำให้เบราว์เซอร์ยอม resume
  const ready = new Promise((resolve) => window.addEventListener("stn-alert-audio-ready", resolve, { once: true }));
  window.dispatchEvent(new Event("pointerdown"));
  await ready;
  expect(alertAudioReady()).toBe(true);
  expect(await playAlert("critical")).toBe(true);
  expect(FakeContext.tones).toBeGreaterThan(0);
  expect(FakeContext.instances).toHaveLength(1);
});

test("แจ้งเตือนของระบบใช้ service worker (Android/iPhone ไม่รองรับ new Notification)", async () => {
  const showNotification = jest.fn(async () => {});
  global.Notification = { permission: "granted" };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: jest.fn(async () => ({ showNotification })) } });
  const { showSystemAlert } = require("@/lib/alertSound");
  expect(await showSystemAlert("[ทดสอบ] คำขอใหม่", { body: "x", tag: "help-1" })).toBe(true);
  expect(showNotification).toHaveBeenCalledWith("[ทดสอบ] คำขอใหม่", expect.objectContaining({ tag: "help-1", vibrate: expect.any(Array) }));
});

test("ยังไม่อนุญาตแจ้งเตือน → ไม่แสดง", async () => {
  global.Notification = { permission: "default" };
  const { showSystemAlert } = require("@/lib/alertSound");
  expect(await showSystemAlert("x")).toBe(false);
});

test("เลือกแบบเสียงต่อระดับได้ จำไว้ในเครื่อง และ 'ไม่มีเสียงสัญญาณ' ไม่เล่นอะไร", () => {
  const sound = require("@/lib/alertSound");
  window.localStorage.clear();
  expect(sound.readSoundPrefs()).toEqual(sound.DEFAULT_SOUND_PREFS);
  const saved = sound.saveSoundPrefs({ critical: "emergency", serious: "none", info: "bogus", volume: 5 });
  expect(saved).toEqual({ critical: "emergency", serious: "none", info: "chime", volume: 1 });
  expect(sound.readSoundPrefs()).toEqual(saved);
  const ctx = new FakeContext();
  FakeContext.tones = 0;
  sound.playPattern(ctx, "serious");
  expect(FakeContext.tones).toBe(0);
  sound.playPattern(ctx, "critical");
  expect(FakeContext.tones).toBe(6); // โทนคู่ 3 ช่วง
  for (const style of Object.keys(sound.SOUND_STYLES)) expect(() => sound.playStyle(ctx, style, { volume: 0.3 })).not.toThrow();
});
