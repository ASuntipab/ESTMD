# การนำขึ้น Windows Server + IIS

คู่มือนี้ใช้กับ **Windows Server ที่มี IIS** โดยให้ IIS ทำหน้าที่ reverse proxy
ไปที่ Node.js process ของแอป

## 0. ข้อจำกัดที่ต้องเข้าใจก่อน

แอปนี้เป็น **Next.js แบบ server-rendered** ไม่ใช่เว็บ static — login, การบันทึกข้อมูล
ทุกหน้า และการ export Excel ทำงานบน server ทั้งหมด ดังนั้น

- **วางไฟล์ในโฟลเดอร์ static เฉย ๆ แล้วให้ IIS เสิร์ฟตรง ๆ ไม่ได้** ต้องมี Node.js
  process รันอยู่บนเครื่อง และ IIS ส่งต่อ request ไปให้
- ถ้านโยบายเครื่องนั้นห้ามติดตั้ง/รัน Node.js จะต้องเปลี่ยนสถาปัตยกรรม เช่น
  ย้ายไปเครื่องที่รัน Node ได้ แล้วให้ IIS เดิม proxy ข้ามเครื่องไปหา
- **ไฟล์ฐานข้อมูล SQLite ต้องอยู่บนดิสก์ในเครื่อง (local disk) ห้ามวางบน network
  share / UNC path** — SQLite locking บน SMB ไม่น่าเชื่อถือและทำให้ข้อมูลเสียหายได้
  ถ้าต้องเก็บไว้บน share จริง ๆ ควรเปลี่ยนไปใช้ SQL Server แทน
- รันได้ **instance เดียว** ต่อไฟล์ฐานข้อมูล — ห้าม scale out หรือเปิด IIS
  web garden (Maximum Worker Processes ต้องเป็น 1 ถ้าใช้ app pool)

---

## 1. เตรียมเครื่อง server (ทำครั้งเดียว)

