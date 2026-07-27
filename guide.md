# คู่มือเขียน JSX และแก้ระบบ STN-EOC ด้วยตนเอง

คู่มือนี้เขียนสำหรับโปรเจกต์นี้โดยเฉพาะ เพื่อให้สามารถเพิ่มหน้า แก้ component เชื่อม API และตรวจสอบงานได้เองเมื่อไม่มี Agent ช่วย

โปรเจกต์นี้ใช้:

- Next.js 16 แบบ App Router
- React 19
- JavaScript และ JSX
- Tailwind CSS
- MySQL
- Jest สำหรับทดสอบ
- path หลักของระบบคือ `/stn-eoc`

> หลักสำคัญ: `.jsx` ไม่ใช่ภาษาใหม่ แต่คือ JavaScript ที่อนุญาตให้เขียนหน้าตา HTML ไว้ในโค้ดได้

---

## 1. เริ่มต้นอย่างปลอดภัย

เปิด Terminal แล้วเข้าโฟลเดอร์โปรเจกต์:

```bash
cd /Users/skyline/dev/stn-eoc
```

ตรวจสอบไฟล์ที่ถูกแก้ก่อนเริ่ม:

```bash
git status
```

สร้าง branch ใหม่ก่อนแก้งานใหญ่:

```bash
git switch -c feature/ชื่อสิ่งที่จะทำ
```

ติดตั้ง package ตาม `package-lock.json`:

```bash
npm ci
```

เปิดระบบสำหรับพัฒนา:

```bash
npm run dev
```

จากนั้นเปิด:

```text
http://localhost:3000/stn-eoc
```

คำสั่งตรวจงานที่ควรรันทุกครั้ง:

```bash
npm run lint
npm test
npm run build
```

- `lint` ตรวจรูปแบบและข้อผิดพลาดของโค้ด
- `test` รันชุดทดสอบ
- `build` ตรวจว่าระบบสร้างสำหรับ production ได้จริง

อย่าแก้ไฟล์ใน `node_modules` หรือ `.next` เพราะเป็นไฟล์ที่ระบบสร้างใหม่ได้

---

## 2. รู้จักโครงสร้างโปรเจกต์

โฟลเดอร์สำคัญ:

```text
app/             หน้าเว็บและ API ตามระบบ App Router
components/      component ที่ใช้ร่วมกันหลายหน้า
context/         state กลาง เช่น ผู้ใช้และ EOC
lib/             ฟังก์ชันช่วย, auth, database, validation
src/features/    feature ที่แยกเป็นหมวดอย่างเป็นระบบ
public/          รูปและไฟล์สาธารณะ
__tests__/       ชุดทดสอบ
migrations/      คำสั่งแก้โครงสร้างฐานข้อมูล
scripts/         script สำหรับ import, backup และงานดูแลระบบ
```

ตัวอย่างการจับคู่ URL กับไฟล์:

```text
app/login/page.jsx
=> /stn-eoc/login

app/eoc/vulnerable-groups/page.jsx
=> /stn-eoc/eoc/vulnerable-groups

app/api/analytics/route.js
=> /stn-eoc/api/analytics
```

ชื่อพิเศษใน App Router:

```text
page.jsx       เนื้อหาหลักของ URL
layout.jsx     layout ครอบหน้าลูก
loading.jsx    หน้าระหว่างโหลด
error.jsx      หน้ารับข้อผิดพลาด
not-found.jsx  หน้าไม่พบข้อมูล
route.js       API endpoint
```

โฟลเดอร์แบบ `[id]` คือ dynamic route เช่น:

```text
app/api/admin/officers/[id]/route.js
```

รองรับ URL เช่น:

```text
/stn-eoc/api/admin/officers/25
```

---

## 3. พื้นฐาน JavaScript ที่ต้องใช้กับ JSX

### 3.1 การประกาศตัวแปร

ใช้ `const` เป็นค่าเริ่มต้น ถ้าจำเป็นต้องเปลี่ยนค่าจึงใช้ `let` หลีกเลี่ยง `var`

```jsx
const province = "สตูล";
const total = 10;
const isActive = true;

let page = 1;
page = page + 1;
```

`const` ป้องกันการกำหนดค่าตัวแปรใหม่ แต่ object และ array ภายในยังเปลี่ยนได้ อย่างไรก็ตามใน React ไม่ควรแก้ของเดิมโดยตรง

```jsx
const user = { name: "สมชาย", role: "staff" };

// ไม่แนะนำใน React
user.name = "สมหญิง";

// แนะนำ: สร้าง object ใหม่
const updatedUser = {
  ...user,
  name: "สมหญิง",
};
```

### 3.2 ชนิดข้อมูล

```jsx
const title = "รายงาน";                    // string
const count = 12;                          // number
const enabled = true;                      // boolean
const missing = null;                      // ตั้งใจให้ไม่มีค่า
let notAssigned;                           // undefined
const tags = ["น้ำท่วม", "ฉุกเฉิน"];          // array
const report = { id: 1, status: "draft" }; // object
```

ตรวจชนิดข้อมูล:

```jsx
typeof title;              // "string"
Array.isArray(tags);       // true
report === null;           // false
```

### 3.3 String และ template literal

```jsx
const name = "SAT";
const message = `กำลังเปิดหน้าของทีม ${name}`;
```

ใช้ backtick `` ` `` เมื่อต้องแทรกค่าด้วย `${...}`

### 3.4 Array ที่ใช้บ่อย

```jsx
const reports = [
  { id: 1, title: "รายงานเช้า", status: "approved" },
  { id: 2, title: "รายงานบ่าย", status: "draft" },
];

const titles = reports.map((item) => item.title);
const approved = reports.filter((item) => item.status === "approved");
const firstDraft = reports.find((item) => item.status === "draft");
const hasDraft = reports.some((item) => item.status === "draft");
const totalId = reports.reduce((sum, item) => sum + item.id, 0);
```

เพิ่ม ลบ และแก้ item โดยไม่เปลี่ยน array เดิม:

```jsx
const added = [...reports, { id: 3, title: "รายงานเย็น", status: "draft" }];

const removed = reports.filter((item) => item.id !== 1);

const updated = reports.map((item) =>
  item.id === 2
    ? { ...item, status: "approved" }
    : item
);
```

### 3.5 Object และ destructuring

```jsx
const officer = {
  id: 7,
  name: "สมชาย",
  role: "staff",
};

const { id, name, role } = officer;

const newOfficer = {
  ...officer,
  role: "commander",
};
```

อ่านค่าที่อาจไม่มีด้วย optional chaining:

```jsx
const teamName = data?.team?.name;
```

กำหนดค่าเริ่มต้นเฉพาะเมื่อค่าเป็น `null` หรือ `undefined`:

```jsx
const displayName = data?.name ?? "ไม่ระบุ";
```

ระวังความต่าง:

```jsx
const valueA = 0 || 100;  // ได้ 100 เพราะ 0 เป็น falsy
const valueB = 0 ?? 100;  // ได้ 0 เพราะ 0 ไม่ใช่ null/undefined
```

### 3.6 เงื่อนไข

```jsx
if (!user) {
  return "ไม่พบผู้ใช้";
}

if (user.role === "admin") {
  return "ผู้ดูแลระบบ";
} else {
  return "เจ้าหน้าที่";
}
```

ternary ใช้เมื่อมีสองทางเลือกสั้นๆ:

```jsx
const label = isActive ? "เปิดใช้งาน" : "ปิดใช้งาน";
```

### 3.7 ฟังก์ชัน

แบบปกติ:

```jsx
function add(a, b) {
  return a + b;
}
```

แบบ arrow function:

```jsx
const add = (a, b) => {
  return a + b;
};

const double = (number) => number * 2;
```

ฟังก์ชัน async:

```jsx
async function loadReports() {
  const response = await fetch("/stn-eoc/api/reports");
  const data = await response.json();
  return data;
}
```

`await` ใช้ได้ภายในฟังก์ชันที่มี `async` เท่านั้น

### 3.8 try/catch/finally

```jsx
async function saveData() {
  try {
    setSaving(true);
    // งานที่อาจเกิดข้อผิดพลาด
  } catch (error) {
    console.error("Save error:", error);
    setError("บันทึกข้อมูลไม่สำเร็จ");
  } finally {
    setSaving(false);
  }
}
```

`finally` จะทำงานเสมอ จึงเหมาะกับการปิดสถานะ loading

---

## 4. JSX คืออะไร

JSX ทำให้เขียนหน้าตา UI ใน JavaScript:

```jsx
const title = "ศูนย์ปฏิบัติการ";

