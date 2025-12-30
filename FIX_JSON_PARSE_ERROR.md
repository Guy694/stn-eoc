# แก้ไข Error: Unexpected end of JSON input

## ปัญหาที่เกิดขึ้น

Error: `Failed to execute 'json' on 'Response': Unexpected end of JSON input`

ปัญหานี้เกิดเมื่อพยายาม parse JSON จาก response ที่:
1. ว่างเปล่า (empty body)
2. ไม่ใช่ JSON format
3. Response status ไม่สำเร็จ (4xx, 5xx) แต่ไม่มี body

## การแก้ไขที่ดำเนินการ

### 1. แก้ไข Context Files

#### ✅ EOCContext.jsx
- แก้ไข `fetchEOCStatus()` - ตรวจสอบ `response.ok` ก่อน parse JSON
- แก้ไข `toggleEOC()` - ตรวจสอบ `response.ok` ก่อน parse JSON

#### ✅ AuthContext.jsx
- แก้ไข session validation - ตรวจสอบ `response.ok` ก่อน parse JSON
- แก้ไข `login()` - ตรวจสอบ `response.ok` ก่อน parse JSON

### 2. สร้าง Safe Fetch Utility

สร้างไฟล์ `lib/safeFetch.js` ที่มี utility functions:

```javascript
import { safeFetch, postJSON, putJSON, deleteRequest } from '@/lib/safeFetch';

// ตัวอย่างการใช้งาน
const result = await safeFetch('/api/endpoint');
if (result.success) {
    console.log(result.data);
} else {
    console.error(result.error);
}
```

## วิธีป้องกัน Error นี้ในอนาคต

### Pattern ที่ถูกต้อง (แนะนำ)

```javascript
// 1. ตรวจสอบ response.ok ก่อนเสมอ
const response = await fetch('/api/endpoint');

if (!response.ok) {
    console.error('Request failed:', response.status);
    // จัดการ error
    return;
}

const data = await response.json();
```

```javascript
// 2. ตรวจสอบ Content-Type
const response = await fetch('/api/endpoint');
const contentType = response.headers.get('content-type');

if (!response.ok || !contentType?.includes('application/json')) {
    // จัดการ error
    return;
}

const data = await response.json();
```

```javascript
// 3. ใช้ safeFetch utility (แนะนำมากที่สุด)
import { safeFetch } from '@/lib/safeFetch';

const result = await safeFetch('/api/endpoint');
if (result.success) {
    // ใช้ result.data
} else {
    // จัดการ result.error
}
```

### Pattern ที่ผิด (ห้ามใช้)

```javascript
// ❌ ไม่ตรวจสอบ response.ok
const response = await fetch('/api/endpoint');
const data = await response.json(); // อาจเกิด error ได้
```

```javascript
// ❌ ไม่มี error handling
try {
    const response = await fetch('/api/endpoint');
    const data = await response.json();
} catch (error) {
    // จัดการไม่ครบถ้วน
}
```

## ไฟล์ที่ควรแก้ไขเพิ่มเติม (Optional)

ไฟล์เหล่านี้ยังมี pattern เดิมอยู่ แนะนำให้แก้ไขเมื่อมีเวลา:

### Components
- `components/SessionStats.jsx`
- `components/FloodSessionSelector.jsx`
- `components/FloodAreaStatus.jsx`
- `components/DisasterSessionSelector.jsx`
- `components/DisasterDashboard.jsx`
- `components/DailyVillageFloodTimeline.jsx`
- `components/DailyFloodTimeline.jsx`

### Pages
- `app/page.jsx`
- `app/public/report-incident/page.jsx`
- `app/settings/page.jsx`
- `app/eoc/flood/records/page.jsx`
- `app/admin/village-polygons/page.jsx`
- `app/admin/officers/page.jsx`
- `app/admin/health-facilities/page.jsx`
- และอื่นๆ

## วิธีการแก้ไขไฟล์เพิ่มเติม

### ตัวอย่างที่ 1: Simple Fetch
```javascript
// เดิม
const response = await fetch('/api/endpoint');
const data = await response.json();

// แก้เป็น
const response = await fetch('/api/endpoint');
if (!response.ok) {
    console.error('Failed to fetch:', response.status);
    return; // หรือจัดการ error ตามที่เหมาะสม
}
const data = await response.json();
```

### ตัวอย่างที่ 2: With Error Handling
```javascript
// เดิม
try {
    const response = await fetch('/api/endpoint');
    const data = await response.json();
    // ใช้ data
} catch (error) {
    console.error('Error:', error);
}

// แก้เป็น
try {
    const response = await fetch('/api/endpoint');
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    // ใช้ data
} catch (error) {
    console.error('Error:', error);
}
```

### ตัวอย่างที่ 3: ใช้ safeFetch (แนะนำ)
```javascript
// เดิม
try {
    const response = await fetch('/api/endpoint');
    const data = await response.json();
    if (data.success) {
        // ทำอะไรบางอย่าง
    }
} catch (error) {
    console.error('Error:', error);
}

// แก้เป็น
import { safeFetch } from '@/lib/safeFetch';

const result = await safeFetch('/api/endpoint');
if (result.success && result.data?.success) {
    // ทำอะไรบางอย่าง
} else {
    console.error('Error:', result.error);
}
```

## Best Practices

1. **เสมอ**: ตรวจสอบ `response.ok` ก่อน parse JSON
2. **แนะนำ**: ใช้ `safeFetch` utility สำหรับ code ใหม่
3. **ควร**: ตรวจสอบ Content-Type header
4. **ต้อง**: มี try-catch สำหรับ async operations
5. **ห้าม**: สมมติว่า response จะมี JSON body เสมอ

## การทดสอบ

เมื่อแก้ไขแล้ว ให้ทดสอบ:
1. ✅ กรณี response สำเร็จ (200-299)
2. ✅ กรณี response error (400-599)
3. ✅ กรณี network error
4. ✅ กรณี timeout
5. ✅ กรณี response ไม่มี body

## สรุป

Error นี้เกิดจากการไม่ตรวจสอบ response status ก่อน parse JSON แก้ไขโดย:
1. ตรวจสอบ `response.ok` ก่อนเสมอ
2. ใช้ `safeFetch` utility สำหรับความปลอดภัย
3. จัดการ error ทุกกรณีที่เป็นไปได้

## วันที่แก้ไข
30 ธันวาคม 2568