| สิ่งที่ต้องมี | หมายเหตุ |
| --- | --- |
| **Node.js 22 LTS** (x64) | `node -v` ต้องได้ ≥ 20.9 ติดตั้งแบบ machine-wide |
| **IIS** + role Web Server | เปิด Application Development → WebSocket Protocol ด้วย |
| **URL Rewrite 2.1** | [ดาวน์โหลด](https://www.iis.net/downloads/microsoft/url-rewrite) |
| **Application Request Routing (ARR) 3.0** | [ดาวน์โหลด](https://www.iis.net/downloads/microsoft/application-request-routing) |
| **NSSM** (`nssm.exe`) | [nssm.cc](https://nssm.cc) ใช้ทำ Node เป็น Windows service |

เปิด proxy ของ ARR หลังติดตั้ง (ทำครั้งเดียวต่อเครื่อง):

```powershell
# IIS Manager → เลือกชื่อเครื่อง → Application Request Routing Cache →
# Server Proxy Settings → ติ๊ก "Enable proxy"  หรือสั่งจาก command line:
C:\Windows\System32\inetsrv\appcmd.exe set config `
  -section:system.webServer/proxy /enabled:"True" /commit:apphost
```

สร้างโฟลเดอร์ 2 ที่ **บนดิสก์ในเครื่อง**

```powershell
New-Item -ItemType Directory -Force D:\apps\est-manday      # ตัวแอป (release)
New-Item -ItemType Directory -Force D:\appdata\est-manday    # ฐานข้อมูล + secret
```

---

## 2. สร้าง release (ทำบนเครื่อง dev)

```powershell
cd C:\Source\Claude\EstManday
.\deploy\publish.ps1 -OutDir D:\release\est-manday
```

ได้โฟลเดอร์ประมาณ 90 MB ที่มี `server.js`, `node_modules` เท่าที่จำเป็น,
`.next`, `scripts\`, `drizzle\` — **ไม่ต้องรัน `npm install` บน server**

> `better-sqlite3` แนบ prebuilt binary มาให้ทุก platform จึงไม่ต้องมี compiler
> ทั้งบนเครื่อง dev และบน server (ดูเหตุผลใน `.npmrc`) แต่ต้อง publish จากเครื่องที่
> เป็น **x64 เหมือน server**

คัดลอกโฟลเดอร์ทั้งก้อนไปที่ `D:\apps\est-manday` บนเครื่อง server

---

## 3. ติดตั้งบนเครื่อง server

### 3.1 สร้าง / อัปเกรดฐานข้อมูล

```powershell
cd D:\apps\est-manday
$env:DATABASE_PATH = 'D:\appdata\est-manday\estmanday.db'
$env:NODE_ENV = 'production'

node scripts\migrate.cjs     # สร้างหรืออัปเกรด schema (idempotent)
node scripts\seed.cjs        # โหลด master data จาก standard matrix
```

`seed.cjs` บน production จะ

- ใส่ master data (14 บทบาท, 24 activity, 360 ค่า MD, ตัวคูณ stack, ชุดคำถาม)
- สร้างบัญชี admin หนึ่งบัญชี **พร้อมสุ่มรหัสผ่านและพิมพ์ออกหน้าจอครั้งเดียว**
  → คัดลอกเก็บไว้ แล้วเปลี่ยนรหัสหลัง login ครั้งแรก
- **ไม่** สร้างบัญชี demo estimator

กำหนดอีเมล/รหัสผ่าน admin เองได้:

```powershell
$env:ADMIN_EMAIL = 'someone@pttdigital.com'
$env:ADMIN_PASSWORD = '<รหัสที่ตั้งเอง>'
node scripts\seed.cjs
```

### 3.2 ทำ Node เป็น Windows service

รัน PowerShell **แบบ Run as Administrator**

```powershell
cd D:\apps\est-manday
.\deploy\install-service.ps1 `
    -AppDir  D:\apps\est-manday `
    -Port    3100 `
    -DataPath D:\appdata\est-manday\estmanday.db
```

สคริปต์จะ

- สร้าง/อัปเดต service ชื่อ `EstManday` ที่รัน `node server.js`
- bind ที่ `127.0.0.1:3100` เท่านั้น (เข้าจากนอกเครื่องตรง ๆ ไม่ได้)
- สุ่ม `SESSION_SECRET` เก็บไว้ที่ `D:\appdata\est-manday\session-secret.txt`
  และ **ใช้ค่าเดิมทุกครั้งที่ deploy ใหม่** (ถ้าเปลี่ยน ทุกคนจะถูก logout)
- ตั้ง auto-start, restart-on-failure และ log หมุนไฟล์ที่ `logs\stdout.log` /
  `logs\stderr.log`
- probe `http://127.0.0.1:3100/login` แล้วรายงานผล

ถ้าต้องรันด้วย service account เฉพาะ (แนะนำ):

```powershell
.\deploy\install-service.ps1 -AppDir D:\apps\est-manday `
    -DataPath D:\appdata\est-manday\estmanday.db `
    -ServiceAccount 'PTT\svc-estmanday' `
    -ServiceAccountPassword (Read-Host -AsSecureString 'password')
```

แล้วให้สิทธิ์บัญชีนั้น

| โฟลเดอร์ | สิทธิ์ |
| --- | --- |
| `D:\appdata\est-manday` | **Modify** (ต้องเขียนไฟล์ `.db`, `-wal`, `-shm`) |
| `D:\apps\est-manday` | Read & execute |
| `D:\apps\est-manday\logs` | Modify |

### 3.3 ตั้ง IIS site

```powershell
Import-Module WebAdministration

# โฟลเดอร์ว่างสำหรับ site — IIS ไม่ต้องเสิร์ฟไฟล์อะไรเอง ทุก request ถูก proxy
New-Item -ItemType Directory -Force C:\inetpub\est-manday
Copy-Item D:\apps\est-manday\deploy\web.config C:\inetpub\est-manday\

New-WebAppPool -Name 'EstMandayProxy'
Set-ItemProperty IIS:\AppPools\EstMandayProxy managedRuntimeVersion ''
Set-ItemProperty IIS:\AppPools\EstMandayProxy processModel.maxProcesses 1

New-Website -Name 'EstManday' -PhysicalPath C:\inetpub\est-manday `
    -ApplicationPool 'EstMandayProxy' -Port 443 -Ssl `
    -HostHeader 'estmanday.ptt.corp'
```

ผูก certificate ที่ binding 443 ผ่าน IIS Manager (Site Bindings → Edit → เลือก cert)

> ถ้าจะ deploy เป็น **application ใต้ site เดิม** ให้สร้าง application แล้ววาง
> `web.config` ในโฟลเดอร์นั้น และแก้ rewrite rule เป็น
> `http://127.0.0.1:3100/ชื่อ-app/{R:1}` พร้อมตั้ง `basePath` ใน `next.config.ts`
> ให้ตรงกัน แล้ว build ใหม่

`web.config` ที่ให้มาทำ

- rewrite ทุก request ไป `http://127.0.0.1:3100`
- ส่ง `X-Forwarded-Proto` / `X-Forwarded-Host` เพื่อให้ redirect และ cookie ถูกต้อง
- แก้ `Location` header ขากลับไม่ให้หลุด `127.0.0.1` ออกไปหา client
- บล็อกการเข้าถึง `data`, `.next`, `node_modules`, `scripts`, ไฟล์ `.db` / `.env` /
  `.xlsx` เป็นชั้นป้องกันสำรอง
- ใส่ `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`

ต้องเปิด server variable ให้ rewrite เขียนได้ (ครั้งเดียวต่อ site):

```powershell
# IIS Manager → site → URL Rewrite → View Server Variables → Add
# เพิ่ม HTTP_X_FORWARDED_PROTO และ HTTP_X_FORWARDED_HOST
C:\Windows\System32\inetsrv\appcmd.exe set config 'EstManday' `
  -section:system.webServer/rewrite/allowedServerVariables `
  /+"[name='HTTP_X_FORWARDED_PROTO']" /commit:apphost
C:\Windows\System32\inetsrv\appcmd.exe set config 'EstManday' `
  -section:system.webServer/rewrite/allowedServerVariables `
  /+"[name='HTTP_X_FORWARDED_HOST']" /commit:apphost
```

### 3.4 ตรวจว่าใช้ได้

```powershell
Get-Service EstManday                                     # ต้องเป็น Running
Invoke-WebRequest http://127.0.0.1:3100/login -UseBasicParsing | `
  Select-Object StatusCode                                # 200
Invoke-WebRequest https://estmanday.ptt.corp/login | `
  Select-Object StatusCode                                # 200 ผ่าน IIS
```

จากนั้นเปิดเบราว์เซอร์ login ด้วยบัญชี admin → เข้า Standard Matrix ต้องเห็น 24 รายการ
→ สร้างโครงการทดสอบ → กด Export Excel ต้องได้ไฟล์ `.xlsx`

---

## 4. Deploy เวอร์ชันถัดไป

```powershell
# บนเครื่อง dev
.\deploy\publish.ps1 -OutDir D:\release\est-manday

# บนเครื่อง server (elevated)
nssm stop EstManday
# เก็บของที่ไม่ได้มาจาก release ไว้: logs กับฐานข้อมูล (ฐานข้อมูลอยู่นอกโฟลเดอร์แอปแล้ว)
Rename-Item D:\apps\est-manday D:\apps\est-manday.bak
Copy-Item D:\release\est-manday D:\apps\est-manday -Recurse

cd D:\apps\est-manday
$env:DATABASE_PATH = 'D:\appdata\est-manday\estmanday.db'
node scripts\migrate.cjs     # ถ้ามี migration ใหม่
node scripts\seed.cjs        # ถ้า master data เปลี่ยน (upsert ทับ ไม่ลบโครงการ)

nssm start EstManday
```

ถ้าเสีย ให้ `nssm stop` แล้วสลับโฟลเดอร์ `.bak` กลับ แล้ว `nssm start`

> ค่า MD ในโครงการที่ประเมินไว้แล้ว **ไม่เปลี่ยนตาม matrix ใหม่** จนกว่าผู้ใช้จะกด
> “คำนวณใหม่จาก Standard Matrix” ในโครงการนั้น ซึ่งเป็นพฤติกรรมที่ตั้งใจไว้

---

## 4.1 ตรวจก่อน deploy เวอร์ชันที่มี migration ใหม่

```powershell
# บนเครื่อง dev — จำลอง DB เวอร์ชันแรกที่มีโครงการประเมินค้างอยู่
# แล้วรัน migrate + seed จริง ตรวจว่าค่าที่ประเมินไว้ไม่หาย
npm run test:upgrade
```

## 5. สำรองข้อมูล

ฐานข้อมูลคือไฟล์เดียว แต่ใช้โหมด WAL จึง **ห้าม copy ตอน service กำลังรัน**
ให้ใช้คำสั่ง backup ของ SQLite

```powershell
# ทำเป็น scheduled task รายวัน
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$dest  = "D:\backup\est-manday\estmanday-$stamp.db"
New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null

cd D:\apps\est-manday
node -e @'
const Database = require('better-sqlite3')
const db = new Database(process.env.SRC, { readonly: true })
db.backup(process.env.DEST).then(() => { console.log('ok'); db.close() })
'@
```

(ตั้ง `$env:SRC` และ `$env:DEST` ก่อนเรียก) ควรสำรอง
`D:\appdata\est-manday\session-secret.txt` ไว้ด้วย

---

## 6. ตรวจปัญหา

| อาการ | สาเหตุที่พบบ่อย |
| --- | --- |
| IIS ขึ้น **502.3 / 500.52** | service ไม่ได้รัน หรือ ARR proxy ยังไม่ enable — ดู `logs\stderr.log` |
| หน้าเว็บขึ้นแต่ CSS หาย | ลืมคัดลอก `.next\static` — `publish.ps1` จัดการให้แล้ว ตรวจว่า copy ครบ |
| login แล้วเด้งกลับหน้า login | `SESSION_SECRET` เปลี่ยนไปจากตอน deploy ก่อน หรือ cookie `secure` ถูกส่งผ่าน HTTP — ต้องเข้าผ่าน HTTPS |
| redirect ไปโผล่ `127.0.0.1:3100` | ยังไม่ได้เพิ่ม allowed server variables ในข้อ 3.3 |
| `SQLITE_CANTOPEN` / `SQLITE_READONLY` | service account เขียน `D:\appdata\est-manday` ไม่ได้ |
| `database is locked` เป็นระยะ | มีมากกว่า 1 instance เขียนไฟล์เดียวกัน หรือไฟล์อยู่บน network share |
| service start แล้วดับทันที | `SESSION_SECRET` ไม่ได้ตั้งหรือสั้นกว่า 16 ตัวอักษร — ดู `logs\stderr.log` |

## 7. สิ่งที่ยังควรทำต่อ

รายการเหล่านี้อยู่นอกขอบเขตที่ทำไว้ แต่ควรพิจารณาก่อนใช้งานจริงจัง

- **เชื่อม AD/LDAP** แทน email+password เพื่อไม่ต้องดูแลรหัสผ่านเอง
- **หน้าจัดการผู้ใช้** ตอนนี้ต้องเพิ่มผู้ใช้ผ่าน `seed.cjs` หรือ SQL
- **audit log** ว่าใครแก้ค่า MD ของโครงการเมื่อไร
- **ย้ายไป SQL Server** ถ้าต้องใช้หลาย instance, HA, หรือเก็บ DB บน share
