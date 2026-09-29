# Manday Estimation (PTT Digital)

Web application สำหรับประเมิน Man-day ของโครงการ ตาม **MD Estimation Standard
Matrix** และ export ผลลัพธ์เป็น Excel ตามรูปแบบ **PTT-PSSR-Online_Manday.xlsx**

## Stack

| ส่วน | เทคโนโลยี |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, Server Actions) |
| ภาษา | TypeScript |
| UI | Tailwind CSS v4, IBM Plex Sans Thai |
| ฐานข้อมูล | SQLite (ไฟล์เดียว) ผ่าน Drizzle ORM + better-sqlite3 |
| Auth | Email + password (bcrypt) + session JWT ใน httpOnly cookie (jose) |
| Excel | ExcelJS |

## เริ่มใช้งาน

```bash
npm install
```

สร้าง `.env` จาก `.env.example` แล้วตั้ง `SESSION_SECRET` เป็นค่าสุ่มอย่างน้อย 32
ตัวอักษร (ค่าใน `.env` ที่มาพร้อม repo ใช้ได้เฉพาะตอน dev)

```bash
npm run db:migrate   # สร้าง schema ลงไฟล์ SQLite
npm run db:seed      # โหลด master data จาก MD_Standard_Matrix.xlsx + ผู้ใช้ตั้งต้น
npm run dev          # http://localhost:3000
```

บัญชีจาก seed — **เปลี่ยนรหัสผ่านก่อนใช้งานจริง**

| อีเมล | รหัสผ่าน | สิทธิ์ |
| --- | --- | --- |
| admin@pttdigital.com | Admin@1234 | admin — แก้ไข master data ได้ |
| estimator@pttdigital.com | Estimate@1234 | estimator — สร้าง/ประเมินโครงการ |

สิทธิ์ `viewer` ดูได้ทุกหน้าแต่แก้ไขไม่ได้ (เพิ่มผู้ใช้ผ่าน seed หรือ SQL)

## เมนูในระบบ

1. **Login** — `/login`
2. **Standard Matrix** — `/matrix`
   - Activity × ระดับความซับซ้อน (L / M / H) × บทบาท (SA, BA, Developer (Senior),
     Developer, Tester + คอลัมน์เสริมของ template) เพิ่ม / แก้ไข / ลบ ได้ (admin)
   - `/matrix/tech-stacks` ตัวคูณตาม Technology Stack — มีผลกับ Developer และ
     Developer (Senior) เท่านั้น
   - `/matrix/roles` อัตราต่อ Man-day ตั้งต้นของแต่ละบทบาท
3. **Questionnaire** — `/questionnaires`
   แบบสำรวจตามหัวข้อของ Standard Matrix แต่ละชุดเลือกได้ว่าจะถามหัวข้อไหน
   (seed มาให้ 2 ชุด: ทุกหัวข้อ 50 และ Greenfield 44) ตอนตอบจะกรอก
   **จำนวนตามหน่วยนับ** ของหัวข้อนั้น และกรอกได้ทั้งระดับ L, M, H พร้อมกัน
   เช่น `1.1 List / Search` = 3 หน้าจอง่าย + 2 ปานกลาง + 1 ซับซ้อน
   จากนั้นกด “สร้างรายการ” ระบบจะสร้างหนึ่งรายการต่อหนึ่งหัวข้อต่อหนึ่งระดับ
   และจัด phase ตามกลุ่มของหัวข้อให้เอง
4. **Wizard ประเมินโครงการ** — `/projects`
   1. ข้อมูลโครงการ (ชื่อ, รหัส, ระยะเวลา, technology stack, ชุดคำถาม)
   2. ตอบแบบสำรวจ: กรอกจำนวนต่อหัวข้อต่อระดับ แล้วสร้างรายการอัตโนมัติ (ข้ามได้)
   3. Key รายการเป็น phase + line item; ค่า MD มาจาก Standard Matrix โดยอัตโนมัติ
      และแก้ไขเป็นรายช่องได้ (ช่องที่แก้เองจะถูกทำเครื่องหมายไว้ และปุ่ม
      “คำนวณใหม่จาก Standard Matrix” จะดึงกลับเป็นค่ามาตรฐาน)
   4. ทีม & อัตรา — เลือกบทบาทที่จะคิดค่าใช้จ่าย, ระบุระดับ (Of1 / Sr1), ชื่อผู้รับผิดชอบ
      และอัตราเฉพาะโครงการ
   5. สรุป & Export
5. **หน้าสรุป + Export Excel** — `/projects/{id}/summary`, ดาวน์โหลดที่
   `/api/projects/{id}/export`

## สูตรคำนวณ

```
MD(item, role) = matrix[activity][role][complexity] × qty × stackMultiplier
```

ตัวคูณและตัวปรับใช้เฉพาะบทบาทที่ติดธง “× stack” (ค่าเริ่มต้น: Developer และ
Developer (Senior)) ตามที่ระบุไว้ใน MD_Standard_Matrix_v3.xlsx

