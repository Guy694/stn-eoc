import { withTrailingSlash } from "@/lib/adminApi";

describe("withTrailingSlash", () => {
  test("adds slash before query/hash for app paths only", () => {
    expect(withTrailingSlash("/stn-eoc/api/eoc/oxygen?eoc=flood")).toBe("/stn-eoc/api/eoc/oxygen/?eoc=flood");
    expect(withTrailingSlash("/stn-eoc/api/x/")).toBe("/stn-eoc/api/x/");
    expect(withTrailingSlash("/stn-eoc/api/x")).toBe("/stn-eoc/api/x/");
    expect(withTrailingSlash("https://example.org/a")).toBe("https://example.org/a");
    expect(withTrailingSlash("/stn-eoc/data.json")).toBe("/stn-eoc/data.json");
  });
});
