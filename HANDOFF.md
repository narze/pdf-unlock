# Handoff - pdf-unlock

## สถานะ

เสร็จแล้ว มี automated test ครอบคลุม (37 เทสต์ ผ่านหมด - ดูหัวข้อ "Test" ด้านล่าง) ยังไม่ได้ publish ขึ้น npm registry - ตอนนี้เป็น local package รอทดสอบกับไฟล์จริงก่อน

Toolchain: Node 24 + pnpm ระบุไว้ใน `mise.toml` และ `packageManager` ใน `package.json`

## วิธีรัน local (ยังไม่ publish)

ไม่ต้อง publish ก็ลองรันได้เลย เลือกวิธีใดวิธีหนึ่ง:

**1. รันตรงด้วย node (เร็วสุด ไม่ต้อง install อะไร)**
```bash
cd pdf-unlock
node bin/pdf-unlock.js ./path/to/statements -r -p yourpassword
```

**2. `pnpm link` (จะได้ใช้คำสั่ง `pdf-unlock` เฉยๆ เหมือน install จริง)**
```bash
cd pdf-unlock
pnpm link          # pnpm 10: ไม่ต้องใส่ --global
# ตอนนี้เรียกจากที่ไหนก็ได้:
pdf-unlock ./path/to/statements -r -p yourpassword
# เลิกใช้ตอนไหนก็เอาออก:
pnpm uninstall --global pdf-unlock
```

**3. `pnpm dlx` แบบ local path (จำลองพฤติกรรม `npx pdf-unlock` จริงๆ)**
```bash
pnpm dlx /path/to/pdf-unlock ./path/to/statements -r
```

## Pre-requisite

Node 24 ขึ้นไป และ `qpdf` ติดตั้งในเครื่องที่จะรัน (ตัว CLI จะเช็ค qpdf ให้อัตโนมัติและบอกวิธีติดตั้งถ้าไม่เจอ) เช็คเองก่อนได้ด้วย:
```bash
mise install     # ติดตั้ง Node 24 + pnpm ตาม mise.toml
node -v
qpdf --version
```

## Test

```bash
pnpm test                        # ทั้งหมด (37 เทสต์)
node --test test/cli.test.js     # เฉพาะไฟล์เดียว
```

เทสต์ใช้ `node:test` ที่มากับ Node (ไม่มี dependency เพิ่ม) และสร้างไฟล์ PDF ที่ encrypt จริงด้วย `qpdf` ในโฟลเดอร์ชั่วคราว จึงต้องมี `qpdf` ในเครื่องก่อนรัน

ครอบคลุม:

- `--help` และไม่ใส่ argument เลย -> usage ถูกต้อง, exit code ตรง (0 / 1)
- `--dry-run` -> list ไฟล์ถูกต้อง ไม่แตะไฟล์จริง ไม่สร้างโฟลเดอร์ backup
- password ผิด -> รายงาน `WRONG PW`, ไฟล์ต้นฉบับยัง encrypt อยู่เหมือนเดิม, batch ไปต่อจนจบ, exit 1
- password ถูก ไม่ recursive -> แก้เฉพาะไฟล์ level บนสุด ไฟล์ในโฟลเดอร์ย่อยยัง encrypt อยู่
- password ถูก แบบ recursive (`-r`) -> แก้ทุกระดับ, แต่ละระดับมี `backup/` ของตัวเอง
- รันซ้ำ -> ไม่เอาไฟล์ใน `backup/` มาประมวลผล และไม่ทับ backup เดิมด้วยไฟล์ที่ decrypt แล้ว
- `--no-backup` และ `--backup-dir <name>`
- interactive password prompt -> รับจาก stdin ได้ และไม่ echo password ออก stdout
- password ว่าง -> exit 1 ไม่แตะไฟล์
- **password ที่มีอักขระพิเศษของ shell** (`$( )`, backtick, quote, `|`, `&`) -> ทำงานถูกต้องและไม่มีการรัน shell
- **path ที่มีช่องว่างและภาษาไทย** -> ทำงานถูกต้องทั้งไฟล์และโฟลเดอร์ backup
- ไฟล์เสีย/ไม่ใช่ PDF -> รายงานเป็น `error` ไม่ใช่ `invalid-password`
- ไม่มีไฟล์ temp `.pdf-unlock-tmp-*` ค้างหลังรัน ทั้งกรณีสำเร็จและล้มเหลว
- ไม่เจอ `qpdf` ใน PATH -> รายงานถูกต้องพร้อมวิธีติดตั้งตาม platform

**ยังไม่ได้ทดสอบ**: ไฟล์ PDF จริงจากธนาคาร (ใช้แต่ synthetic PDF ที่สร้างด้วย qpdf), บน Windows, ไฟล์ที่ยังเป็น Google Drive cloud-only (ต้อง sync ให้เป็นไฟล์ local ก่อนเสมอ - โปรแกรมไม่ได้ handle เคสนี้เป็นพิเศษ ถ้าไฟล์ยัง cloud-only จะเจอ error จาก filesystem ตรงๆ)

## ของที่ยังไม่ทำ / ตัดสินใจเพิ่มเติมได้

- **Publish ขึ้น npm จริง**: ถ้าจะใช้ `npx pdf-unlock` แบบไม่ต้อง clone repo ต้อง publish ก่อน (`pnpm publish` จากโฟลเดอร์นี้) - เช็คก่อนว่าชื่อ `pdf-unlock` ว่างบน npm registry (ตอนนี้ยังไม่ได้เช็ค)
- ยังไม่มี CI ที่รัน `pnpm test` อัตโนมัติ (โฟลเดอร์นี้ยังไม่เป็น git repo ด้วย)
- ไม่ได้ทำ progress bar / concurrency (ประมวลผลทีละไฟล์ตามลำดับ) - ถ้าไฟล์เยอะมากอาจช้า แต่ปลอดภัยกว่า (backup + decrypt ทีละไฟล์ชัดเจน)

## ไฟล์ในโปรเจกต์

```
pdf-unlock/
  bin/pdf-unlock.js      CLI entry point (arg parsing, main loop)
  src/checkQpdf.js       เช็ค qpdf + install instructions
  src/promptPassword.js  masked password prompt (zero-dependency)
  src/index.js           หาไฟล์ pdf, backup, เรียก qpdf decrypt
  test/helpers.js        ตัวช่วยสร้าง PDF ตัวอย่าง (ไม่ใช่ไฟล์เทสต์)
  test/*.test.js         เทสต์ (node:test)
  mise.toml              เวอร์ชัน Node + pnpm
  package.json
  pnpm-lock.yaml
  README.md              คู่มือการใช้งาน (สำหรับคนที่จะใช้ทั่วไป)
  HANDOFF.md             ไฟล์นี้ - สำหรับคนต่องาน/ทดสอบต่อ
```
