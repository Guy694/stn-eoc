import { FLOOD_FLAGS, TRIGGER_STAGES, areaLabel, declarationFlag, declarationFor, highestFlag, matchesStageTarget, stageTitle, validateDeclaration } from "@/lib/floodTriggers";

describe("floodTriggers", () => {
  test("stages follow the SAT table", () => {
    expect(TRIGGER_STAGES.map((stage) => stage.key)).toEqual(["t0", "t1_green", "t1_yellow", "t1_red", "t2", "t3", "t4", "t5", "t6"]);
    expect(FLOOD_FLAGS.map((flag) => flag.meaning)).toEqual(["เฝ้าระวัง", "เตรียมพร้อมเคลื่อนย้าย", "เคลื่อนย้าย"]);
    for (const stage of TRIGGER_STAGES) expect(stage.actions.length).toBeGreaterThan(0);
    expect(stageTitle("t1_yellow")).toBe("Trigger 1 เตรียมเคลื่อนย้าย (ธงเหลือง)");
    expect(stageTitle("t3")).toBe("Trigger 3 เคลื่อนย้ายฉุกเฉิน");
  });

  test("targets by colour group and status", () => {
    const red = { vulnerable_type: "bedridden", status: "waiting" };
    const yellow = { vulnerable_type: "pregnant", status: "waiting" };
    const green = { vulnerable_type: "elderly", care_group: "green", status: "waiting" };
    expect(matchesStageTarget(red, "t1_yellow")).toBe(true);
    expect(matchesStageTarget(yellow, "t1_yellow")).toBe(false);
    expect(matchesStageTarget(yellow, "t1_red")).toBe(true);
    expect(matchesStageTarget(green, "t1_red")).toBe(false);
    expect(matchesStageTarget({ ...red, status: "moved" }, "t1_red")).toBe(false);
    expect(matchesStageTarget({ ...green }, "t2")).toBe(true);
    expect(matchesStageTarget({ ...red, status: "moved" }, "t5")).toBe(true);
    expect(matchesStageTarget({ ...red, status: "waiting" }, "t5")).toBe(false);
    expect(matchesStageTarget({ ...red, status: "returned" }, "t6")).toBe(true);
    expect(matchesStageTarget({ ...yellow, status: "assisted" }, "t4")).toBe(true);
  });

  test("most specific declaration applies", () => {
    const declarations = [
      { id: 1, district: null, tambon: null, stage: "t1_green" },
      { id: 2, district: "ละงู", tambon: null, stage: "t1_yellow" },
      { id: 3, district: "ละงู", tambon: "ปากน้ำ", stage: "t1_red" },
      { id: 4, district: "ควนโดน", tambon: null, stage: null }
    ];
    expect(declarationFor(declarations, "ละงู", "ปากน้ำ").id).toBe(3);
    expect(declarationFor(declarations, "ละงู", "กำแพง").id).toBe(2);
    expect(declarationFor(declarations, "ควนโดน", "ย่านซื่อ").id).toBe(1);
    expect(declarationFor([], "ละงู", "ปากน้ำ")).toBeNull();
    expect(highestFlag(declarations)).toBe("red");
    expect(declarationFlag({ stage: "t3" })).toBe("red");
    expect(declarationFlag({ stage: "t5" })).toBeNull();
    expect(areaLabel({ district: "ละงู", tambon: "ปากน้ำ" })).toBe("ต.ปากน้ำ อ.ละงู");
    expect(areaLabel({})).toBe("ทั้งจังหวัด");
  });

  test("validateDeclaration", () => {
    expect(validateDeclaration({ district: " ละงู ", tambon: "ปากน้ำ", stage: "t1_red", note: "ถนน 404 น้ำท่วม" }).value).toEqual({ district: "ละงู", tambon: "ปากน้ำ", stage: "t1_red", note: "ถนน 404 น้ำท่วม" });
    expect(validateDeclaration({ tambon: "ปากน้ำ", stage: "t0" }).value).toMatchObject({ district: null, tambon: null });
    expect(validateDeclaration({ district: "ละงู", stage: "" }).value.stage).toBeNull();
    expect(validateDeclaration({ stage: "t9" }).error).toBeTruthy();
  });
});