บทบาทมี 2 ขอบเขตการประเมิน ตั้งได้ที่ `/matrix/roles`

- **item** (ค่าเริ่มต้นของทุกบทบาท) — MD มาจากเมทริกซ์รายบรรทัดที่ key
- **phase** — MD คิดเป็นสัดส่วนของ Developer ต่อ phase ตามวิธีของไฟล์
  PTT-PSM Platform: `MD(role) = ratioOfDev × Developer MD ของ phase นั้น`

หน้าสรุปแสดง % ของ Developer เทียบเป้าหมายจากมาตรฐาน และเตือนเมื่อต่างเกิน 25%

```
ค่าใช้จ่ายรวม = Σ (MD × อัตรา/MD) + Buffer %
```

`qty` คิดตาม **หน่วยนับ** ของแต่ละแถว (ต่อหน้าจอ / ต่อ interface / ต่อรายงาน …)
แถวที่เป็น `ต่อโครงการ` ระบบล็อก qty ไว้ที่ 1 ทั้งฝั่ง UI และฝั่ง server

```
ค่าใช้จ่าย(role) = Σ MD(role) × อัตราต่อ MD(role)
```

## รูปแบบไฟล์ export

Sheet `PTTDigital_Manday` เรียงตาม template เดิม

| แถว | เนื้อหา |
| --- | --- |
| 1 | ชื่อโครงการ |
| 2 | ระยะเวลาโครงการ + ระดับของแต่ละบทบาท (Of1 / Sr1) |
| 3-4 | หัวตาราง `Phase / Details / Due Date Plan / Deliverables` + คอลัมน์บทบาท และชื่อผู้รับผิดชอบ |
| 5..n | รายการประเมิน โดย merge ชื่อ phase ในคอลัมน์ A |
| ต่อมา | `★ รวมทั้งหมด (MD)` (สูตร `SUM`), อัตราต่อ Man-day, ค่าใช้จ่าย (สูตร), รวมค่าใช้จ่ายทั้งโครงการ |

Sheet `Basis of Estimate` เก็บสมมติฐานที่ใช้ (stack, ตัวคูณ, ยอดรวม, วันที่สร้าง)

## คำสั่งที่มี

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm start` | build และรัน production |
| `npm run db:migrate` | สร้าง/อัปเกรด schema จาก `drizzle/` |
| `npm run db:generate` | สร้างไฟล์ migration ใหม่หลังแก้ `schema.ts` |
| `npm run db:seed` | โหลด master data + ผู้ใช้ตั้งต้น (รันซ้ำได้) |
| `npm run db:reset` | ลบไฟล์ DB แล้ว push + seed ใหม่ |
| `npm run matrix:extract` | อ่าน `MD_Standard_Matrix_v3.xlsx` ใหม่ เป็น `src/lib/db/standard-matrix.json` |
| `npm run matrix:build` | สร้าง `MD_Standard_Matrix_v3.xlsx` ขึ้นใหม่จากสเปกในสคริปต์ (ใช้ครั้งเดียวตอนอัปเวอร์ชันเมทริกซ์) |
| `npm run test:upgrade` | ทดสอบว่าการอัปเกรดฐานข้อมูล v1 → v3 ไม่ทำค่าที่ประเมินไว้หาย (22 ข้อ) |
| `npm run typecheck` / `npm run lint` | ตรวจ type และ lint |
| `npx tsx scripts/verify-export.ts <projectId> [out.xlsx]` | สร้างไฟล์ export ของโครงการและพิมพ์เนื้อหาออกมาตรวจ |

## นำขึ้น server

ดู [deploy/DEPLOY.md](deploy/DEPLOY.md) — คู่มือ Windows Server + IIS (reverse proxy
ไปที่ Node.js service) พร้อมสคริปต์ `deploy/publish.ps1`, `deploy/install-service.ps1`
และ `deploy/web.config`

## หมายเหตุการ deploy

- ฐานข้อมูลเป็นไฟล์เดียวที่ `DATABASE_PATH` (ค่าเริ่มต้น `./data/estmanday.db`)
  ต้องเป็น persistent volume และรันแบบ instance เดียว (better-sqlite3 ไม่รองรับ
  หลาย process เขียนพร้อมกันข้ามเครื่อง)
- `SESSION_SECRET` ต้องตั้งใน environment ของ production เสมอ
- ติดตั้ง dependency ด้วย `npm ci` เสมอ; `.npmrc` ตั้ง `ignore-scripts=true` ไว้
  เพราะ `better-sqlite3` มี install script ที่เรียก node-gyp แต่ตัว package แนบ
  prebuilt binary มาให้แล้ว จึงไม่ต้องมี C++ compiler ทั้งบน dev และ server
- ถ้า `MD_Standard_Matrix_v3.xlsx` เปลี่ยน ให้รัน `npm run matrix:extract` แล้ว
  `npm run db:seed` — ค่าเดิมจะถูก upsert ทับ โครงการที่ประเมินไว้แล้วไม่ถูกแก้
  จนกว่าจะกด “คำนวณใหม่จาก Standard Matrix”