export default function ExamplePage() {
  return (
    <main>
      <h1>{title}</h1>
      <p>จังหวัดสตูล</p>
    </main>
  );
}
```

กฎสำคัญ:

1. component ต้องคืน element หลักหนึ่งก้อน
2. แทรก JavaScript ใน JSX ด้วย `{...}`
3. ใช้ `className` แทน `class`
4. ใช้ `htmlFor` แทน `for`
5. tag ที่ไม่มีลูกต้องปิด เช่น `<input />`
6. event ใช้ camelCase เช่น `onClick`, `onChange`
7. comment ใน JSX ใช้ `{/* ความเห็น */}`

ตัวอย่าง:

```jsx
export default function StatusBox() {
  const active = true;

  return (
    <section className="rounded-lg bg-white p-4">
      {/* แสดงข้อความตามสถานะ */}
      <p>{active ? "กำลังปฏิบัติการ" : "ปิดเหตุการณ์"}</p>
      <input type="text" aria-label="ชื่อเหตุการณ์" />
    </section>
  );
}
```

ถ้าไม่ต้องการ element ครอบที่ปรากฏใน HTML ให้ใช้ Fragment:

```jsx
return (
  <>
    <h1>หัวข้อ</h1>
    <p>รายละเอียด</p>
  </>
);
```

---

## 5. Component

Component คือฟังก์ชันที่คืน JSX ชื่อต้องขึ้นต้นด้วยตัวพิมพ์ใหญ่

```jsx
function AlertBox() {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      เกิดข้อผิดพลาด
    </div>
  );
}
```

ใช้งานเหมือน tag:

```jsx
export default function Page() {
  return (
    <main>
      <AlertBox />
    </main>
  );
}
```

### 5.1 Props

Props คือค่าที่ component แม่ส่งให้ component ลูก

```jsx
function SummaryCard({ label, value, detail = "" }) {
  return (
    <article className="border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value ?? "-"}</p>
      {detail ? <p className="text-xs">{detail}</p> : null}
    </article>
  );
}

export default function Page() {
  return (
    <SummaryCard
      label="ผู้ได้รับผลกระทบ"
      value={1250}
      detail="ข้อมูลล่าสุดวันนี้"
    />
  );
}
```

ข้อความเขียนตรงๆ ได้ แต่ number, boolean, object, array และฟังก์ชันต้องส่งใน `{}`:

```jsx
<Example title="ข้อความ" count={5} active={true} data={{ id: 1 }} />
```

ห้ามแก้ props ภายใน component ลูก เพราะ props เป็นค่าจากภายนอก

### 5.2 children

`children` คือสิ่งที่อยู่ระหว่าง tag เปิดและปิด:

```jsx
function Panel({ title, children }) {
  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

<Panel title="รายละเอียด">
  <p>เนื้อหาด้านใน</p>
</Panel>
```

### 5.3 แยก component เมื่อใด

ควรแยกเมื่อ:

- UI ก้อนนั้นใช้ซ้ำ
- component เดิมยาวและอ่านยาก
- ก้อนนั้นมีหน้าที่ชัดเจน เช่น Modal, Form, Table
- ต้องทดสอบแยก

ไม่จำเป็นต้องแยกทุก `<div>` ออกเป็น component

---

## 6. Import และ Export

Default export:

```jsx
export default function SummaryCard() {
  return <div>Card</div>;
}
```

นำเข้าโดยไม่ใช้วงเล็บปีกกา และตั้งชื่อใหม่ได้:

```jsx
import SummaryCard from "@/components/SummaryCard";
```

Named export:

```jsx
export function formatNumber(value) {
  return Number(value).toLocaleString("th-TH");
}

export const STATUS = ["draft", "approved"];
```

นำเข้าด้วยชื่อเดิมในวงเล็บปีกกา:

```jsx
import { formatNumber, STATUS } from "@/lib/report";
```

โปรเจกต์นี้ตั้ง alias ไว้ให้ `@/` หมายถึง root ของโปรเจกต์:

```jsx
import { useAuth } from "@/context/AuthContext";
```

ควรใช้ `@/` เมื่ออ้างจากโฟลเดอร์หลัก เพื่อไม่ต้องเขียน `../../../`

---

## 7. Server Component กับ Client Component

ใน Next.js App Router ไฟล์ component เป็น Server Component โดยค่าเริ่มต้น

### Server Component

เหมาะกับ:

- อ่านข้อมูลบน server
- ใช้ secret หรือฐานข้อมูล
- แสดงเนื้อหาที่ไม่ต้องโต้ตอบทันที
- ลด JavaScript ที่ส่งไป browser

```jsx
export default async function Page() {
  const data = await loadDataOnServer();

  return <h1>{data.title}</h1>;
}
```

### Client Component

ต้องใส่ `"use client";` เป็นบรรทัดแรกเมื่อใช้:

- `useState`, `useEffect`, `useContext`
- event เช่น `onClick`, `onChange`, `onSubmit`
- `window`, `document`, `localStorage`
- hook จาก `next/navigation`

```jsx
"use client";

import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount((current) => current + 1)}>
      จำนวน {count}
    </button>
  );
}
```

อย่าใส่ `"use client"` ให้ทุกไฟล์โดยไม่จำเป็น และอย่านำ `db`, secret หรือโค้ด server เข้า Client Component

ข้อจำกัดสำคัญ: props ที่ Server Component ส่งให้ Client Component ควรเป็นค่าที่แปลงเป็น JSON ได้ เช่น string, number, boolean, array และ plain object

---

## 8. State ด้วย useState

State คือข้อมูลที่เปลี่ยนแล้วทำให้หน้าจอ render ใหม่

```jsx
"use client";

import { useState } from "react";

export default function Example() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({
    title: "",
    amount: 0,
  });

  return <p>{name}</p>;
}
```

รูปแบบคือ:

```jsx
const [ค่าปัจจุบัน, ฟังก์ชันเปลี่ยนค่า] = useState(ค่าเริ่มต้น);
```

อัปเดต object:

```jsx
setForm((current) => ({
  ...current,
  title: "รายงานใหม่",
}));
```

อัปเดตจากค่าเดิม:

```jsx
setCount((current) => current + 1);
```

ห้ามทำ:

```jsx
form.title = "รายงานใหม่";
records.push(newRecord);
```

เพราะ React อาจไม่ทราบว่าค่าถูกเปลี่ยน

State เป็น asynchronous จึงอย่าคาดว่าค่าจะเปลี่ยนทันทีในบรรทัดถัดไป:

```jsx
setCount(count + 1);
console.log(count); // อาจยังเป็นค่าเก่า
```

---

## 9. Event

ส่งฟังก์ชันให้ event ห้ามเรียกฟังก์ชันทันที:

```jsx
function handleClick() {
  console.log("clicked");
}

<button onClick={handleClick}>กด</button>
```

ถ้าต้องส่ง argument ใช้ arrow function:

```jsx
<button onClick={() => deleteRecord(record.id)}>ลบ</button>
```

ผิด:

```jsx
<button onClick={deleteRecord(record.id)}>ลบ</button>
```

แบบผิดจะเรียก `deleteRecord` ระหว่าง render

event object:

```jsx
function handleChange(event) {
  console.log(event.target.name);
  console.log(event.target.value);
}
```

---

## 10. Form แบบสมบูรณ์

```jsx
"use client";

import { useState } from "react";

const emptyForm = {
  title: "",
  amount: 0,
  urgent: false,
};

export default function ReportForm() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/stn-eoc/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount) || 0,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "บันทึกข้อมูลไม่สำเร็จ");
      }

      setForm(emptyForm);
    } catch (caughtError) {
      console.error("Submit report error:", caughtError);
      setError(caughtError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      ) : null}

      <label className="block">
        <span className="mb-1 block font-medium">หัวข้อ</span>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          required
          className="w-full rounded border p-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block font-medium">จำนวน</span>
        <input
          type="number"
          name="amount"
          min="0"
          value={form.amount}
          onChange={handleChange}
          className="w-full rounded border p-2"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="urgent"
          checked={form.urgent}
          onChange={handleChange}
        />
        เร่งด่วน
      </label>

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </form>
  );
}
```

ข้อควรจำ:

- ใส่ `event.preventDefault()` เพื่อไม่ให้ form reload หน้า
- input ที่ควบคุมด้วย React ต้องมี `value`/`checked` และ `onChange`
- ค่าจาก `<input type="number">` ยังเป็น string ต้องแปลงด้วย `Number`
- ปิดปุ่มระหว่างบันทึกเพื่อป้องกันการส่งซ้ำ
- validation ฝั่ง browser ช่วยผู้ใช้ แต่ API ต้องตรวจซ้ำเสมอ

---

## 11. การแสดงผลตามเงื่อนไข

แสดงหรือไม่แสดง:

```jsx
{error ? <p>{error}</p> : null}
```

ใช้ `&&` ได้เมื่อค่าด้านซ้ายเป็น boolean:

```jsx
{isAdmin && <button>จัดการระบบ</button>}
```

ระวัง:

```jsx
{records.length && <Table />}
```

ถ้าไม่มีข้อมูล อาจแสดงเลข `0` บนหน้า ควรเขียน:

```jsx
{records.length > 0 ? <Table /> : <EmptyState />}
```

หลายสถานะ:

```jsx
if (loading) {
  return <p>กำลังโหลด...</p>;
}

if (error) {
  return <p role="alert">{error}</p>;
}

if (!records.length) {
  return <p>ยังไม่มีข้อมูล</p>;
}

return <ReportTable records={records} />;
```

รูปแบบ early return มักอ่านง่ายกว่า ternary ซ้อนหลายชั้น

---

## 12. การวนรายการและ key

```jsx
const records = [
  { id: 11, title: "รายการ A" },
  { id: 12, title: "รายการ B" },
];

