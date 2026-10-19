import { render, waitFor } from "@testing-library/react";

// ทดสอบการโหลดข้อมูลของชั้นต่าง ๆ (ไม่วาดแผนที่จริง)
jest.mock("leaflet", () => ({ __esModule: true, default: { divIcon: () => ({}) } }));
jest.mock("react-leaflet", () => ({ GeoJSON: () => null, Marker: () => null, Popup: () => null, Tooltip: () => null, Pane: ({ children }) => children }));
jest.mock("@/components/weather/WaterStationLayer", () => () => null);
jest.mock("@/components/weather/RainStationLayer", () => () => null);
jest.mock("@/components/public/map/HealthFacilityPopup", () => () => null);
jest.mock("@/components/public/map/CitizenPointPopup", () => () => null);
const SituationLayers = require("@/components/public/map/SituationLayers").default;
const MapContainer = ({ children }) => <div>{children}</div>;

beforeEach(() => {
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => (String(url).includes("water-levels") || String(url).includes("rain-stations")
      ? { success: true, stations: [] }
      : { success: true, data: [] })
  }));
});

test("โหลดเฉพาะชั้นที่เปิด และไม่โหลดซ้ำเมื่อ render ใหม่", async () => {
  const layers = { waterStations: true, hospitals: true };
  const { rerender } = render(<MapContainer center={[6.86, 99.98]} zoom={10} style={{ height: 200 }}><SituationLayers layers={layers} /></MapContainer>);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  const urls = global.fetch.mock.calls.map(([url]) => url);
  expect(urls.some((u) => u.includes("water-levels"))).toBe(true);
  expect(urls.some((u) => u.includes("health-facilities"))).toBe(true);
  expect(urls.some((u) => u.includes("waterways") || u.includes("area-polygons") || u.includes("rain-stations"))).toBe(false);

  rerender(<MapContainer center={[6.86, 99.98]} zoom={10} style={{ height: 200 }}><SituationLayers layers={{ ...layers, district: true }} /></MapContainer>);
  await waitFor(() => expect(global.fetch.mock.calls.some(([u]) => u.includes("level=district"))).toBe(true));
  expect(global.fetch.mock.calls.filter(([u]) => u.includes("health-facilities"))).toHaveLength(1);
});
