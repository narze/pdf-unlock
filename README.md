# pdf-unlock

เครื่องมือ CLI สำหรับเอา password protection ออกจากไฟล์ PDF (ต้องรู้ password ที่ถูกต้องอยู่แล้ว) โดยใช้ [qpdf](https://github.com/qpdf/qpdf) เบื้องหลัง ไฟล์ต้นฉบับจะถูก backup ไว้ในโฟลเดอร์ `backup` ข้างไฟล์เดิมก่อนแก้ไขทุกครั้ง

## ข้อกำหนดเบื้องต้น

ต้องมี Node.js 24 ขึ้นไป โปรเจกต์นี้ระบุเวอร์ชันไว้ใน `mise.toml` แล้ว ถ้าใช้ [mise](https://mise.jdx.dev) ให้รัน:

```bash
mise install
```

และต้องติดตั้ง `qpdf` ไว้ในเครื่องด้วย:

```bash
# macOS
brew install qpdf

# Debian/Ubuntu
sudo apt-get install qpdf

# Windows
choco install qpdf
```

ถ้ายังไม่ได้ติดตั้ง โปรแกรมจะแจ้งเตือนและบอกวิธีติดตั้งให้อัตโนมัติ

## การใช้งาน

```bash
# ไฟล์เดียว ระบุ password ตรงๆ
npx pdf-unlock statement.pdf -p mypassword

# ทั้งโฟลเดอร์ (เฉพาะไฟล์ .pdf ในระดับบนสุด)
npx pdf-unlock ./statements -p mypassword

# ทั้งโฟลเดอร์ รวมโฟลเดอร์ย่อยด้วย
npx pdf-unlock ./statements -r -p mypassword

# ไม่ระบุ password ในคำสั่ง จะถามแบบซ่อนตัวอักษร (interactive)
npx pdf-unlock ./statements -r

# ดูก่อนว่าจะประมวลผลไฟล์ไหนบ้าง โดยยังไม่แก้ไขจริง
npx pdf-unlock ./statements -r --dry-run
```

## Options

| Option | คำอธิบาย |
| --- | --- |
| `-p, --password <pw>` | password ของไฟล์ PDF (ถ้าไม่ระบุจะถาม interactive) |
| `-r, --recursive` | ค้นหาไฟล์ `.pdf` ในโฟลเดอร์ย่อยด้วย |
| `--backup-dir <name>` | ชื่อโฟลเดอร์ backup (default: `backup`) |
| `--no-backup` | ข้ามการ backup ไฟล์ต้นฉบับ (ไม่แนะนำ) |
| `--dry-run` | แสดงรายการไฟล์ที่จะประมวลผล โดยไม่แก้ไขไฟล์จริง |

## พฤติกรรมการ backup

ทุกครั้งที่ประมวลผลไฟล์ `path/to/file.pdf` โปรแกรมจะ copy ไฟล์ต้นฉบับไปไว้ที่ `path/to/backup/file.pdf` ก่อน แล้วค่อยเขียนทับไฟล์เดิมด้วยเวอร์ชันที่ปลด password แล้ว ถ้ามี backup อยู่แล้ว (ชื่อซ้ำ) จะไม่ backup ซ้ำ

เมื่อใช้ `-r` (recursive) ทุกโฟลเดอร์ย่อยจะมีโฟลเดอร์ `backup` ของตัวเอง และโปรแกรมจะไม่เดินเข้าไปในโฟลเดอร์ `backup` ซ้ำ (ป้องกันการ backup ไฟล์ backup)

## ไฟล์ที่ไม่ได้ encrypt

ถ้าไฟล์ PDF ไหนไม่ได้ตั้ง password ไว้อยู่แล้ว โปรแกรมจะข้ามผ่านแบบไม่มี error (qpdf ประมวลผลไฟล์ปกติได้โดยไม่ต้องใช้ password ที่ถูกต้อง)

## Password ผิด

ถ้า password ไม่ตรงกับไฟล์ใด โปรแกรมจะรายงานว่า `WRONG PW` สำหรับไฟล์นั้น และไปทำไฟล์ถัดไปต่อ (ไม่หยุดทั้งหมด) สรุปผลตอนท้ายจะบอกจำนวนไฟล์ที่สำเร็จ/ล้มเหลว

## การพัฒนา

โปรเจกต์นี้ใช้ [pnpm](https://pnpm.io) เป็น package manager และ [mise](https://mise.jdx.dev) จัดการเวอร์ชัน Node

```bash
mise install        # ติดตั้ง Node 24 + pnpm ตามที่ระบุใน mise.toml
pnpm install        # โปรเจกต์นี้ไม่มี dependency แต่รันเพื่อ sync lockfile
pnpm test           # รัน test ทั้งหมด
```

### Test

ใช้ test runner ที่มาพร้อม Node (`node:test`) ไม่มี dependency เพิ่ม เทสต์สร้างไฟล์ PDF ที่ encrypt จริงด้วย `qpdf` ในโฟลเดอร์ชั่วคราว ดังนั้นต้องติดตั้ง `qpdf` ก่อนรันเทสต์

```bash
pnpm test                                   # ทั้งหมด
node --test test/cli.test.js                # เฉพาะไฟล์เดียว
node --test --test-name-pattern="backup"    # เฉพาะเทสต์ที่ชื่อตรงกับ pattern
```

| ไฟล์ | ครอบคลุม |
| --- | --- |
| `test/helpers.js` | ตัวช่วยสร้างไฟล์ PDF ตัวอย่าง (ไม่ใช่ไฟล์เทสต์) |
| `test/collectPdfFiles.test.js` | การค้นหาไฟล์ recursive และการข้ามโฟลเดอร์ backup |
| `test/unlockFile.test.js` | backup, temp file, การแยกแยะ password ผิดจาก error อื่น |
| `test/cli.test.js` | รัน CLI จริงผ่าน subprocess (exit code, output, ไฟล์ผลลัพธ์) |
| `test/checkQpdf.test.js` | การตรวจหา qpdf และข้อความบอกวิธีติดตั้ง |