return (
  <ul>
    {records.map((record) => (
      <li key={record.id}>{record.title}</li>
    ))}
  </ul>
);
```

`key` ต้อง:

- ไม่ซ้ำในรายการเดียวกัน
- คงที่เมื่อรายการเปลี่ยน
- ควรใช้ id จากฐานข้อมูล

หลีกเลี่ยง `key={index}` ถ้ารายการสามารถเพิ่ม ลบ เรียง หรือแก้ไขได้

---

## 13. useEffect และการโหลดข้อมูล

`useEffect` ใช้เชื่อม React กับสิ่งภายนอก เช่น API, timer, event listener

```jsx
"use client";

import { useEffect, useState } from "react";

export default function ReportList() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecords() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/stn-eoc/api/reports", {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "โหลดข้อมูลไม่สำเร็จ");
        }

        setRecords(result.data || []);
      } catch (caughtError) {
        if (caughtError.name !== "AbortError") {
          console.error("Load reports error:", caughtError);
          setError(caughtError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    return () => controller.abort();
  }, []);

  if (loading) return <p>กำลังโหลด...</p>;
  if (error) return <p role="alert">{error}</p>;

  return records.map((record) => (
    <p key={record.id}>{record.title}</p>
  ));
}
```

dependency array:

```jsx
useEffect(() => {
  // ทำหลังทุก render
});

useEffect(() => {
  // ทำหลัง mount หนึ่งครั้ง
}, []);

useEffect(() => {
  // ทำเมื่อ district เปลี่ยน
}, [district]);
```

ถ้า effect สร้าง timer หรือ listener ต้อง cleanup:

```jsx
useEffect(() => {
  const intervalId = setInterval(refreshData, 60000);
  return () => clearInterval(intervalId);
}, []);
```

อย่าทำ effect เป็น async โดยตรง:

```jsx
// ไม่แนะนำ
useEffect(async () => {}, []);

// แนะนำ
useEffect(() => {
  async function load() {}
  load();
}, []);
```

---

## 14. useMemo, useCallback และ useContext

### useMemo

ใช้จำผลการคำนวณที่มีต้นทุน หรือคำนวณรายการจาก state:

```jsx
const filteredRecords = useMemo(() => {
  return records.filter((item) => item.district === selectedDistrict);
}, [records, selectedDistrict]);
```

ไม่ต้องใช้กับการคำนวณเล็กน้อยทุกจุด

### useCallback

ใช้จำตัวฟังก์ชัน โดยเฉพาะเมื่อฟังก์ชันเป็น dependency ของ effect หรือส่งให้ component ที่ optimize ไว้:

```jsx
const fetchRecords = useCallback(async () => {
  // load data
}, [selectedDistrict]);

useEffect(() => {
  fetchRecords();
}, [fetchRecords]);
```

### useContext

ใช้ข้อมูลกลางโดยไม่ต้องส่ง props ผ่านหลายชั้น โปรเจกต์นี้มีตัวอย่างจริง:

```jsx
import { useAuth } from "@/context/AuthContext";

export default function Profile() {
  const { user, logout, hasPermission } = useAuth();

  return (
    <section>
      <p>{user?.name ?? "ไม่พบชื่อ"}</p>
      {hasPermission("eoc", "edit") ? <button>แก้ไข</button> : null}
      <button onClick={logout}>ออกจากระบบ</button>
    </section>
  );
}
```

อย่าซ่อนปุ่มอย่างเดียวเพื่อรักษาความปลอดภัย API ต้องตรวจสิทธิ์อีกครั้งเสมอ

---

## 15. สร้างหน้าใหม่

ตัวอย่างสร้างหน้า `/stn-eoc/example`

สร้างไฟล์:

```text
app/example/page.jsx
```

เนื้อหา:

```jsx
export const metadata = {
  title: "หน้าตัวอย่าง",
};

export default function ExamplePage() {
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">หน้าตัวอย่าง</h1>
      <p className="mt-2 text-slate-600">เนื้อหาของหน้า</p>
    </main>
  );
}
```

ถ้าหน้ามี state หรือ event:

```jsx
"use client";

import { useState } from "react";

export default function ExamplePage() {
  const [open, setOpen] = useState(false);

  return (
    <main>
      <button onClick={() => setOpen(true)}>เปิด</button>
      {open ? <p>เปิดแล้ว</p> : null}
    </main>
  );
}
```

Client Component ไม่ควร export `metadata` จากไฟล์เดียวกัน ถ้าต้องใช้ทั้งสองอย่าง ให้คง `page.jsx` เป็น Server Component แล้วนำ Client Component จากอีกไฟล์เข้ามา

```text
app/example/page.jsx
app/example/example-client.jsx
```

---

## 16. Link, Navigation และ URL

ลิงก์ภายในใช้ `Link`:

```jsx
import Link from "next/link";

<Link href="/dashboard">ไป Dashboard</Link>
```

Next.js จะเติม `basePath` `/stn-eoc` ให้ `Link` และ router

เปลี่ยนหน้าจาก event:

```jsx
"use client";

import { useRouter } from "next/navigation";

export default function SaveButton() {
  const router = useRouter();

  function finish() {
    router.push("/dashboard");
  }

  return <button onClick={finish}>เสร็จสิ้น</button>;
}
```

อ่าน query string:

```jsx
import { useSearchParams } from "next/navigation";

const searchParams = useSearchParams();
const sessionId = searchParams.get("sessionId");
```

สำหรับ `fetch` ในโค้ดปัจจุบัน ให้สังเกตว่าหลายจุดเรียก URL เต็มด้วย `/stn-eoc/api/...`:

```jsx
await fetch("/stn-eoc/api/analytics");
```

ควรทำตามรูปแบบของ feature ใกล้เคียง อย่าสลับ path โดยเดา เพราะโปรเจกต์มี `basePath` และ rewrite เฉพาะบางกรณี

---

## 17. รูปภาพและ icon

รูปใน `public/img/logo.png` อ้างบนหน้าเว็บเป็น:

```jsx
import Image from "next/image";

<Image
  src="/stn-eoc/img/logo.png"
  alt="ตราสัญลักษณ์ EOC"
  width={80}
  height={80}
/>
```

ทุกภาพควรมี `alt` ที่อธิบายภาพ ถ้าเป็นภาพตกแต่งล้วนใช้ `alt=""`

icon ใช้ `lucide-react`:

```jsx
import { AlertTriangle, Save } from "lucide-react";

<Save className="h-5 w-5" aria-hidden="true" />
```

ถ้าปุ่มมีแต่ icon ต้องมีชื่อสำหรับ screen reader:

```jsx
<button aria-label="บันทึก">
  <Save aria-hidden="true" />
</button>
```

---

## 18. Tailwind CSS ในโปรเจกต์

เขียน class ใน `className`:

```jsx
<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
  เนื้อหา
</div>
```

ตัวอย่างกลุ่ม class:

```text
p-4, px-4, py-2         ระยะด้านใน
m-4, mt-2, mb-6         ระยะด้านนอก
flex, grid               layout
items-center             จัดแนวตั้งใน flex
justify-between          กระจายแนวนอน
gap-4                    ช่องว่างระหว่างลูก
w-full, max-w-7xl        ความกว้าง
text-sm, text-2xl        ขนาดตัวอักษร
font-medium, font-bold   น้ำหนักตัวอักษร
bg-blue-700              สีพื้นหลัง
text-white               สีตัวอักษร
border, rounded-lg       เส้นขอบและมุม
hover:bg-blue-800        เมื่อเอาเมาส์ชี้
disabled:opacity-50      เมื่อ disabled
sm:, md:, lg:, xl:       responsive breakpoint
```

ตัวอย่าง responsive:

```jsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
  ...
</div>
```

เริ่มจากจอเล็กก่อน แล้วเพิ่ม `md:` และ `xl:` สำหรับจอใหญ่

หลีกเลี่ยง class ที่ประกอบแบบ dynamic:

```jsx
// อาจไม่ถูก Tailwind ตรวจพบ
const className = `bg-${color}-500`;
```

ใช้ mapping ที่เขียน class เต็มแทน:

```jsx
const toneClasses = {
  success: "bg-emerald-500 text-white",
  danger: "bg-red-500 text-white",
};

<div className={toneClasses[tone] ?? toneClasses.success} />
```

---

## 19. เรียก API จากหน้า JSX

### GET

```jsx
const response = await fetch("/stn-eoc/api/reports");
const result = await response.json();

if (!response.ok) {
  throw new Error(result.message || `HTTP ${response.status}`);
}
```

### GET พร้อม query string

```jsx
const params = new URLSearchParams();
params.set("district", selectedDistrict);
params.set("page", String(page));

const response = await fetch(`/stn-eoc/api/reports?${params.toString()}`);
```

### POST

```jsx
const response = await fetch("/stn-eoc/api/reports", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title,
    amount: Number(amount),
  }),
});
```

### PUT, PATCH, DELETE

```jsx
await fetch(`/stn-eoc/api/reports/${id}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

await fetch(`/stn-eoc/api/reports/${id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "approved" }),
});

