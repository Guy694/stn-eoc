# สภาพอากาศ / Weather Watch

หน้า Weather Watch เป็น public dashboard แบบ map-first สำหรับระบบศูนย์ปฏิบัติการฉุกเฉินจังหวัดสตูล ใช้แสดงสภาพอากาศปัจจุบัน พยากรณ์ ฝนสะสม ความเสี่ยงฝนตกหนัก คลื่นลมแรง น้ำท่วม ดินถล่ม และคำแนะนำประชาชน

## เส้นทางใช้งาน

- หน้าเว็บ: `/stn-eoc/public/weather-watch`
- API mock/proxy: `/stn-eoc/api/public/weather-watch?date=YYYY-MM-DD`
- Mock data: `data/weather-watch.json`

## สิ่งที่มีในหน้า

- KPI Weather Cards 8 ใบ
- แผนที่ Leaflet พร้อม layer control และ legend
- ขอบเขตอำเภอ 7 อำเภอของจังหวัดสตูล
- popup รายอำเภอพร้อมฝน อุณหภูมิ ลม ความเสี่ยง และคำแนะนำ
- Weather Warning panel
- District Risk Ranking
- Public Safety Advice
- Forecast tabs: รายชั่วโมง, 24 ชั่วโมง, 3 วัน, 7 วัน
- Daily Weather Timeline
- กราฟฝนสะสม 7 วัน, ฝนรายอำเภอ, แนวโน้มความเสี่ยง
- District Weather Table

## Risk Scoring

สูตรอยู่ใน `lib/weatherWatch.js`

```text
Weather Risk Score =
Rainfall 24h Score
+ Forecast Rain Score
+ Wind Score
+ Flood Susceptibility Score
+ Warning Score
```

ระดับความเสี่ยง:

- `normal` = ปกติ
- `watch` = เฝ้าระวัง
- `high` = เสี่ยงสูง
- `critical` = วิกฤต

## การเชื่อมต่อ API จริงในอนาคต

หน้าเว็บเรียกข้อมูลผ่าน Backend API Route เท่านั้น จึงไม่ต้องฝัง API key ใน frontend

จุดต่อ API อยู่ที่ `app/api/public/weather-watch/route.js` และ service อยู่ที่ `lib/weatherWatch.js`

แหล่งข้อมูลที่เตรียมรองรับ:

- TMD: พยากรณ์อากาศ ประกาศเตือนภัย เรดาร์ฝน
- GISTDA: ดาวเทียม พื้นที่น้ำท่วม และพื้นที่เสี่ยงภัย
- OpenWeather: current weather, forecast, weather map layer
- Windy: visual layer ลม ฝน เมฆ คลื่นทะเล เรดาร์
- ข้อมูลภาคสนามจังหวัด: อำเภอ อปท. รพ.สต. ปภ. และ EOC

เมื่อเปิดใช้ live provider ให้เพิ่ม server-side credential ใน environment และปรับ branch `source !== "mock"` ใน API route ให้เรียก provider จริง
