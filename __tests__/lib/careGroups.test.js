import { CARE_GROUPS, careGroupRank, defaultCareGroup, effectiveCareGroup, isCareGroup } from "@/lib/careGroups";
import { VULNERABLE_TYPES } from "@/lib/vulnerableEvent";
import { filterPersons, isPriorityPerson, sortByUrgency, summarizePersons, validatePerson } from "@/lib/vulnerablePersons";

describe("careGroups", () => {
  test("every vulnerable type has a default colour", () => {
    for (const type of VULNERABLE_TYPES) expect(isCareGroup(defaultCareGroup(type.key))).toBe(true);
    expect(defaultCareGroup("bedridden")).toBe("red");
    expect(defaultCareGroup("dialysis_hd")).toBe("red");
    expect(defaultCareGroup("pregnant")).toBe("yellow");
    expect(defaultCareGroup("elderly", true)).toBe("red");
    expect(CARE_GROUPS.map((group) => group.key)).toEqual(["red", "yellow", "green"]);
  });

  test("assessed colour wins over default", () => {
    expect(effectiveCareGroup({ vulnerable_type: "elderly" })).toBe("yellow");
    expect(effectiveCareGroup({ vulnerable_type: "elderly", care_group: "green" })).toBe("green");
    expect(effectiveCareGroup({ vulnerable_type: "elderly", care_group: "bogus" })).toBe("yellow");
    expect(effectiveCareGroup({ vulnerable_type: "chronic_illness", power_dependent: true })).toBe("red");
    expect(careGroupRank({ vulnerable_type: "bedridden" })).toBe(3);
  });

  test("validatePerson keeps care group and power dependency", () => {
    const base = { name: "[ทดสอบ] ก", vulnerable_type: "elderly", district: "เมืองสตูล", tambon: "พิมาน" };
    expect(validatePerson({ ...base, care_group: "green", power_dependent: true }).value).toMatchObject({ care_group: "green", power_dependent: true });
    expect(validatePerson({ ...base, care_group: "", power_dependent: "0" }).value).toMatchObject({ care_group: null, power_dependent: false });
    expect(validatePerson({ ...base, care_group: "purple" }).value.care_group).toBeNull();
  });

  test("priority, filter, sort and summary use colour groups", () => {
    const people = [
      { id: 1, name: "ก", vulnerable_type: "elderly", status: "waiting" },
      { id: 2, name: "ข", vulnerable_type: "elderly", care_group: "red", status: "waiting" },
      { id: 3, name: "ค", vulnerable_type: "bedridden", care_group: "green", status: "waiting" },
      { id: 4, name: "ง", vulnerable_type: "disabled", status: "waiting" }
    ];
    expect(isPriorityPerson(people[1])).toBe(true);
    expect(isPriorityPerson(people[2])).toBe(false);
    expect(filterPersons(people, { care: "red" }).map((p) => p.id)).toEqual([2]);
    expect(sortByUrgency(people)[0].id).toBe(2);
    expect(sortByUrgency(people).at(-1).id).toBe(3);
    expect(summarizePersons(people).byCare).toEqual({ red: 1, yellow: 2, green: 1 });
  });
});

describe("follow-up after returning home", () => {
  const { followUpState, matchesQuickFilter } = require("@/lib/vulnerablePersons");
  test("due at 24h, late at 48h", () => {
    const now = Date.parse("2026-10-14T12:00:00Z");
    const person = (hoursAgo) => ({ status: "returned", status_updated_at: new Date(now - hoursAgo * 3600000).toISOString() });
    expect(followUpState(person(5), now).key).toBe("soon");
    expect(followUpState(person(30), now).key).toBe("due");
    expect(followUpState(person(50), now).key).toBe("late");
    expect(followUpState({ status: "moved", status_updated_at: new Date(now).toISOString() }, now)).toBeNull();
    expect(matchesQuickFilter({ status: "returned" }, "follow_up")).toBe(true);
    expect(matchesQuickFilter({ status: "moved" }, "follow_up")).toBe(false);
  });
});