await fetch(`/stn-eoc/api/reports/${id}`, {
  method: "DELETE",
});
```

ความหมายทั่วไป:

```text
GET     อ่านข้อมูล
POST    สร้างข้อมูลใหม่
PUT     แทนข้อมูลทั้งก้อน
PATCH   แก้บาง field
DELETE  ลบข้อมูล
```

ตรวจทั้ง `response.ok` และรูปแบบผลลัพธ์ของ API อย่าถือว่า `fetch` จะ throw เมื่อได้ HTTP 400 หรือ 500 เพราะ `fetch` จะ throw หลักๆ เมื่อเชื่อมต่อไม่ได้

---

## 20. สร้าง API Route

สร้าง:

```text
app/api/example/route.js
```

ตัวอย่าง API แบบไม่แตะฐานข้อมูล:

```jsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: [
      { id: 1, title: "ตัวอย่าง" },
    ],
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();

    if (!title) {
      return NextResponse.json(
        { success: false, message: "กรุณาระบุหัวข้อ" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: { id: 1, title },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create example error:", error);

    return NextResponse.json(
      { success: false, message: "เกิดข้อผิดพลาดภายในระบบ" },
      { status: 500 }
    );
  }
}
```

อ่าน query string:

```jsx
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const district = searchParams.get("district") || "";

  return NextResponse.json({
    success: true,
    district,
  });
}
```

อ่าน dynamic parameter ใน Next.js รุ่นปัจจุบัน:

```jsx
export async function GET(request, { params }) {
  const { id } = await params;
  return NextResponse.json({ success: true, id });
}
```

HTTP status ที่ใช้บ่อย:

```text
200 สำเร็จ
201 สร้างสำเร็จ
400 ข้อมูลที่ส่งมาไม่ถูกต้อง
401 ยังไม่เข้าสู่ระบบ
403 ไม่มีสิทธิ์
404 ไม่พบข้อมูล
409 ข้อมูลขัดแย้งหรือซ้ำ
500 ข้อผิดพลาดภายใน server
```

---

## 21. API กับฐานข้อมูล

ตัวอย่างรูปแบบในโปรเจกต์:

```jsx
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(request) {
  try {
    const auth = await requireAuth(request, ["admin", "commander", "staff"]);
    if (!auth.success) return auth.response;

    const rows = await db.query(
      `SELECT id, title, status
       FROM reports
       WHERE status = ?
       ORDER BY id DESC`,
      ["approved"]
    );

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Get reports error:", error);

    return NextResponse.json(
      { success: false, message: "โหลดข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
```

ใช้ placeholder `?` เสมอ:

```jsx
await db.query(
  "SELECT * FROM users WHERE username = ?",
  [username]
);
```

ห้ามต่อค่าจากผู้ใช้ลง SQL:

```jsx
// อันตราย: SQL injection
await db.query(`SELECT * FROM users WHERE username = '${username}'`);
```

ตัวอย่าง insert:

```jsx
const result = await db.query(
  `INSERT INTO reports (title, status, created_by)
   VALUES (?, ?, ?)`,
  [title, "draft", auth.user.id]
);
```

ตัวอย่าง update:

```jsx
await db.query(
  `UPDATE reports
   SET title = ?, status = ?
   WHERE id = ?`,
  [title, status, id]
);
```

ตัวอย่าง delete:

```jsx
await db.query(
  "DELETE FROM reports WHERE id = ?",
  [id]
);
```

ก่อนแก้ schema:

1. สำรองฐานข้อมูล
2. สร้าง migration ใหม่ใน `migrations/`
3. ห้ามแก้ migration เก่าที่เคยใช้จริงแล้ว
4. ทดสอบกับฐานทดสอบก่อน production
5. งานหลายคำสั่งที่ต้องสำเร็จพร้อมกันควรใช้ transaction ตาม API ที่ `lib/db` รองรับ

---

## 22. Validation และความปลอดภัย

อย่าเชื่อข้อมูลจาก browser แม้หน้า form จะมี `required`, `min` หรือ select ก็ตาม

API ต้องตรวจ:

- ผู้ใช้เข้าสู่ระบบหรือไม่
- role และ permission
- field ที่จำเป็น
- ชนิดและช่วงของตัวเลข
- ค่าที่อนุญาต
- ความยาวข้อความ
- record ที่อ้างถึงมีอยู่จริงหรือไม่

ตัวอย่างตรวจแบบพื้นฐาน:

```jsx
const amount = Number(body.amount);
const allowedStatuses = ["draft", "submitted", "approved"];

if (!Number.isFinite(amount) || amount < 0) {
  return NextResponse.json(
    { success: false, message: "จำนวนไม่ถูกต้อง" },
    { status: 400 }
  );
}

if (!allowedStatuses.includes(body.status)) {
  return NextResponse.json(
    { success: false, message: "สถานะไม่ถูกต้อง" },
    { status: 400 }
  );
}
```

โปรเจกต์มี `zod` แล้ว จึงสามารถสร้าง schema สำหรับ validation ที่ซับซ้อน โดยดูตัวอย่างใน `src/features/**/schemas/`

ห้าม:

- ส่ง password, token หรือ secret กลับไป client
- เขียน secret ลง JSX
- ใช้ตัวแปร environment ที่เป็น secret ใน Client Component
- แสดง `error.stack` หรือรายละเอียดฐานข้อมูลให้ผู้ใช้ production
- เชื่อ `userId` หรือ `role` ที่ client ส่งมา ให้ใช้ตัวตนจาก session
- ใช้ `dangerouslySetInnerHTML` กับข้อความจากผู้ใช้

ตัวแปรที่จะเปิดให้ browser เห็นต้องขึ้นต้น `NEXT_PUBLIC_` ดังนั้นอย่าใช้ prefix นี้กับรหัสลับ

---

## 23. Loading, Error และ Empty State

ทุกหน้าที่โหลดข้อมูลควรมีอย่างน้อย 4 สถานะ:

```text
loading  กำลังโหลด
error    โหลดไม่สำเร็จ
empty    สำเร็จแต่ไม่มีข้อมูล
success  มีข้อมูล
```

ตัวอย่าง:

```jsx
if (loading) {
  return <div className="p-8 text-center">กำลังโหลด...</div>;
}

if (error) {
  return (
    <div role="alert" className="border border-red-200 bg-red-50 p-4 text-red-800">
      {error}
    </div>
  );
}

if (records.length === 0) {
  return (
    <div className="border border-slate-200 bg-white p-8 text-center">
      ยังไม่มีข้อมูล
    </div>
  );
}

return <ReportTable records={records} />;
```

สำหรับ route ทั้งหน้า สามารถเพิ่ม:

```text
app/example/loading.jsx
app/example/error.jsx
```

`error.jsx` ต้องเป็น Client Component:

```jsx
"use client";

export default function ErrorPage({ error, reset }) {
  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">เปิดหน้าไม่สำเร็จ</h1>
      <p className="mt-2 text-red-700">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 rounded bg-blue-700 px-4 py-2 text-white"
      >
        ลองใหม่
      </button>
    </main>
  );
}
```

---

## 24. Modal แบบพื้นฐาน

```jsx
function ConfirmModal({ open, title, onConfirm, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded border px-4 py-2">
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-red-700 px-4 py-2 text-white"
          >
            ยืนยัน
          </button>
        </div>
      </div>
    </div>
  );
}
```

สำหรับ production ควรเพิ่มการปิดด้วย Escape, focus trap และคืน focus ไปปุ่มเดิม หรือใช้ dialog component ที่มี accessibility ครบอยู่แล้ว

---

## 25. ตารางข้อมูล

```jsx
function ReportTable({ records, onEdit }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th scope="col" className="px-4 py-3">หัวข้อ</th>
            <th scope="col" className="px-4 py-3">สถานะ</th>
            <th scope="col" className="px-4 py-3">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-t border-slate-200">
              <td className="px-4 py-3">{record.title}</td>
              <td className="px-4 py-3">{record.status}</td>
              <td className="px-4 py-3">
                <button onClick={() => onEdit(record)}>แก้ไข</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

ใส่ `overflow-x-auto` เพื่อให้ตารางเลื่อนได้บนมือถือ

---

## 26. การจัดรูปแบบข้อมูล

ตัวเลขภาษาไทย:

```jsx
const display = Number(value || 0).toLocaleString("th-TH");
```

วันที่:

```jsx
const displayDate = new Date(dateValue).toLocaleDateString("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
```

ตรวจวันไม่ถูกต้อง:

```jsx
function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("th-TH");
}
```

อย่าใช้ `value || "-"` ถ้าเลข `0` เป็นค่าที่ถูกต้อง ให้ใช้:

```jsx
value ?? "-"
```

---

## 27. Custom Hook

ถ้าหลาย component ใช้ logic state/effect เหมือนกัน ให้แยก custom hook ชื่อต้องขึ้นต้นด้วย `use`

```jsx
"use client";

import { useEffect, useState } from "react";

export function useReports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // load records
  }, []);

  return {
    records,
    loading,
    error,
  };
}
```

ใช้:

```jsx
const { records, loading, error } = useReports();
```

กฎของ Hook:

- เรียกที่ระดับบนสุดของ component หรือ custom hook
- ห้ามเรียกใน `if`, loop หรือ callback
- เรียกจาก React function เท่านั้น

---

## 28. กฎการตั้งชื่อและจัดไฟล์

แนวทางที่อ่านง่าย:

```text
PascalCase     ชื่อ component เช่น ReportCard
camelCase      ตัวแปรและฟังก์ชัน เช่น reportCount, loadReports
UPPER_SNAKE    constant กลาง เช่น ALLOWED_STATUSES
kebab-case     ชื่อ route และบางชื่อไฟล์ตามรูปแบบเดิมของโปรเจกต์
```

ชื่อ handler:

```text
handleSubmit
handleChange
handleDelete
handleOpenModal
```

ชื่อ boolean:

```text
isLoading
isOpen
hasAccess
canEdit
```

ให้ทำตามรูปแบบโฟลเดอร์ข้างเคียงเป็นหลัก เพราะในโปรเจกต์นี้มีทั้ง component แบบ `PascalCase.jsx` และ `kebab-case.jsx`

---

## 29. การทดสอบ Component

ตัวอย่าง Jest + Testing Library:

```jsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Counter from "@/components/Counter";

test("เพิ่มจำนวนเมื่อกดปุ่ม", async () => {
  const user = userEvent.setup();
  render(<Counter />);

  await user.click(screen.getByRole("button", { name: /เพิ่ม/i }));

  expect(screen.getByText("จำนวน 1")).toBeInTheDocument();
});
```

หลักการ:

- ทดสอบสิ่งที่ผู้ใช้เห็นและทำ
- เลือก element ด้วย role และชื่อก่อนใช้ test id
- ทดสอบ success, error, empty และ permission
- mock เฉพาะขอบระบบ เช่น fetch หรือ database

รันไฟล์เดียว:

```bash
npx jest path/to/file.test.js
```

---

## 30. วิธีทำ feature ใหม่ตั้งแต่ต้นจนจบ

ตัวอย่างต้องการเพิ่มหน้า “รายการคำขอ”

### ขั้นที่ 1: สำรวจของเดิม

ค้นหาหน้าที่ใกล้เคียง:

```bash
rg -n "รายการคำขอ|request" app components src lib
```

ค้นหา API และตารางที่เกี่ยวข้อง:

```bash
rg -n "FROM requests|INSERT INTO requests" app lib src
```

### ขั้นที่ 2: กำหนดข้อมูล

เขียนให้ชัดก่อนว่า:

```text
field: title, detail, status, created_at
สิทธิ์อ่าน: staff ขึ้นไป
สิทธิ์สร้าง: staff ขึ้นไป
สิทธิ์อนุมัติ: commander/admin
สถานะ: draft, submitted, approved, rejected
```

### ขั้นที่ 3: สร้างหรือแก้ฐานข้อมูล

ถ้ายังไม่มีตาราง ให้สร้าง migration และสำรองข้อมูลก่อน อย่าแก้ production โดยไม่มี migration

### ขั้นที่ 4: สร้าง API

```text
app/api/requests/route.js
app/api/requests/[id]/route.js
```

ทำ auth, permission, validation, parameterized SQL และ error response ให้ครบ

### ขั้นที่ 5: ทดสอบ API แยก

ทดสอบอย่างน้อย:

```text
ไม่ได้ login
ไม่มี permission
ข้อมูลไม่ครบ
สร้างสำเร็จ
ไม่พบ id
แก้สำเร็จ
ฐานข้อมูล error
```

### ขั้นที่ 6: สร้างหน้า

```text
app/requests/page.jsx
components/requests/RequestForm.jsx
components/requests/RequestTable.jsx
```

ทำ loading, error, empty, success และ disabled ระหว่าง save

### ขั้นที่ 7: เพิ่ม navigation และ permission

หา registry หรือเมนูที่ feature ใกล้เคียงใช้ อย่าเพิ่มลิงก์อย่างเดียวโดยไม่ป้องกัน route และ API

### ขั้นที่ 8: ตรวจหน้าจอ

ตรวจ:

- มือถือ
- desktop
- ข้อความยาว
- ข้อมูลว่าง
- ตัวเลข 0
- ชื่อภาษาไทย
- กดซ้ำ
- network ช้า
- ไม่มีสิทธิ์

### ขั้นที่ 9: ตรวจด้วยคำสั่ง

```bash
npm run lint
npm test
npm run build
git diff --check
git diff
```

### ขั้นที่ 10: commit

```bash
git add app/api/requests app/requests components/requests
git commit -m "feat: add request management"
```

เลือก `git add` เฉพาะไฟล์ของงาน อย่าใช้ `git add .` โดยไม่ตรวจ

---

## 31. วิธีค้นหาโค้ดก่อนแก้

แสดงรายชื่อไฟล์:

```bash
rg --files
```

ค้นหาคำ:

```bash
rg -n "useAuth" app components context lib src
```

ค้นหา component:

```bash
rg -n "function SummaryCard|<SummaryCard" .
```

ค้นหา API URL:

```bash
rg -n "/api/analytics" .
```

ค้นหา SQL ที่แตะตาราง:

```bash
rg -n "FROM eoc_sessions|JOIN eoc_sessions|UPDATE eoc_sessions" app lib src
```

อ่านไฟล์บางช่วง:

```bash
sed -n '1,220p' path/to/file.jsx
```

หลักปฏิบัติที่ดีคือหา feature ที่ใกล้เคียงที่สุด แล้วทำตามรูปแบบ auth, response, UI และ path ของ feature นั้น

---

## 32. Debug เมื่อระบบมีปัญหา

### หน้าเป็นสีขาว

ตรวจ:

1. Terminal ที่รัน `npm run dev`
2. Browser DevTools > Console
3. component มี `return` หรือไม่
4. import path ถูกหรือไม่
5. ใช้ hook แต่ลืม `"use client"` หรือไม่

### `X is not defined`

ตัวแปรหรือ component ไม่ได้ประกาศ/นำเข้า หรือสะกดชื่อผิด

### `X is not a function`

ตรวจ default/named import และค่าที่ได้จริง:

```jsx
import Thing from "...";     // default
import { Thing } from "..."; // named
```

### `Cannot read properties of undefined`

ข้อมูลบางชั้นยังไม่มี:

```jsx
// เสี่ยง
data.team.name

// ปลอดภัยกว่า
data?.team?.name ?? "-"
```

### `Objects are not valid as a React child`

กำลัง render object ตรงๆ:

```jsx
// ผิด
<p>{user}</p>

// ถูก
<p>{user.name}</p>
```

ระหว่าง debug ชั่วคราว:

```jsx
<pre>{JSON.stringify(user, null, 2)}</pre>
```

### `Each child in a list should have a unique key`

เพิ่ม key ที่คงที่:

```jsx
records.map((record) => <Row key={record.id} record={record} />)
```

### `window is not defined`

โค้ดกำลังทำงานบน server ให้ย้ายไป Client Component และอ่าน `window` ใน event/effect:

```jsx
"use client";

useEffect(() => {
  const value = window.localStorage.getItem("key");
}, []);
```

### API ได้ 404

ตรวจ:

- path ของ `route.js`
- method ตรงกับ `GET/POST/...`
- URL มี `/stn-eoc` ตามรูปแบบ feature หรือไม่
- dynamic segment ครบหรือไม่
- restart dev server หากเพิ่งเปลี่ยน config

### API ได้ HTML แทน JSON

มักเกิดจาก URL ผิด, redirect ไปหน้า login หรือ server error ก่อนถึง API ตรวจ `response.status`, `response.url` และ Network tab ก่อนเรียก `response.json()`

### `Unexpected token < in JSON`

response เป็น HTML ที่ขึ้นต้น `<` ไม่ใช่ JSON ใช้วิธีอ่านอย่างปลอดภัย:

```jsx
const contentType = response.headers.get("content-type") || "";

if (!contentType.includes("application/json")) {
  const text = await response.text();
  throw new Error(`Expected JSON, received: ${text.slice(0, 100)}`);
}

const result = await response.json();
```

### State ไม่เปลี่ยน

ตรวจว่าไม่ได้แก้ array/object เดิม:

```jsx
setRecords((current) =>
  current.map((item) =>
    item.id === id ? { ...item, status: "approved" } : item
  )
);
```

### Effect ยิง API ไม่หยุด

มักเกิดจาก dependency เปลี่ยนทุก render หรือ effect เปลี่ยน state ที่เป็น dependency ของตัวเอง ตรวจ dependency array และใช้ `useCallback` เฉพาะเมื่อจำเป็น

### Hydration mismatch

Server และ browser render ครั้งแรกไม่เหมือนกัน มักเกิดจากใช้ `Date.now()`, `Math.random()`, `window` หรือเวลาปัจจุบันระหว่าง render ให้ย้ายค่าที่ขึ้นกับ browser ไป `useEffect`

---

## 33. ข้อผิดพลาดที่พบบ่อย

### เรียก setState ระหว่าง render

ผิด:

```jsx
if (!records.length) {
  setLoading(false);
}
```

การเปลี่ยน state ควรเกิดจาก event, effect หรือ async callback

### สร้าง component ภายใน component โดยไม่จำเป็น

ทำให้ component function ถูกสร้างใหม่ทุก render ควรประกาศด้านนอกหากไม่ต้องปิดทับ state เฉพาะ

### ใช้ index เป็น key

อาจทำให้ input และ state ไปอยู่ผิดแถวเมื่อรายการเปลี่ยน

### ลืม cleanup

timer, listener และ fetch ที่ค้างอาจอัปเดต component หลังถูกถอดออก

### เก็บค่าที่คำนวณได้ซ้ำใน state

ถ้า `total` คำนวณจาก `records` ได้ ให้คำนวณตรงๆ หรือใช้ `useMemo` แทน state อีกชุด เพื่อลดข้อมูลไม่ตรงกัน

```jsx
const total = records.reduce((sum, item) => sum + Number(item.amount || 0), 0);
```

### ใช้ `||` กับเลข 0

```jsx
const count = apiCount ?? 0;
```

### ลืม await

```jsx
const response = await fetch(url);
const data = await response.json();
```

### catch แล้วไม่แจ้งผู้ใช้

ควร log รายละเอียดสำหรับผู้พัฒนาและแสดงข้อความที่เข้าใจง่ายแก่ผู้ใช้

---

## 34. Checklist ก่อนถือว่างานเสร็จ

### โค้ด

- [ ] ชื่อ component ขึ้นต้นตัวใหญ่
- [ ] ไม่มีตัวแปร/import ที่ไม่ได้ใช้
- [ ] ใช้ `const` เป็นหลัก
- [ ] ไม่แก้ state/props โดยตรง
- [ ] list ทุกชุดมี `key` ที่เหมาะสม
- [ ] hook อยู่ระดับบนสุด
- [ ] Client Component มี `"use client"` เมื่อจำเป็น
- [ ] ไม่มี secret ใน client

### UI

- [ ] มี loading, error, empty และ success
- [ ] ปุ่มบันทึก disabled ระหว่างส่ง
- [ ] form มี label
- [ ] icon-only button มี `aria-label`
- [ ] ตารางใช้งานบนมือถือได้
- [ ] สีข้อความอ่านชัด
- [ ] ใช้งานด้วย keyboard ได้

### API และข้อมูล

- [ ] ตรวจ auth
- [ ] ตรวจ permission
- [ ] validate body/query/params
- [ ] SQL ใช้ `?` placeholder
- [ ] ไม่ส่งข้อมูลลับหรือรายละเอียด error ภายใน
- [ ] ใช้ HTTP status ถูกต้อง
- [ ] ทดสอบข้อมูลว่าง, 0, null และค่าผิด

### ก่อนส่งขึ้นระบบ

- [ ] ตรวจ `git diff`
- [ ] รัน `npm run lint`
- [ ] รัน `npm test`
- [ ] รัน `npm run build`
- [ ] สำรองฐานข้อมูลถ้ามี migration
- [ ] ทดสอบด้วย role ที่ต่างกัน

---

## 35. Template หน้า CRUD พร้อมนำไปดัดแปลง

ตัวอย่างนี้รวมการโหลด สร้าง แก้ และลบไว้ในหน้าเดียว ควรแยก component เมื่อใช้งานจริงแล้วไฟล์ยาวขึ้น

```jsx
"use client";

import { useCallback, useEffect, useState } from "react";

const emptyForm = {
  title: "",
};

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/stn-eoc/api/items");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "โหลดข้อมูลไม่สำเร็จ");
      }

      setItems(result.data || []);
    } catch (caughtError) {
      console.error("Load items error:", caughtError);
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function startEdit(item) {
    setEditingId(item.id);
    setForm({ title: item.title || "" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const url = editingId
        ? `/stn-eoc/api/items/${editingId}`
        : "/stn-eoc/api/items";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "บันทึกข้อมูลไม่สำเร็จ");
      }

      resetForm();
      await loadItems();
    } catch (caughtError) {
      console.error("Save item error:", caughtError);
      setError(caughtError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("ยืนยันการลบรายการนี้หรือไม่");
    if (!confirmed) return;

    try {
      const response = await fetch(`/stn-eoc/api/items/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "ลบข้อมูลไม่สำเร็จ");
      }

      if (editingId === id) resetForm();
      await loadItems();
    } catch (caughtError) {
      console.error("Delete item error:", caughtError);
      setError(caughtError.message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold">จัดการรายการ</h1>

      {error ? (
        <div role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 flex gap-3">
        <label className="flex-1">
          <span className="sr-only">ชื่อรายการ</span>
          <input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="ชื่อรายการ"
            required
            className="w-full rounded border p-2"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : editingId ? "บันทึกการแก้ไข" : "เพิ่ม"}
        </button>

        {editingId ? (
          <button type="button" onClick={resetForm} className="rounded border px-4 py-2">
            ยกเลิก
          </button>
        ) : null}
      </form>

      <section className="mt-6">
        {loading ? (
          <p>กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <p className="rounded border p-8 text-center text-slate-500">
            ยังไม่มีข้อมูล
          </p>
        ) : (
          <ul className="divide-y rounded border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 p-4">
                <span>{item.title}</span>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(item)}>แก้ไข</button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-700"
                  >
                    ลบ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

---

## 36. ลำดับเรียนรู้ที่แนะนำ

ถ้ายังไม่เคยเขียนมาก่อน ให้เรียนและลองตามลำดับนี้:

1. ตัวแปร, array, object, function
2. `map`, `filter`, spread syntax และ destructuring
3. JSX และ props
4. component และ children
5. event และ form
6. `useState`
7. `useEffect` และ `fetch`
8. Next.js page, Link และ route
9. API route
10. auth, validation และ SQL
11. testing และ debugging

วิธีฝึกที่ได้ผลคือสร้างหน้าเล็กหนึ่งหน้า:

1. แสดงข้อความ
2. เพิ่มปุ่มนับจำนวน
3. เพิ่ม form
4. แสดงข้อมูลจาก array ด้วย `map`
5. เชื่อม GET API
6. เพิ่ม POST
7. เพิ่ม edit/delete
8. เพิ่ม permission และ validation

อย่าเริ่มฝึกด้วยการแก้หน้าขนาดใหญ่ของ production โดยตรง

---

## 37. สรุปหลักที่ต้องจำ

```text
UI = Component(props, state)

props  = ค่าจาก component แม่ ห้ามแก้โดยตรง
state  = ค่าภายในที่เปลี่ยนแล้วหน้าจอ render ใหม่
event  = การกระทำของผู้ใช้
effect = การเชื่อมกับสิ่งภายนอก เช่น API และ timer
API    = จุดตรวจ auth, permission, validation และเข้าฐานข้อมูล
```

ทุกครั้งที่เขียน feature ให้คิดเป็นสายงาน:

```text
ผู้ใช้กรอกข้อมูล
→ event handler
→ validate เบื้องต้น
→ fetch API
→ API ตรวจ session และสิทธิ์
→ API validate ซ้ำ
→ parameterized SQL
→ JSON response
→ อัปเดต state
→ แสดง success/error
```

หากไม่แน่ใจ อย่าเดารูปแบบของระบบ ให้ค้นหา feature ที่ใกล้เคียงในโปรเจกต์ อ่านตั้งแต่หน้า JSX ไปจนถึง API และฐานข้อมูล แล้วแก้ทีละส่วนพร้อมรัน `lint`, `test` และ `build` เสมอ

---

## 38. วิธีเรียนให้เข้าใจและเขียนเองได้จริง

อย่าอ่านคู่มือตั้งแต่ต้นจนจบเพียงอย่างเดียว เพราะการอ่านทำให้รู้สึกคุ้นเคย แต่ไม่ได้แปลว่าจะสามารถเขียนเองได้

สัดส่วนการเรียนที่แนะนำ:

```text
อ่านและดูตัวอย่าง       20%
ลงมือเขียนด้วยตนเอง     60%
Debug และทบทวน         20%
```

ทุกหัวข้อให้ฝึกด้วยวงจรนี้:

```text
อ่านตัวอย่างสั้นๆ
→ ปิดตัวอย่าง
→ เขียนใหม่จากความเข้าใจ
→ ทดลองเปลี่ยนโจทย์
→ ทำให้เกิดข้อผิดพลาดแล้วแก้
→ อธิบายโค้ดด้วยคำพูดของตนเอง
```

ถ้ายังอธิบายไม่ได้ว่าแต่ละบรรทัดมีไว้ทำอะไร แสดงว่ายังจำรูปแบบมากกว่าเข้าใจหลักการ

### 38.1 กฎการฝึกหนึ่งหัวข้อ

เมื่อเรียนเรื่องใหม่ เช่น `useState` ให้ทำตามขั้นตอน:

1. อ่านคำอธิบายและตัวอย่างหนึ่งครั้ง
2. ปิดคู่มือแล้วเขียนตัวอย่างใหม่
3. รันโค้ดและสังเกตผล
4. เปลี่ยนชื่อตัวแปรและโจทย์
5. ทดลองลบบางบรรทัดเพื่อดูว่าเกิดอะไร
6. อ่าน error ก่อนค้นหาคำตอบ
7. อธิบายว่า input, state และ UI เชื่อมกันอย่างไร
8. บันทึกสิ่งที่เพิ่งเข้าใจด้วยภาษาของตนเอง

ตัวอย่าง: หลังเรียน `useState` อย่าหยุดเพียงสร้าง Counter ให้ลองสร้าง:

- ปุ่มเปิด/ปิดข้อความ
- ตัวเลือกสถานะเหตุการณ์
- form เก็บชื่อและจำนวน
- รายการที่สามารถเพิ่มและลบได้

---

## 39. แผนการเรียน 6 สัปดาห์

ปรับจำนวนวันได้ตามเวลาว่าง สิ่งสำคัญคือทำแบบฝึกหัดให้ได้ก่อนข้ามไปหัวข้อถัดไป

### สัปดาห์ที่ 1: JavaScript พื้นฐาน

เรียน:

- `const` และ `let`
- string, number, boolean, `null`, `undefined`
- array และ object
- `if`, ternary และ comparison
- function และ arrow function
- `map`, `filter`, `find`, `some`, `reduce`
- destructuring และ spread syntax
- `async/await` และ `try/catch`

ข้อมูลสำหรับฝึก:

```jsx
const reports = [
  { id: 1, district: "เมืองสตูล", affected: 20, status: "approved" },
  { id: 2, district: "ละงู", affected: 15, status: "draft" },
  { id: 3, district: "ควนโดน", affected: 30, status: "approved" },
];
```

โจทย์:

1. หาผลรวม `affected`
2. กรองเฉพาะรายการที่อนุมัติแล้ว
3. หารายการของอำเภอละงู
4. เพิ่มรายงานใหม่โดยไม่แก้ array เดิม
5. เปลี่ยนสถานะ id 2 เป็น `approved`
6. ลบรายการ id 1
7. สร้าง array ที่เหลือเฉพาะชื่ออำเภอ

คำตอบควรใช้ `map`, `filter`, `find`, `reduce` และ spread syntax ไม่ใช่แก้ข้อมูลเดิมโดยตรง

เกณฑ์ผ่าน: ทำโจทย์ได้โดยเปิดดูเฉพาะชื่อ method ไม่ต้องคัดลอกตัวอย่างทั้งหมด

### สัปดาห์ที่ 2: JSX และ Component

เรียน:

- กฎของ JSX
- Component
- Props
- `children`
- conditional rendering
- การแสดง array ด้วย `map`
- `key`
- Tailwind CSS เบื้องต้น

Component ที่ควรสร้างเอง:

```text
SummaryCard
StatusBadge
EmptyState
AlertBox
ReportTable
ConfirmModal
```

โจทย์:

1. สร้าง `SummaryCard` ที่รับ `label`, `value`, `detail`
2. สร้าง `StatusBadge` ที่เปลี่ยนสีตาม status
3. สร้างรายการรายงานด้วย `map`
4. ถ้าไม่มีข้อมูลให้แสดง `EmptyState`
5. สร้าง `Panel` ที่รับเนื้อหาผ่าน `children`

เกณฑ์ผ่าน: เมื่อเห็นหน้าจอหนึ่งหน้า สามารถบอกได้ว่าส่วนใดควรแยกเป็น component และ props ที่ต้องส่งมีอะไรบ้าง

### สัปดาห์ที่ 3: State, Event และ Form

เรียน:

- `useState`
- `onClick`, `onChange`, `onSubmit`
- controlled input
- การอัปเดต array และ object
- loading, saving และ error state
- validation เบื้องต้น

สร้างหน้า “รายการเหตุการณ์” ที่ทำได้ดังนี้:

- เพิ่มเหตุการณ์
- แก้ไขเหตุการณ์
- ลบเหตุการณ์
- ค้นหาจากชื่อ
- กรองตามสถานะ
- แสดงจำนวนทั้งหมด

ช่วงนี้ให้เก็บข้อมูลใน `useState` ก่อน ยังไม่ต้องเชื่อม API

เกณฑ์ผ่าน: อธิบายได้ว่า event ใดเปลี่ยน state ตัวใด และ state นั้นทำให้ส่วนใดของ UI render ใหม่

### สัปดาห์ที่ 4: API และ useEffect

เรียน:

- HTTP และ JSON
- `fetch`
- `response.ok`
- GET, POST, PUT, PATCH และ DELETE
- `useEffect`
- dependency array
- loading/error/empty/success
- query string
- `AbortController`

นำหน้าจากสัปดาห์ที่ 3 มาเชื่อม API จริง

ทุกครั้งที่เรียก API ให้เปิด Browser DevTools ที่แท็บ Network แล้วตอบให้ได้:

```text
ส่ง request ไป URL ใด
ใช้ HTTP method อะไร
ส่ง request body อะไร
server ตอบ HTTP status เท่าไร
response body คืออะไร
ถ้า request ล้มเหลว UI แสดงอะไร
```

เกณฑ์ผ่าน: สามารถตามข้อมูลจาก `handleSubmit` ไปถึง Network response และกลับมาอัปเดต state ได้

### สัปดาห์ที่ 5: Next.js, Database และ Security

เรียน:

- `page.jsx`, `layout.jsx`, `loading.jsx`, `error.jsx`
- Server Component และ Client Component
- `route.js`
- static route และ dynamic route
- SQL พื้นฐาน
- parameterized query
- authentication
- role และ permission
- validation ฝั่ง API

ฝึกติดตาม feature จริงในโปรเจกต์หนึ่ง feature:

```text
ปุ่มหรือ form บนหน้า JSX
→ event handler
→ fetch URL
→ app/api/**/route.js
→ requireAuth
→ validation
→ db.query
→ JSON response
→ setState
→ UI
```

เกณฑ์ผ่าน: เปิดโค้ดแล้วชี้ได้ว่าระบบตรวจ login, permission, input และ SQL อยู่ตรงไหน

### สัปดาห์ที่ 6: สร้าง Feature ด้วยตนเอง

เลือก feature ขนาดเล็ก เช่น “บันทึกคำขออุปกรณ์” โดยมี:

- หน้ารายการ
- form เพิ่มข้อมูล
- แก้ไขข้อมูล
- ลบพร้อมยืนยัน
- ค้นหาและกรอง
- loading, error, empty และ success
- API route
- validation
- permission
- SQL ที่ใช้ placeholder
- test อย่างน้อย 2–3 กรณี

กติกา:

1. เขียนรายการสิ่งที่จะทำก่อนเริ่ม
2. แบ่งงานเป็นชิ้นเล็ก
3. ลองคิดเองอย่างน้อย 15–20 นาทีก่อนดูเฉลย
4. ดู feature ใกล้เคียงได้ แต่อย่าคัดลอกทั้งไฟล์
5. หลังคัดลอกโค้ดส่วนใด ต้องอธิบายส่วนนั้นได้
6. รัน `lint`, `test` และ `build`

เกณฑ์ผ่าน: สร้าง feature ได้ตั้งแต่ UI จนถึงฐานข้อมูล และอธิบาย data flow ทั้งหมดได้

---

## 40. สิ่งที่ควรเรียนเสริมนอกเหนือจาก JSX

### 40.1 Git

คำสั่งที่ควรใช้ได้:

```bash
git status
git diff
git diff --check
git switch -c feature/example
git add path/to/file
git commit -m "feat: add example feature"
git log --oneline
```

เป้าหมายคือรู้ว่าไฟล์ใดถูกเปลี่ยน เปลี่ยนอะไร และสามารถแบ่ง commit ตามงานได้

### 40.2 Browser DevTools

ส่วนที่ควรฝึก:

- Console: อ่าน JavaScript error และ log
- Network: ตรวจ request, response และ status
- Elements: ตรวจ HTML และ CSS
- Application: ตรวจ cookie, local storage และ session storage
- Responsive mode: ทดสอบมือถือและหน้าจอขนาดต่างๆ

อย่าเริ่มแก้ API แบบเดาสุ่มก่อนดู Network tab

### 40.3 HTTP

ต้องเข้าใจ:

```text
GET     อ่าน
POST    สร้าง
PUT     แทนข้อมูล
PATCH   แก้บางส่วน
DELETE  ลบ
```

และ status หลัก:

```text
200 สำเร็จ
201 สร้างสำเร็จ
400 ข้อมูลผิด
401 ยังไม่ login
403 ไม่มีสิทธิ์
404 ไม่พบ
409 ข้อมูลขัดแย้ง
500 server ผิดพลาด
```

### 40.4 SQL

เรียนตามลำดับ:

1. `SELECT`
2. `WHERE`
3. `ORDER BY`
4. `INSERT`
5. `UPDATE`
6. `DELETE`
7. `JOIN`
8. `GROUP BY`
9. transaction

ทุก query ที่รับค่าจากภายนอกต้องใช้ placeholder `?`

### 40.5 Debugging

Debug คือทักษะสำคัญกว่าการจำ syntax

ขั้นตอน:

```text
ทำให้ปัญหาเกิดซ้ำ
→ อ่าน error ให้ครบ
→ หาบรรทัดแรกที่เกี่ยวกับโค้ดเรา
→ ตรวจค่าที่เข้าและออก
→ ตั้งสมมติฐานหนึ่งข้อ
→ เปลี่ยนทีละจุด
→ รันทดสอบใหม่
→ บันทึกสาเหตุจริง
```

อย่าแก้หลายจุดพร้อมกัน เพราะจะไม่รู้ว่าสิ่งใดแก้ปัญหาได้จริง

---

## 41. วิธีใช้ AI โดยยังพัฒนาทักษะของตนเอง

ใช้ AI เป็นครู ผู้ตั้งคำถาม และผู้ review ไม่ใช่ให้เขียนแทนทุกครั้ง

ลำดับที่แนะนำ:

1. อ่านโจทย์และเขียนแผนเอง
2. ลองเขียนโค้ด
3. บันทึก error และสิ่งที่ลอง
4. ขอคำใบ้โดยยังไม่ขอโค้ดเต็ม
5. ลองแก้อีกครั้ง
6. ขอให้ AI review
7. เขียนโค้ดใหม่ด้วยตนเองโดยไม่ดูคำตอบ
8. อธิบายสิ่งที่เรียนรู้

Prompt สำหรับขอคำใบ้:

```text
อย่าเพิ่งเฉลยโค้ดเต็ม ช่วยวิเคราะห์จาก error นี้ ให้คำใบ้ทีละขั้น
และถามฉันก่อนว่าคิดว่าสาเหตุคืออะไร
```

Prompt สำหรับ review:

```text
ช่วย review โค้ดนี้ โดยแบ่งเป็น:
1. bug ที่อาจเกิดขึ้น
2. security
3. React/Next.js ที่ใช้ไม่ถูก
4. readability
5. test ที่ควรเพิ่ม

ชี้ตำแหน่งและอธิบายเหตุผล แต่ยังไม่ต้องเขียนไฟล์ใหม่ทั้งไฟล์
```

Prompt สำหรับตรวจความเข้าใจ:

```text
ถามฉันทีละคำถามเกี่ยวกับ component นี้ เพื่อตรวจว่าฉันเข้าใจ
props, state, event, effect และ data flow จริงหรือไม่
ถ้าตอบผิดให้ใบ้ก่อนเฉลย
```

Prompt สำหรับฝึกเขียน:

```text
ออกโจทย์ React/JSX ที่ใกล้เคียงกับระบบ EOC ระดับเริ่มต้น
ให้ requirement และข้อมูลตัวอย่าง แต่ไม่ให้เฉลย
เมื่อฉันส่งคำตอบ ให้ review และถามเหตุผลของโค้ดแต่ละส่วน
```

หลัง AI สร้างหรือแก้โค้ดให้ ต้องตอบคำถามเหล่านี้ได้:

```text
แต่ละ state เก็บอะไร
อะไรทำให้ component render ใหม่
event ใดเรียกฟังก์ชันใด
request ถูกส่งเมื่อใด
API ตรวจสิทธิ์ตรงไหน
ข้อมูลถูก validate ที่ใด
SQL ป้องกัน injection อย่างไร
ถ้า API ล้มเหลว ผู้ใช้เห็นอะไร
ถ้าข้อมูลเป็น null, 0 หรือ array ว่างจะเกิดอะไร
```

ถ้าตอบไม่ได้ อย่าเพิ่งนำโค้ดนั้นขึ้นใช้งานจริง

---

## 42. สมุดบันทึกการเรียนและข้อผิดพลาด

สร้างไฟล์ `learning-notes.md` หรือใช้สมุดส่วนตัว บันทึกทุกวันที่ฝึก

Template:

```md
## วันที่ YYYY-MM-DD

### วันนี้ตั้งใจทำอะไร
สร้าง form เพิ่มรายงาน

### สิ่งที่เขียนได้เอง
- สร้าง useState
- เขียน handleChange

### สิ่งที่ยังต้องเปิดดู
- การ update object ด้วย spread

### Error ที่พบ
Cannot read properties of undefined

### สาเหตุจริง
อ่าน data.team.name ก่อน API โหลดเสร็จ

### วิธีตรวจพบ
ดู Console และ log ค่า data

### วิธีแก้
เพิ่ม loading state และใช้ data?.team?.name

### สิ่งที่เข้าใจเพิ่ม
optional chaining ป้องกันการอ่าน property เมื่อค่าด้านหน้าไม่มี

### สิ่งที่จะฝึกครั้งต่อไป
useEffect และ AbortController
```

การบันทึก “สาเหตุ” สำคัญกว่าการคัดลอก “วิธีแก้” เพราะจะช่วยแก้ปัญหาที่มีอาการคล้ายกันในอนาคต

ทุกสัปดาห์ให้ทบทวน:

- error ใดเกิดซ้ำ
- syntax ใดยังต้องเปิดดู
- เรื่องใดอธิบายได้แล้ว
- งานใดเคยทำตามตัวอย่าง แต่ยังเขียนเองไม่ได้
- สัปดาห์หน้าควรฝึกเรื่องใดซ้ำ

---

## 43. แบบฝึกหัดเรียงระดับ

### ระดับ 1: JavaScript

1. คำนวณยอดรวมจาก array
2. กรองข้อมูลตามอำเภอ
3. เรียงข้อมูลตามจำนวน
4. เพิ่ม แก้ และลบ object โดยไม่แก้ array เดิม
5. แปลงข้อมูล API เป็นรูปแบบที่ UI ต้องใช้

### ระดับ 2: JSX

1. สร้าง Card จาก props
2. แสดงรายการด้วย `map`
3. แสดง Empty State
4. เปลี่ยนสี Badge ตาม status
5. แยกหน้าหนึ่งหน้าออกเป็น component ย่อย

### ระดับ 3: State และ Form

1. Counter
2. เปิด/ปิด Modal
3. Form หลาย field
4. เพิ่มรายการใน state
5. แก้ไขและลบรายการ
6. ค้นหาและกรอง

### ระดับ 4: API

1. โหลดรายการด้วย GET
2. เพิ่มด้วย POST
3. แก้ด้วย PUT/PATCH
4. ลบด้วย DELETE
5. แสดง loading/error/empty/success
6. ยกเลิก fetch เมื่อออกจากหน้า

### ระดับ 5: Full Stack

1. สร้าง API route
2. ตรวจ session
3. ตรวจ role/permission
4. validate body
5. query ฐานข้อมูลด้วย placeholder
6. ส่ง response และ status ที่เหมาะสม
7. เขียน test

### ระดับ 6: Feature จริง

สร้างระบบย่อยหนึ่งระบบที่มี CRUD, permission, validation, responsive UI, error handling และ test โดยไม่คัดลอกทั้ง feature จากของเดิม

---

## 44. วิธีประเมินว่าตนเองเข้าใจจริงหรือยัง

ให้คะแนนแต่ละข้อ:

```text
0 = ยังทำไม่ได้
1 = ทำได้เมื่อมีตัวอย่าง
2 = ทำได้โดยเปิด documentation บางส่วน
3 = ทำเองได้และอธิบายให้ผู้อื่นเข้าใจได้
```

หัวข้อประเมิน:

- [ ] ประกาศและใช้ตัวแปรได้ถูกต้อง
- [ ] ใช้ array/object โดยไม่แก้ข้อมูลเดิม
- [ ] เขียน function และ async function
- [ ] สร้าง component และส่ง props
- [ ] แสดงรายการด้วย `map` และ key
- [ ] ใช้ conditional rendering
- [ ] ใช้ `useState`
- [ ] จัดการ form และ event
- [ ] ใช้ `useEffect` โหลดข้อมูล
- [ ] ทำ loading/error/empty state
- [ ] เรียก GET/POST/PUT/PATCH/DELETE
- [ ] สร้าง Next.js page และ API route
- [ ] แยก Server/Client Component ได้
- [ ] validate ข้อมูลฝั่ง API
- [ ] ตรวจ authentication และ permission
- [ ] เขียน SQL แบบใช้ placeholder
- [ ] ใช้ Console และ Network debug
- [ ] อ่าน stack trace และระบุต้นเหตุ
- [ ] เขียน test พื้นฐาน
- [ ] อธิบาย data flow ตั้งแต่ UI ถึงฐานข้อมูล

หัวข้อใดได้ 0–1 ให้ย้อนกลับไปทำแบบฝึกหัดเล็ก หัวข้อใดได้ 2 ให้สร้างโจทย์ใหม่โดยไม่คัดลอก และหัวข้อใดได้ 3 ให้ลองสอนหรือเขียนสรุปด้วยตนเอง

---

## 45. เกณฑ์ว่าเริ่มเขียนระบบเองได้

ไม่จำเป็นต้องจำ syntax ทุกอย่าง นักพัฒนาที่มีประสบการณ์ก็ยังเปิด documentation และค้นหาโค้ดเดิม

ถือว่าเริ่มเขียนเองได้เมื่อสามารถ:

- สร้าง page และ component ใหม่
- เลือกได้ว่า component ใดควรเป็น Server หรือ Client Component
- ส่ง props และจัดการ state
- สร้าง form พร้อม validation เบื้องต้น
- เรียก API และจัดการทุกสถานะ
- สร้าง API route
- ตรวจ session, role และ permission
- validate input ฝั่ง server
- อ่านและเขียน SQL แบบปลอดภัย
- ใช้ DevTools ตาม request ที่มีปัญหา
- อ่าน error และตั้งสมมติฐานได้
- ทดสอบกรณีสำเร็จและล้มเหลว
- อธิบาย data flow ของ feature ได้

เป้าหมายไม่ใช่ “เขียนทุกอย่างจากความจำ” แต่คือ:

```text
รู้ว่าต้องสร้างส่วนใด
รู้ว่าข้อมูลไหลผ่านส่วนใด
รู้ว่าความปลอดภัยต้องตรวจตรงไหน
รู้วิธีค้นหาและทดสอบคำตอบ
รู้วิธีแก้เมื่อระบบไม่ทำงาน
```

เมื่อทำสิ่งเหล่านี้ได้ จะสามารถพัฒนาระบบต่อด้วยตนเอง แม้ต้องเปิดคู่มือหรือ documentation ประกอบก็ตาม
