# DOE Meeting API

เอกสาร API ของระบบบันทึกรายงานการประชุม กองระบาดวิทยา สำหรับทีมพัฒนา front-end ที่ deploy แยกบน **Cloudflare Pages**

**Base URL**

```
https://epid-odpc2.ddc.moph.go.th/doemeeting/api
```

> แอปตั้ง `basePath: "/doemeeting"` ไว้ ทุก path ในเอกสารนี้ต่อท้าย Base URL เช่น `GET {BASE_URL}/meetings`

---

## สารบัญ

1. [ภาพรวม Endpoints](#1-ภาพรวม-endpoints)
2. [เริ่มต้นใช้งาน (Quick start)](#2-เริ่มต้นใช้งาน-quick-start)
3. [การยืนยันตัวตน](#3-การยืนยันตัวตน)
4. [CORS และโดเมนของ front-end](#4-cors-และโดเมนของ-front-end)
5. [รูปแบบ Response และ Error](#5-รูปแบบ-response-และ-error)
6. [Data Models](#6-data-models)
7. [รายงานการประชุม (Meetings)](#7-รายงานการประชุม-meetings)
8. [Lookups และสถิติ](#8-lookups-และสถิติ)
9. [ข้อมูลส่วนตัว (Me)](#9-ข้อมูลส่วนตัว-me)
10. [สมัครสมาชิกและจัดการผู้ใช้ (Admin)](#10-สมัครสมาชิกและจัดการผู้ใช้-admin)
11. [ไฟล์แนบ](#11-ไฟล์แนบ)
12. [ข้อควรรู้และข้อจำกัด](#12-ข้อควรรู้และข้อจำกัด)
13. [Checklist สำหรับทีมดูแล API (deploy)](#13-checklist-สำหรับทีมดูแล-api-deploy)

---

## 1. ภาพรวม Endpoints

| Method | Path | Auth | คำอธิบาย |
|---|---|---|---|
| POST | `/token` | - | Login คืนค่า access token |
| POST | `/register` | - | สมัครสมาชิก (รอแอดมินอนุมัติ) |
| GET | `/me` | 🔑 | ข้อมูลผู้ใช้ที่ login อยู่ |
| PATCH | `/me` | 🔑 | แก้ไขข้อมูลส่วนตัว / เปลี่ยนรหัสผ่าน |
| GET | `/meetings` | 🔑 | รายการประชุม + ค้นหา + กรอง + แบ่งหน้า |
| POST | `/meetings` | 🔑 | สร้างรายงาน (พร้อมไฟล์แนบ) |
| GET | `/meetings/{id}` | 🔑 | รายละเอียดรายงาน |
| PUT | `/meetings/{id}` | 🔑 | แก้ไขรายงาน (ไม่รองรับไฟล์) |
| DELETE | `/meetings/{id}` | 🔑 | ลบรายงาน |
| GET | `/lookups` | 🔑 | ตัวเลือก (master data) ทั้งหมดสำหรับฟอร์ม |
| GET | `/stats/meetings-by-organizer` | 🔑 | ข้อมูลกราฟจำนวนประชุมแยกตามผู้จัด |
| GET | `/stats/meetings-by-month` | 🔑 | ข้อมูลกราฟจำนวนประชุมรายเดือน |
| GET | `/users` | 👑 | รายการผู้ใช้ |
| POST | `/users` | 👑 | เพิ่มผู้ใช้ |
| GET | `/users/{id}` | 👑 | รายละเอียดผู้ใช้ |
| PATCH | `/users/{id}` | 👑 | แก้ไขผู้ใช้ / รีเซ็ตรหัสผ่าน / ระงับ |
| DELETE | `/users/{id}` | 👑 | ลบผู้ใช้ |
| POST | `/users/{id}/approve` | 👑 | อนุมัติผู้ใช้ |
| POST | `/users/{id}/reject` | 👑 | ไม่อนุมัติผู้ใช้ |

Auth: `-` ไม่ต้อง login · `🔑` ต้อง login · `👑` ต้องเป็นแอดมิน (`role = ADMIN`)

---

## 2. เริ่มต้นใช้งาน (Quick start)

### 2.1 Environment variable ฝั่ง front-end

ตัวอย่างนี้ใช้ Vite แยกค่าตามช่วงงาน:

```bash
# .env.development  (พัฒนาบน localhost ผ่าน dev proxy ดูข้อ 2.3)
VITE_API_BASE_URL=/doemeeting/api
VITE_FILE_BASE_URL=/doemeeting

# .env.production  (build ไป deploy บน Cloudflare Pages)
VITE_API_BASE_URL=https://epid-odpc2.ddc.moph.go.th/doemeeting/api
VITE_FILE_BASE_URL=https://epid-odpc2.ddc.moph.go.th/doemeeting
```

ค่าของ production ตั้งใน Cloudflare Pages (Settings → Environment variables) แทนไฟล์ `.env.production` ก็ได้

### 2.2 ตัวอย่าง API client

```js
// src/lib/api.js
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const TOKEN_KEY = "doemeeting_token";

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `HTTP ${status}`);
    this.status = status;
    this.code = body?.code;
  }
}

export async function api(path, { method = "GET", json, formData, query } = {}) {
  const url = new URL(API_BASE + path, window.location.origin); // รองรับทั้ง URL เต็มและ path relative
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
  }

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: json ? JSON.stringify(json) : formData, // FormData: ห้ามตั้ง Content-Type เอง
  });

  const body = await res.json().catch(() => null);

  if (res.status === 401 && path !== "/token") {
    clearToken();
    // TODO: redirect ไปหน้า login
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}
```

ตัวอย่างการเรียก:

```js
const { data } = await api("/token", { method: "POST", json: { username, password } });
setToken(data.accessToken);

const { data: meetings, pagination } = await api("/meetings", { query: { page: 1, search: "ไข้เลือดออก" } });
const { data: lookups } = await api("/lookups");
```

### 2.3 พัฒนาบน localhost (dev proxy)

ช่วงพัฒนาบนเครื่องให้ใช้ proxy ของ dev server ส่งต่อ `/doemeeting/*` ไปยัง API จริง browser จะมองว่าเรียกโดเมนเดียวกัน จึง**ไม่ต้องตั้ง CORS บน server** และเปิดไฟล์แนบผ่าน proxy ได้ด้วย

**Vite**

```js
// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/doemeeting": {
        target: "https://epid-odpc2.ddc.moph.go.th",
        changeOrigin: true,
      },
    },
  },
});
```

**Next.js** (กรณี front-end ใช้ Next)

```js
// next.config.mjs
export default {
  async rewrites() {
    return [
      {
        source: "/doemeeting/:path*",
        destination: "https://epid-odpc2.ddc.moph.go.th/doemeeting/:path*",
      },
    ];
  },
};
```

> proxy ของ dev server ใช้ได้เฉพาะตอน `npm run dev` เท่านั้น เมื่อ build ไป deploy บน Cloudflare Pages แล้ว front-end จะเรียก API ตรงด้วย URL เต็ม จึงต้องตั้ง CORS บน server ให้โดเมน Pages (ดู [หัวข้อ 4](#4-cors-และโดเมนของ-front-end))

---

## 3. การยืนยันตัวตน

front-end แยกใช้ **Bearer token** ส่งใน header ทุกคำขอที่ต้อง login:

```
Authorization: Bearer <accessToken>
```

> ทำไมไม่ใช้ cookie: front-end บน Cloudflare Pages อยู่คนละโดเมนกับ API browser หลายตัว (เช่น Safari) จะบล็อก cookie ข้ามโดเมน ทำให้ login ไม่ติด ส่วน `/auth/*` (NextAuth แบบ cookie) มีไว้ให้เว็บเดิมใช้เท่านั้น front-end ใหม่ไม่ต้องใช้

### 3.1 Login

```http
POST /token
Content-Type: application/json

{ "username": "somchai", "password": "P@ssw0rd123" }
```

**Response 200**

```json
{
  "message": "เข้าสู่ระบบสำเร็จ",
  "data": {
    "accessToken": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..xxxx",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "expiresAt": "2026-11-02T04:00:00.000Z",
    "user": {
      "id": "clx9k2m3n0000abcd",
      "username": "somchai",
      "email": "somchai@example.com",
      "name": "สมชาย ใจดี",
      "department": "กองระบาดวิทยา",
      "role": "USER",
      "status": "APPROVED",
      "approvedAt": "2026-11-01T03:00:00.000Z",
      "approvedById": "clx1abc2d0000xyz",
      "createdAt": "2026-10-30T02:00:00.000Z",
      "updatedAt": "2026-11-01T03:00:00.000Z"
    }
  }
}
```

**Errors**

| Status | `code` | `message` |
|---|---|---|
| 400 | | `รูปแบบข้อมูลไม่ถูกต้อง` (body ไม่ใช่ JSON) |
| 401 | `INVALID` | `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง` |
| 403 | `PENDING` | `บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบอนุมัติ` |
| 403 | `NOT_ALLOWED` | `บัญชีของคุณไม่ได้รับอนุญาตให้ใช้งาน` (ถูกปฏิเสธ หรือถูกระงับ) |

### 3.2 อายุ token และการ logout

- token มีอายุ **24 ชั่วโมง** (`expiresIn` วินาที / `expiresAt`) ไม่มี refresh token เมื่อหมดอายุ API จะตอบ `401` ให้พาผู้ใช้ไป login ใหม่
- **Logout** = ลบ token ฝั่ง front-end (ไม่มี endpoint logout)
- server ตรวจสถานะผู้ใช้จากฐานข้อมูลทุกคำขอ ถ้าผู้ใช้ถูก **ระงับ / ลบ** จะได้ `401` ทันที และถ้าถูก **ลดสิทธิ์** จาก ADMIN endpoint แอดมินจะได้ `403` ทันที แม้ token ยังไม่หมดอายุ
- `role` ใน `data.user` ใช้ซ่อน/แสดงเมนูแอดมินได้ แต่ควรเรียก `GET /me` ตอนเปิดแอปเพื่อเช็คว่า token ยังใช้ได้และได้ข้อมูลล่าสุด

### 3.3 การเก็บ token

- แนะนำ `sessionStorage` (หายเมื่อปิดแท็บ) หรือเก็บใน memory หากต้องการ "จดจำการเข้าสู่ระบบ" ให้ใช้ `localStorage`
- token ที่อยู่ใน storage ถูกขโมยได้หากเว็บมีช่องโหว่ XSS ห้ามแสดง HTML จากข้อมูลผู้ใช้โดยตรง (เช่น `dangerouslySetInnerHTML` / `v-html` กับ `summary`)

### 3.4 ลืมรหัสผ่าน

ไม่มีระบบรีเซ็ตรหัสผ่านด้วยตัวเอง หน้า login ให้แสดงข้อความประมาณ **"ลืมรหัสผ่าน? กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน"** แอดมินจะตั้งรหัสใหม่ให้ผ่าน `PATCH /users/{id}` ([10.6](#106-แก้ไขข้อมูลผู้ใช้)) จากนั้นผู้ใช้ควรเปลี่ยนรหัสเองผ่าน `PATCH /me` ([9.2](#92-แก้ไขข้อมูลส่วนตัว--เปลี่ยนรหัสผ่าน))

---

## 4. CORS และโดเมนของ front-end

API อนุญาตเฉพาะ origin ที่อยู่ในค่า env `CORS_ALLOWED_ORIGINS` บน server ของ API ทีม front-end ต้อง**แจ้งโดเมนทั้งหมด**ให้ทีม API เพิ่ม เช่น

| ใช้กับ | ตัวอย่าง origin |
|---|---|
| Production (Cloudflare Pages) | `https://doemeeting.pages.dev` |
| Preview deployment ทุก branch | `https://*.doemeeting.pages.dev` (รองรับ wildcard) |
| Custom domain (ถ้ามี) | `https://meeting.example.go.th` |
| พัฒนาในเครื่อง | `http://localhost:5173` |

- ระหว่างพัฒนาตั้ง `CORS_ALLOWED_ORIGINS=*` เพื่ออนุญาตทุก origin ได้ แต่ก่อนขึ้นใช้งานจริงควรเปลี่ยนเป็นรายการโดเมนจริง
- origin ต้องตรงทั้ง scheme, host และ port ไม่มี `/` ท้าย
- header ที่ส่งได้: `Content-Type`, `Authorization`
- method ที่ใช้ได้: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- ไม่ต้องใช้ `credentials: "include"` เพราะไม่ได้ใช้ cookie
- ถ้า origin ไม่ได้รับอนุญาต preflight (`OPTIONS`) จะได้ `403` และ browser จะแสดง CORS error ใน console

---

## 5. รูปแบบ Response และ Error

ทุก endpoint ตอบเป็น JSON:

```json
{ "message": "ข้อความภาษาไทย", "data": {}, "pagination": {} }
```

- `message` จะมีใน error และใน action ที่เปลี่ยนข้อมูล (สร้าง/แก้ไข/ลบ) ฝั่ง front-end นำไปแสดงผู้ใช้ได้เลย
- `data` เป็นข้อมูลผลลัพธ์ ส่วน `pagination` มีเฉพาะ endpoint ที่เป็นรายการ

| HTTP Status | ความหมาย | ตัวอย่าง `message` |
|---|---|---|
| 200 | สำเร็จ | `อัปเดตรายงานสำเร็จ` |
| 201 | สร้างสำเร็จ | `บันทึกรายงานสำเร็จ` |
| 400 | ข้อมูลไม่ถูกต้อง | `กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วนและถูกต้อง`, `รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)` |
| 401 | ไม่มี token / token หมดอายุ / ผู้ใช้ถูกระงับหรือลบ | `ไม่อนุญาต` |
| 403 | login แล้วแต่ไม่มีสิทธิ์ | `ต้องเป็นผู้ดูแลระบบเท่านั้น` |
| 404 | ไม่พบข้อมูล | `ไม่พบรายงาน`, `ไม่พบผู้ใช้` |
| 409 | ข้อมูลซ้ำ | `ชื่อผู้ใช้นี้ถูกใช้งานแล้ว` |
| 500 | ข้อผิดพลาดฝั่ง server | `เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์` |

---

## 6. Data Models

วันที่และเวลาทั้งหมดเป็น ISO 8601 (UTC) เช่น `2026-10-15T00:00:00.000Z`

### 6.1 MeetingReport

| Field | Type | Nullable | คำอธิบาย |
|---|---|---|---|
| `id` | integer | | รหัสรายงาน |
| `status` | `"ATTENDEE"` \| `"ORGANIZER"` | | สถานะ: ผู้เข้าร่วมประชุม / ผู้จัดประชุม |
| `title` | string (≤255) | | ชื่อการประชุม |
| `format` | `"Online"` \| `"Onsite"` | | รูปแบบการประชุม |
| `startDate` | string | | วันที่เริ่ม (เก็บเฉพาะวันที่ ส่วนเวลาเป็น `00:00:00.000Z` เสมอ) |
| `endDate` | string | | วันที่สิ้นสุด |
| `organizerId` | integer | | รหัสหน่วยงานผู้จัดหลัก |
| `organizer` | Lookup | | `{ id, name }` (มีใน GET list/detail) |
| `otherOrganizer` | string (≤255) | ✔ | ชื่อหน่วยงานผู้จัดที่กรอกเอง เมื่อ `organizer` เป็น "อื่นๆ โปรดระบุ" (ไม่ใช่ "อื่นๆ" จะเป็น `null` เสมอ) |
| `coOrganizer` | string (≤255) | ✔ | หน่วยงานผู้จัดร่วม (ถ้ามี) |
| `otherObjective` | string (≤255) | ✔ | วัตถุประสงค์อื่นๆ (ใช้คู่กับวัตถุประสงค์ "อื่นๆ") |
| `summary` | string | | สรุปเนื้อหาการประชุม (ข้อความธรรมดา มีขึ้นบรรทัดใหม่ได้ แสดงด้วย `white-space: pre-wrap`) |
| `decisions` | string | ✔ | มติ/การตัดสินใจ (ข้อความยาวไม่จำกัดความยาว มีขึ้นบรรทัดใหม่ได้ เหมือน `summary`) ไม่ได้กรอกหรือรายงานเก่าเป็น `null` |
| `actionItems` | string | | สิ่งที่ต้องดำเนินการ (ข้อความธรรมดาเหมือน `summary`) รายงานเก่าก่อนมีฟิลด์นี้เป็น `""` |
| `summaryFileUrl` | string | ✔ | path ไฟล์สรุป ดู [ไฟล์แนบ](#11-ไฟล์แนบ) |
| `imageUrl1` | string | ✔ | path รูปประกอบ 1 |
| `imageUrl2` | string | ✔ | path รูปประกอบ 2 |
| `otherArea` | string (≤255) | ✔ | พื้นที่อื่นๆ (ใช้คู่กับพื้นที่ "อื่นๆ โปรดระบุ") |
| `otherScope` | string (≤255) | ✔ | ขอบเขตงานอื่นๆ (ใช้คู่กับ scope "อื่นๆ โปรดระบุ") |
| `otherDiseaseGroup` | string (≤255) | ✔ | กลุ่มโรคอื่นๆ (ใช้คู่กับกลุ่มโรค "อื่นๆ โปรดระบุ") |
| `summarizerId` | string | ✔ | รหัสผู้ใช้ที่เป็นผู้สรุปการประชุม (เมื่อเลือกจากผู้ใช้ในระบบ) |
| `summarizer` | UserRef | ✔ | `{ id, name, username, department }` ของผู้สรุป (มีใน GET list/detail) |
| `summarizerName` | string (≤255) | ✔ | ชื่อผู้สรุปที่พิมพ์เอง (เมื่อผู้สรุปไม่ใช่ผู้ใช้ในระบบ) มีค่าอย่างใดอย่างหนึ่งกับ `summarizerId` |
| `createdById` | string | ✔ | รหัสผู้ใช้ที่ทำรายการ (กำหนดจากผู้ที่ login ตอนสร้าง แก้ไขไม่ได้ รายงานเก่าเป็น `null`) |
| `createdBy` | UserRef | ✔ | `{ id, name, username, department }` ของผู้ทำรายการ (มีใน GET list/detail) |
| `createdAt` | string | | วันที่สร้าง |
| `updatedAt` | string | | วันที่แก้ไขล่าสุด |

ชื่อที่ใช้แสดง: ผู้ทำรายการ = `createdBy.name ?? createdBy.username` / ผู้สรุป = `summarizer.name ?? summarizer.username ?? summarizerName`

`GET /meetings/{id}` มี field เพิ่ม: `objectives`, `areas`, `scopes`, `diseaseGroups`, `diseases` (array ของ Lookup)

> ถ้าแปลง `startDate` ด้วย `new Date()` แล้วแสดงในเวลาไทย (UTC+7) จะได้วันที่ถูกต้อง แต่ถ้าแสดงในเขตเวลาที่ติดลบจะเลื่อนไปหนึ่งวัน ถ้าต้องการวันที่เพื่อใส่ใน `<input type="date">` ให้ใช้ `startDate.slice(0, 10)`

### 6.2 Lookup (Master Data)

Lookup ทุกตัวมีโครงสร้าง `{ "id": number, "name": string }` ยกเว้น `users` ที่เป็น `{ "id": string, "name": string, "department": string | null }`

| key ใน `/lookups` | ใช้กับ field | ตัวอย่างค่า |
|---|---|---|
| `organizers` (หน่วยงานผู้จัด) | `organizerId` (เลือก 1) | กองระบาดวิทยา, สำนักปลัดกระทรวงสาธารณสุข, อื่นๆ โปรดระบุ |
| `objectives` (วัตถุประสงค์) | `objectiveIds` (≥1) | ชี้แจง, แลกเปลี่ยนข้อมูล/ประสบการณ์, รายงานความคืบหน้า, หารือ/ตัดสินใจ, พัฒนาศักยภาพ, พัฒนานวัตกรรมหรือสร้างแรงบันดาลใจ, จัดทำคู่มือ/แนวทาง/แผน, อื่นๆ (8 รายการ) |
| `areas` (พื้นที่) | `areaIds` | เขตสุขภาพที่ 1 – 13, ไม่เฉพาะเจาะจง / ทั่วประเทศ, ต่างประเทศ, อื่นๆ โปรดระบุ (16 รายการ) |
| `scopes` (ขอบเขตงาน) | `scopeIds` | กฎหมาย ระเบียบ, แผนงานโครงการ/ตัวชี้วัด, งบประมาณ, …, ไม่เฉพาะเจาะจง, อื่นๆ โปรดระบุ (33 รายการ) |
| `diseaseGroups` (กลุ่มโรค) | `diseaseGroupIds` | โรคติดต่ออันตราย/โรคอุบัติใหม่/Disease X, โรคติดเชื้อระบบทางเดินหายใจ, …, การบาดเจ็บ/อุบัติเหตุ, ไม่เฉพาะเจาะจง, อื่นๆ โปรดระบุ (15 รายการ) |
| `users` (ผู้ใช้ที่อนุมัติแล้ว) | `summarizerId` | `name` เป็นชื่อ-นามสกุล ถ้าไม่มีจะใช้ username แทน ผู้ใช้ที่ถูกระงับ/รออนุมัติจะไม่อยู่ในรายการ |
| `diseases` (โรคเฉพาะ อ้างอิง MEBS) | `diseaseIds` | กาฬโรค, โรคไข้เลือดออก, … (ประมาณ 120 รายการ ควรใช้ dropdown ที่ค้นหาได้) |

> `id` ของ lookup เป็น auto-increment ในฐานข้อมูล **ห้าม hardcode** ให้ดึงจาก `GET /lookups` เสมอ ส่วนตัวเลือก "อื่นๆ" ให้เช็คจาก `name` ที่ขึ้นต้นด้วย `อื่นๆ` แล้วแสดง input ที่คู่กัน:

| ตัวเลือก "อื่นๆ" ของ | input | บังคับกรอกเมื่อเลือก |
|---|---|---|
| `organizers` | `otherOrganizer` | ✔ |
| `objectives` | `otherObjective` | ✔ |
| `areas` | `otherArea` | |
| `scopes` | `otherScope` | |
| `diseaseGroups` | `otherDiseaseGroup` | |

> `objectives`, `areas`, `scopes`, `diseaseGroups` เรียงตามลำดับที่กำหนดไว้แล้ว ให้แสดงตามลำดับที่ API ส่งมา **ห้ามเรียงใหม่ตามชื่อ** ส่วน `organizers` เรียงตามชื่อ และตัวเลือก "อื่นๆ" อยู่ท้ายรายการเสมอ

### 6.3 User

| Field | Type | Nullable | คำอธิบาย |
|---|---|---|---|
| `id` | string (cuid) | | รหัสผู้ใช้ |
| `username` | string | | ชื่อผู้ใช้สำหรับ login (ไม่ซ้ำกัน) |
| `email` | string | ✔ | |
| `name` | string | ✔ | ชื่อ-นามสกุล |
| `department` | string | ✔ | หน่วยงาน |
| `role` | `"ADMIN"` \| `"USER"` | | สิทธิ์ |
| `status` | `"PENDING"` \| `"APPROVED"` \| `"REJECTED"` \| `"SUSPENDED"` | | login ได้เฉพาะ `APPROVED` |
| `approvedAt` | string | ✔ | วันที่อนุมัติ |
| `approvedById` | string | ✔ | `id` ของแอดมินที่อนุมัติ |
| `createdAt` | string | | วันที่สร้างบัญชี |
| `updatedAt` | string | | วันที่แก้ไขล่าสุด |

API ไม่ส่ง `password` กลับมาในทุกกรณี

---

## 7. รายงานการประชุม (Meetings)

### 7.1 รายการประชุม

```http
GET /meetings?page=1&pageSize=20&keyword=&dateFrom=&dateTo=&organizerId=&department=&scopeId=&diseaseGroupId=&diseaseId=
```

| Query | Type | Default | คำอธิบาย |
|---|---|---|---|
| `page` | integer | `1` | |
| `pageSize` | integer | `20` | สูงสุด 100 |
| `search` | string | | ค้นจาก `title` อย่างเดียว (contains, ไม่สนตัวพิมพ์ใหญ่-เล็ก) คงไว้เพื่อให้เว็บเดิมใช้ได้ |
| `keyword` | string (ส่งซ้ำได้) | | ค้นแบบ contains ไม่สนตัวพิมพ์ใหญ่-เล็ก ใน `title`, `summary`, `decisions`, `actionItems`, `coOrganizer`, `otherOrganizer`, `otherObjective`, `otherScope`, `otherDiseaseGroup` และชื่อ lookup ที่ผูกกับรายงาน (ผู้จัด, วัตถุประสงค์, scope, กลุ่มโรค, โรค) ส่งหลายคำ = ต้องเจอ**ทุกคำ** (AND) แต่ละคำเจอที่ช่องไหนก็ได้ |
| `dateFrom` | `YYYY-MM-DD` | | `startDate >= dateFrom` |
| `dateTo` | `YYYY-MM-DD` | | `startDate <= dateTo` (รวมทั้งวัน) |
| `organizerId` | integer (ส่งซ้ำได้) | | หน่วยงานผู้จัดอยู่ในรายการ (OR) ส่งค่าเดียวได้เหมือนเดิม |
| `department` | string | | `createdBy.department` หรือ `summarizer.department` ตรงกับค่านี้ (ตรงทุกตัวอักษร) |
| `scopeId` | integer (ส่งซ้ำได้) | | มี scope อย่างน้อย 1 ตัวในรายการ (OR) |
| `diseaseGroupId` | integer (ส่งซ้ำได้) | | มีกลุ่มโรคอย่างน้อย 1 ตัวในรายการ (OR) |
| `diseaseId` | integer (ส่งซ้ำได้) | | มีโรคอย่างน้อย 1 ตัวในรายการ (OR) |

- "ส่งซ้ำได้" = `append` key เดิมหลายครั้ง เช่น `scopeId=4&scopeId=9` **ห้าม**คั่นด้วย comma
- ตัวกรองต่างชนิดรวมกันแบบ AND เช่น `scopeId=4&diseaseId=7` = ต้องมีทั้งสองอย่าง
- query ที่ว่าง (เช่น `keyword=`) ถูกละเลย
- `pagination.total` / `totalPages` นับหลังกรองแล้ว
- เรียงตาม `startDate` ใหม่ → เก่า
- แต่ละรายการมีทุก field ของ [MeetingReport](#61-meetingreport) รวมถึง `decisions` และ `actionItems` (ใช้ทำ popup ตอนชี้เมาส์ได้เลย ไม่ต้องเรียก `GET /meetings/{id}`) แต่ไม่มี tag (`objectives`, `areas`, ...)

```js
const qs = new URLSearchParams({ page: "1", dateFrom: "2026-01-01", dateTo: "2026-12-31" });
["ไข้เลือดออก", "เขต 6"].forEach((k) => qs.append("keyword", k));
[1, 3].forEach((id) => qs.append("organizerId", id));
qs.append("scopeId", "4");
const { data, pagination } = await api(`/meetings?${qs}`);
```

**Response 200**

```json
{
  "data": [
    {
      "id": 42,
      "status": "ATTENDEE",
      "title": "ประชุมชี้แจงแนวทางเฝ้าระวังไข้เลือดออก",
      "format": "Online",
      "startDate": "2026-10-15T00:00:00.000Z",
      "endDate": "2026-10-15T00:00:00.000Z",
      "organizerId": 1,
      "organizer": { "id": 1, "name": "กองระบาดวิทยา" },
      "otherOrganizer": null,
    "coOrganizer": null,
      "coOrganizer": null,
      "otherObjective": null,
      "summary": "สรุปประเด็นสำคัญ ...",
      "summaryFileUrl": "/uploads/1762858918640-report.pdf",
      "imageUrl1": null,
      "imageUrl2": null,
      "decisions": "ที่ประชุมเห็นชอบแนวทางเฝ้าระวังฉบับปรับปรุง",
      "actionItems": "ส่งแนวทางให้ สคร. ภายใน 30 พ.ย.",
      "otherArea": null,
      "otherScope": null,
      "otherDiseaseGroup": null,
      "summarizerId": "clx2abc...",
      "summarizer": { "id": "clx2abc...", "name": "สมหญิง ใจดี", "username": "somying", "department": "กองระบาดวิทยา" },
      "summarizerName": null,
      "createdById": "clx1xyz...",
      "createdBy": { "id": "clx1xyz...", "name": "สมชาย ใจดี", "username": "somchai", "department": "กองระบาดวิทยา" },
      "createdAt": "2026-11-01T03:12:45.123Z",
      "updatedAt": "2026-11-01T03:12:45.123Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 135, "totalPages": 7 }
}
```

ถ้าไม่พบข้อมูล `data` เป็น `[]` และ `totalPages` เป็น `0`

**Errors**

| Status | `message` |
|---|---|
| 400 | `organizerId ไม่ถูกต้อง` / `scopeId ไม่ถูกต้อง` / `diseaseGroupId ไม่ถูกต้อง` / `diseaseId ไม่ถูกต้อง` (มีค่าที่ไม่ใช่จำนวนเต็มบวก) |
| 400 | `dateFrom ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)` / `dateTo ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)` (รวมวันที่ที่ไม่มีจริง เช่น `2026-02-30`) |
| 401 | `ไม่อนุญาต` |

### 7.2 รายละเอียดรายงาน

```http
GET /meetings/{id}
```

**Response 200**

```json
{
  "data": {
    "id": 42,
    "status": "ATTENDEE",
    "title": "ประชุมชี้แจงแนวทางเฝ้าระวังไข้เลือดออก",
    "format": "Online",
    "startDate": "2026-10-15T00:00:00.000Z",
    "endDate": "2026-10-15T00:00:00.000Z",
    "organizerId": 1,
    "organizer": { "id": 1, "name": "กองระบาดวิทยา" },
    "otherOrganizer": null,
    "coOrganizer": null,
    "otherObjective": null,
    "summary": "สรุปประเด็นสำคัญ ...",
    "summaryFileUrl": "/uploads/1762858918640-report.pdf",
    "imageUrl1": null,
    "imageUrl2": null,
    "decisions": "ที่ประชุมเห็นชอบแนวทางเฝ้าระวังฉบับปรับปรุง",
    "actionItems": "ส่งแนวทางให้ สคร. ภายใน 30 พ.ย.",
    "otherArea": null,
    "otherScope": null,
    "otherDiseaseGroup": null,
    "summarizerId": null,
    "summarizer": null,
    "summarizerName": "นพ.ผู้เชี่ยวชาญ ภายนอก",
    "createdById": "clx1xyz...",
    "createdBy": { "id": "clx1xyz...", "name": "สมชาย ใจดี", "username": "somchai", "department": "กองระบาดวิทยา" },
    "objectives":    [{ "id": 1, "name": "ชี้แจง" }],
    "areas":         [{ "id": 2, "name": "เขตสุขภาพที่ 1" }],
    "scopes":        [{ "id": 4, "name": "การเฝ้าระวังโรคและภัยสุขภาพ" }],
    "diseaseGroups": [{ "id": 4, "name": "โรคติดต่อนำโดยแมลง" }],
    "diseases":      [{ "id": 22, "name": "โรคไข้เลือดออก" }],
    "createdAt": "2026-11-01T03:12:45.123Z",
    "updatedAt": "2026-11-01T03:12:45.123Z"
  }
}
```

ใช้ endpoint นี้เติมค่าในฟอร์มแก้ไขได้เลย เช่น `objectiveIds = data.objectives.map(o => o.id)` ส่วนผู้สรุปให้ใช้ `summarizerId` ถ้ามี ไม่เช่นนั้นใช้ `summarizerName` (ถ้า `summarizerId` ไม่อยู่ใน `lookups.users` เพราะผู้ใช้ถูกระงับ ให้แสดงชื่อจาก `summarizer` แล้วส่ง `summarizerId` เดิมกลับไปได้)

**Errors**: `400` (id ไม่ใช่ตัวเลข), `401`, `404` (`ไม่พบรายงาน`)

### 7.3 สร้างรายงาน

```http
POST /meetings
Content-Type: multipart/form-data
```

| Field | Type | Required | คำอธิบาย |
|---|---|---|---|
| `status` | `ATTENDEE` \| `ORGANIZER` | ✔ | |
| `title` | string (≤255) | ✔ | |
| `format` | `Online` \| `Onsite` | ✔ | ตัวพิมพ์ใหญ่-เล็กต้องตรง |
| `startDate` | `YYYY-MM-DD` | ✔ | |
| `endDate` | `YYYY-MM-DD` | ✔ | ต้องไม่ก่อน `startDate` |
| `organizerId` | integer | ✔ | |
| `otherOrganizer` | string | เมื่อเลือกผู้จัด "อื่นๆ โปรดระบุ" | ถ้าไม่ได้เลือก "อื่นๆ" ค่านี้จะถูกบันทึกเป็น `null` |
| `coOrganizer` | string | | หน่วยงานผู้จัดร่วม |
| `summary` | string | ✔ | |
| `decisions` | string | | มติ/การตัดสินใจ ว่างหรือมีแต่ช่องว่างจะถูกบันทึกเป็น `null` |
| `actionItems` | string | ✔ | สิ่งที่ต้องดำเนินการ |
| `summarizerId` | string | ✔ อย่างใดอย่างหนึ่ง | ผู้สรุปที่เป็นผู้ใช้ในระบบ (`id` จาก `GET /lookups` → `users`) ถ้าส่งมา `summarizerName` จะถูกละเลย |
| `summarizerName` | string (≤255) | ✔ อย่างใดอย่างหนึ่ง | ชื่อผู้สรุปที่พิมพ์เอง |
| `objectiveIds` | integer (ส่งซ้ำได้) | ✔ อย่างน้อย 1 | |
| `otherObjective` | string | เมื่อเลือกวัตถุประสงค์ "อื่นๆ" | ถ้าไม่ได้เลือก "อื่นๆ" ค่านี้จะถูกบันทึกเป็น `null` |
| `areaIds` | integer (ส่งซ้ำได้) | | |
| `otherArea` | string | | |
| `scopeIds` | integer (ส่งซ้ำได้) | | |
| `otherScope` | string | | |
| `diseaseGroupIds` | integer (ส่งซ้ำได้) | | |
| `otherDiseaseGroup` | string | | |
| `diseaseIds` | integer (ส่งซ้ำได้) | | |
| `summaryFile` | File | | `.pdf`, `.doc`, `.docx` ไม่เกิน 10MB |
| `image1` | File | | `.jpg`, `.png`, `.webp` ไม่เกิน 10MB |
| `image2` | File | | `.jpg`, `.png`, `.webp` ไม่เกิน 10MB |

- **ไม่ต้องส่งผู้ทำรายการ** API บันทึก `createdById` จากผู้ที่ login อยู่เอง
- ถ้าเลือกได้หลายค่า (`*Ids`) ให้ `append` key เดิมซ้ำทีละค่า **ห้าม**ส่งเป็น JSON array หรือคั่นด้วย comma
- field ข้อความ `other*` ที่ว่างหรือมีแต่ช่องว่างจะถูกบันทึกเป็น `null`
- ห้ามตั้ง `Content-Type` เอง ให้ browser ใส่ boundary ให้

```js
const fd = new FormData();
fd.append("status", "ATTENDEE");
fd.append("title", "ประชุมชี้แจงแนวทางเฝ้าระวังไข้เลือดออก");
fd.append("format", "Online");
fd.append("startDate", "2026-10-15");
fd.append("endDate", "2026-10-15");
fd.append("organizerId", "1");
fd.append("summary", "สรุปประเด็นสำคัญ ...");
fd.append("decisions", "ที่ประชุมเห็นชอบแนวทางเฝ้าระวังฉบับปรับปรุง");
fd.append("actionItems", "ส่งแนวทางให้ สคร. ภายใน 30 พ.ย.");
fd.append("summarizerId", "clx2abc..."); // หรือ fd.append("summarizerName", "ชื่อที่พิมพ์เอง")
[1, 3].forEach((id) => fd.append("objectiveIds", id));
[2, 5].forEach((id) => fd.append("areaIds", id));
fd.append("diseaseIds", "22");
if (file) fd.append("summaryFile", file);

const { data } = await api("/meetings", { method: "POST", formData: fd });
```

**Response 201**: `{ "message": "บันทึกรายงานสำเร็จ", "data": MeetingReport }`
(`data` ไม่มี relation หากต้องการให้เรียก `GET /meetings/{id}` ด้วย `data.id`)

**Errors**

| Status | `message` |
|---|---|
| 400 | `กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วนและถูกต้อง` (รวมกรณีไม่ส่ง `actionItems`) |
| 400 | `รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)` |
| 400 | `วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม` |
| 400 | `กรุณาเลือกวัตถุประสงค์การประชุมอย่างน้อยหนึ่งข้อ` |
| 400 | `ไม่พบหน่วยงานผู้จัดที่เลือก` / `พบวัตถุประสงค์การประชุมที่ไม่ถูกต้อง` |
| 400 | `กรุณาระบุหน่วยงานผู้จัด (อื่นๆ)` / `กรุณาระบุวัตถุประสงค์การประชุม (อื่นๆ)` |
| 400 | `กรุณาระบุผู้สรุปการประชุม` / `ไม่พบผู้ใช้ที่เลือกเป็นผู้สรุปการประชุม` / `ชื่อผู้สรุปการประชุมต้องไม่เกิน 255 ตัวอักษร` |
| 400 | `ไฟล์ xxx มีขนาดใหญ่เกิน 10MB` / `ไฟล์ xxx ไม่ใช่ประเภทไฟล์ที่อนุญาต` |
| 401 | `ไม่อนุญาต` |
| 500 | `เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์` (เช่น ส่ง `areaIds`, `scopeIds`, `diseaseGroupIds`, `diseaseIds` ที่ไม่มีอยู่จริง หรือข้อความ `other*` ยาวเกิน 255 ตัวอักษร) |

ควร validate ขนาดและชนิดไฟล์ฝั่ง front-end ก่อนส่ง

### 7.4 แก้ไขรายงาน

```http
PUT /meetings/{id}
Content-Type: multipart/form-data
```

- field เหมือน `POST /meetings` **ยกเว้นไฟล์** (`summaryFile`, `image1`, `image2` ถูกละเลย ไฟล์เดิมยังอยู่)
- เป็น **full replace** ต้องส่งทุก field ให้ครบ รวมถึง `*Ids` ทั้งหมดที่ต้องการให้คงอยู่ (relation ที่ไม่ได้ส่งจะถูกลบ)
- `otherOrganizer`, `coOrganizer`, `otherObjective`, `decisions`, `otherArea`, `otherScope`, `otherDiseaseGroup` ที่ไม่ได้ส่งจะกลายเป็น `null`
- ต้องส่ง `actionItems` ทุกครั้ง (รายงานเก่าที่ยังว่างต้องกรอกตอนแก้ไข)
- ต้องส่ง `summarizerId` หรือ `summarizerName` ทุกครั้ง (รายงานเก่าที่ยังไม่มีผู้สรุปต้องระบุตอนแก้ไข) ส่วน `createdById` เปลี่ยนไม่ได้

**Response 200**: `{ "message": "อัปเดตรายงานสำเร็จ", "data": MeetingReport }`

**Errors**: `400` (เหมือน POST และ `ID ไม่ถูกต้อง`), `401`, `404` (`ไม่พบรายงานที่ต้องการแก้ไข`), `500`

### 7.5 ลบรายงาน

```http
DELETE /meetings/{id}
```

ลบ objectives/tags ที่ผูกอยู่ด้วย (ไฟล์แนบบน server ไม่ถูกลบ) ควรถามยืนยันผู้ใช้ก่อนเรียก

**Response 200**: `{ "message": "ลบรายงานสำเร็จ" }`

**Errors**: `400` (`ID ไม่ถูกต้อง`), `401`, `404` (`ไม่พบรายงานที่ต้องการลบ`), `500`

---

## 8. Lookups และสถิติ

### 8.1 ข้อมูล Lookup ทั้งหมด

```http
GET /lookups
```

**Response 200**

```json
{
  "data": {
    "organizers":    [{ "id": 1, "name": "กองระบาดวิทยา" }],
    "objectives":    [{ "id": 1, "name": "ชี้แจง" }],
    "areas":         [{ "id": 2, "name": "เขตสุขภาพที่ 1" }, { "id": 1, "name": "ไม่เฉพาะเจาะจง / ทั่วประเทศ" }],
    "scopes":        [{ "id": 2, "name": "กฎหมาย ระเบียบ" }],
    "diseaseGroups": [{ "id": 2, "name": "โรคติดต่ออันตราย/โรคอุบัติใหม่/Disease X" }],
    "diseases":      [{ "id": 1, "name": "กาฬโรค" }],
    "users":         [{ "id": "clx2abc...", "name": "สมหญิง ใจดี", "department": "กองระบาดวิทยา" }]
  }
}
```

- `objectives`, `areas`, `scopes`, `diseaseGroups` เรียงตามลำดับที่กำหนดใน seed (แสดงตามที่ได้รับ) `organizers` และ `diseases` เรียงตาม `name` โดยผู้จัด "อื่นๆ" อยู่ท้ายสุด
- ข้อมูลแทบไม่เปลี่ยน โหลดครั้งเดียวแล้ว cache ไว้ในแอปได้ ยกเว้น `users` ที่เปลี่ยนเมื่อมีผู้ใช้ใหม่ได้รับอนุมัติ

### 8.2 สถิติจำนวนประชุมแยกตามผู้จัด

```http
GET /stats/meetings-by-organizer
```

**Response 200**

```json
{
  "data": {
    "total": 135,
    "byOrganizer": [
      { "organizerId": 1, "name": "กองระบาดวิทยา", "count": 80 },
      { "organizerId": 3, "name": "สำนักปลัดกระทรวงสาธารณสุข", "count": 55 }
    ]
  }
}
```

`byOrganizer` เรียงตาม `count` มาก → น้อย และมีเฉพาะผู้จัดที่มีรายงานอย่างน้อย 1 รายการ รายงานที่เลือกผู้จัด "อื่นๆ โปรดระบุ" จะถูกนับรวมเป็นแท่งเดียวชื่อ "อื่นๆ โปรดระบุ"

### 8.3 สถิติจำนวนประชุมรายเดือน

```http
GET /stats/meetings-by-month
```

**Response 200**

```json
{
  "data": [
    { "month": "2025-10", "count": 12 },
    { "month": "2025-12", "count": 4 },
    { "month": "2026-01", "count": 9 }
  ]
}
```

- นับรายงานทั้งหมดตามเดือนของ `startDate` (วันที่ตามที่ผู้ใช้กรอก คือเวลาไทย)
- `month` รูปแบบ `YYYY-MM` เรียงเก่า → ใหม่ ครอบคลุมทุกปีที่มีข้อมูล
- มีเฉพาะเดือนที่มีรายงาน เดือนที่ไม่มีให้ front-end เติมเป็น `0` เอง
- ไม่รับตัวกรอง นับจากรายงานทั้งหมดเสมอ

**Errors**: `401`, `500`

---

## 9. ข้อมูลส่วนตัว (Me)

### 9.1 ดูข้อมูลตัวเอง

```http
GET /me
```

**Response 200**: `{ "data": User }`

**Errors**: `401`

### 9.2 แก้ไขข้อมูลส่วนตัว / เปลี่ยนรหัสผ่าน

```http
PATCH /me
Content-Type: application/json
```

ส่งเฉพาะ field ที่ต้องการเปลี่ยน

| Field | Type | หมายเหตุ |
|---|---|---|
| `name`, `email`, `department` | string | ส่ง `""` หรือ `null` เพื่อล้างค่า |
| `newPassword` | string (≥8) | ต้องส่งคู่กับ `currentPassword` |
| `currentPassword` | string | รหัสผ่านปัจจุบัน |

แก้ `username`, `role`, `status` ของตัวเองไม่ได้ (field เหล่านี้จะถูกละเลย)

```js
await api("/me", {
  method: "PATCH",
  json: { currentPassword: "รหัสเดิม", newPassword: "รหัสใหม่อย่างน้อย8ตัว" },
});
```

**Response 200**: `{ "message": "แก้ไขข้อมูลส่วนตัวสำเร็จ", "data": User }`

token เดิมยังใช้ได้หลังเปลี่ยนรหัสผ่าน

**Errors**

| Status | `message` |
|---|---|
| 400 | `กรุณากรอกรหัสผ่านปัจจุบัน`, `รหัสผ่านปัจจุบันไม่ถูกต้อง`, `รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร`, `ไม่มีข้อมูลที่ต้องแก้ไข` |
| 401 | `ไม่อนุญาต` |

---

## 10. สมัครสมาชิกและจัดการผู้ใช้ (Admin)

ขั้นตอนของบัญชี:

```
ผู้ใช้สมัคร (POST /register) ──► PENDING ──approve──► APPROVED (login ได้)
                                    │
                                    └──reject───► REJECTED
แอดมินระงับ (PATCH status) : APPROVED ──► SUSPENDED ──(PATCH status: APPROVED)──► APPROVED
```

- endpoint `/users` ทุกตัวรับ/ตอบเป็น JSON และต้องเป็นแอดมิน (ไม่ใช่แอดมิน → `403`)
- **ป้องกันแอดมินล็อกตัวเอง:** แอดมินลบตัวเอง, ลด role ตัวเองเป็น `USER`, หรือเปลี่ยน status ตัวเองไม่ได้ (`400`)
- รหัสผ่านต้องยาวอย่างน้อย **8 ตัวอักษร**

### 10.1 สมัครสมาชิก

```http
POST /register
Content-Type: application/json
```

ไม่ต้อง login บัญชีใหม่จะได้ `role = USER`, `status = PENDING` (ส่ง `role`/`status` มาก็ไม่มีผล)

| Field | Type | Required |
|---|---|---|
| `username` | string | ✔ |
| `password` | string (≥8) | ✔ |
| `email` | string | |
| `name` | string | |
| `department` | string | |

**Response 201**: `{ "message": "สมัครสมาชิกสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติ", "data": User }`

หลังสมัครแล้วไม่ต้อง login อัตโนมัติ ให้แสดงข้อความว่ารอแอดมินอนุมัติ

**Errors**: `400` (ข้อมูลไม่ครบ / รหัสผ่านสั้นเกินไป), `409` (`ชื่อผู้ใช้นี้ถูกใช้งานแล้ว`)

### 10.2 รายการผู้ใช้

```http
GET /users?page=1&pageSize=20&search=&status=PENDING&role=
```

| Query | Type | Default | คำอธิบาย |
|---|---|---|---|
| `page` | integer | `1` | |
| `pageSize` | integer | `20` | สูงสุด 100 |
| `search` | string | | ค้นจาก `username`, `name`, `email` |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` \| `SUSPENDED` | | ใช้ `status=PENDING` ทำหน้า "รออนุมัติ" (และใช้ `pagination.total` เป็นตัวเลข badge) |
| `role` | `ADMIN` \| `USER` | | |

เรียงตาม `createdAt` ใหม่ → เก่า

**Response 200**: `{ "data": [User], "pagination": { "page", "pageSize", "total", "totalPages" } }`

**Errors**: `400` (`status`/`role` ไม่ถูกต้อง), `401`, `403`

### 10.3 เพิ่มผู้ใช้

```http
POST /users
Content-Type: application/json
```

| Field | Type | Required | Default |
|---|---|---|---|
| `username` | string | ✔ | |
| `password` | string (≥8) | ✔ | |
| `email`, `name`, `department` | string | | |
| `role` | `ADMIN` \| `USER` | | `USER` |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` \| `SUSPENDED` | | `APPROVED` |

**Response 201**: `{ "message": "เพิ่มผู้ใช้สำเร็จ", "data": User }`

**Errors**: `400`, `401`, `403`, `409`

### 10.4 รายละเอียดผู้ใช้

```http
GET /users/{id}
```

**Response 200**: `{ "data": User }`

**Errors**: `401`, `403`, `404`

### 10.5 อนุมัติ / ไม่อนุมัติผู้ใช้

```http
POST /users/{id}/approve
POST /users/{id}/reject
```

ไม่ต้องส่ง body

| Endpoint | ผลลัพธ์ | `message` |
|---|---|---|
| `/approve` | `status = APPROVED` บันทึก `approvedAt`, `approvedById` | `อนุมัติผู้ใช้สำเร็จ` |
| `/reject` | `status = REJECTED` ล้าง `approvedAt`, `approvedById` | `ไม่อนุมัติผู้ใช้สำเร็จ` |

**Response 200**: `{ "message": "...", "data": User }`

**Errors**: `400` (ทำกับบัญชีตัวเอง), `401`, `403`, `404`

### 10.6 แก้ไขข้อมูลผู้ใช้

```http
PATCH /users/{id}
Content-Type: application/json
```

ส่งเฉพาะ field ที่ต้องการเปลี่ยน

| Field | Type | หมายเหตุ |
|---|---|---|
| `username` | string | ห้ามว่าง ห้ามซ้ำ |
| `password` | string (≥8) | **รีเซ็ตรหัสผ่าน** ให้ผู้ใช้ที่ลืมรหัส (ไม่ต้องใช้รหัสเดิม) |
| `email`, `name`, `department` | string | ส่ง `""` หรือ `null` เพื่อล้างค่า |
| `role` | `ADMIN` \| `USER` | |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` \| `SUSPENDED` | ระงับ (`SUSPENDED`) หรือเปิดใช้งานใหม่ (`APPROVED`) |

```js
// รีเซ็ตรหัสผ่าน
await api(`/users/${id}`, { method: "PATCH", json: { password: "TempPass2026" } });

// ระงับผู้ใช้
await api(`/users/${id}`, { method: "PATCH", json: { status: "SUSPENDED" } });
```

**Response 200**: `{ "message": "แก้ไขข้อมูลผู้ใช้สำเร็จ", "data": User }`

**Errors**

| Status | กรณี |
|---|---|
| 400 | ข้อมูลไม่ถูกต้อง, ไม่มี field ให้แก้, แอดมินลด role/เปลี่ยน status ของตัวเอง |
| 401 / 403 | ไม่ได้ login / ไม่ใช่แอดมิน |
| 404 | `ไม่พบผู้ใช้` |
| 409 | `ชื่อผู้ใช้นี้ถูกใช้งานแล้ว` |

### 10.7 ลบผู้ใช้

```http
DELETE /users/{id}
```

**Response 200**: `{ "message": "ลบผู้ใช้สำเร็จ" }`

**Errors**: `400` (ลบตัวเอง), `401`, `403`, `404`

> ถ้าต้องการเก็บประวัติไว้ ให้ใช้ `PATCH { "status": "SUSPENDED" }` แทนการลบ เพราะเมื่อลบผู้ใช้ รายงานที่ผู้ใช้นั้นเป็นผู้ทำรายการหรือผู้สรุปจะถูกตั้ง `createdById` / `summarizerId` เป็น `null` (ตัวรายงานไม่ถูกลบ)

---

## 11. ไฟล์แนบ

- `summaryFileUrl`, `imageUrl1`, `imageUrl2` เป็น **path แบบ relative** เช่น `/uploads/1762858918640-report.pdf`
- URL เต็มต้องต่อด้วย origin + basePath (ไม่ใช่ `/api`):

  ```js
  const FILE_BASE = import.meta.env.VITE_FILE_BASE_URL; // https://epid-odpc2.ddc.moph.go.th/doemeeting
  const fileUrl = (path) => (path ? FILE_BASE + path : null);
  ```

- ไฟล์เปิดได้โดยไม่ต้องใช้ token ใช้ใน `<img src>` และ `<a href target="_blank">` ได้เลย ข้อควรระวังคือใครที่ได้ URL ไปก็เปิดไฟล์ได้
- ชื่อไฟล์บน server = `{timestamp}-{ชื่อไฟล์เดิมที่แทนช่องว่างด้วย _}`

| Field | MIME ที่อนุญาต | ขนาดสูงสุด |
|---|---|---|
| `summaryFile` | `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | 10MB |
| `image1`, `image2` | `image/jpeg`, `image/png`, `image/webp` | 10MB |

---

## 12. ข้อควรรู้และข้อจำกัด

| เรื่อง | รายละเอียด | คำแนะนำฝั่ง front-end |
|---|---|---|
| สิทธิ์กับรายงาน | ผู้ใช้ทุกคนที่ login ได้ สร้าง/แก้ไข/ลบรายงานได้ทุกฉบับ ระบบบันทึกผู้ทำรายการ (`createdBy`) ตอนสร้าง แต่ไม่ได้บันทึกว่าใครแก้ไขล่าสุด | role มีผลเฉพาะเมนูจัดการผู้ใช้ |
| แก้ไขไฟล์แนบ | `PUT` ไม่รองรับไฟล์ เปลี่ยนหรือลบไฟล์หลังสร้างแล้วไม่ได้ | ซ่อนช่องอัปโหลดในโหมดแก้ไข แล้วแสดงลิงก์ไฟล์เดิมแทน |
| ลบรายงาน | ไฟล์แนบยังค้างอยู่บน server | |
| ID ที่ไม่มีอยู่จริง | `organizerId`, `objectiveIds`, `summarizerId` ที่ไม่มีในระบบได้ `400` แต่ `areaIds`, `scopeIds`, `diseaseGroupIds`, `diseaseIds` ได้ `500` | เลือกจาก `/lookups` เท่านั้น |
| ความยาวข้อความ | `title`, `otherOrganizer`, `coOrganizer`, `otherObjective`, `otherArea`, `otherScope`, `otherDiseaseGroup` เก็บได้ไม่เกิน 255 ตัวอักษร ถ้าเกินได้ `500` (ยกเว้น `summarizerName` ที่ได้ `400`) | ใส่ `maxLength={255}` |
| ไม่มี refresh token | token หมดอายุใน 24 ชม. | เมื่อได้ `401` ให้พาไป login ใหม่ |
| ไฟล์ที่อัปโหลดหลัง build | `next start` อาจไม่ serve ไฟล์ใหม่ใน `public/uploads` | ถ้าเปิดไฟล์แล้วได้ 404 ให้แจ้งทีม API |

---

## 13. Checklist สำหรับทีมดูแล API (deploy)

ต้องทำบน server `epid-odpc2.ddc.moph.go.th` ก่อนส่งให้ทีม front-end ใช้:

1. **อัปเดตฐานข้อมูล** ให้รันก่อน หรือพร้อมกับการ deploy โค้ดใหม่ ถ้าไม่รัน login และหน้ารายงานจะใช้ไม่ได้ทั้งระบบ รวมถึงเว็บเดิม:

   ```bash
   npx prisma db push
   ```

   คำสั่งนี้เพิ่มคอลัมน์ `name`, `department`, `status`, `approvedAt`, `approvedById`, `createdAt`, `updatedAt` ในตาราง `User` ผู้ใช้เดิมจะได้ `status = APPROVED` และ role เดิมไม่เปลี่ยน และเพิ่มคอลัมน์ `coOrganizer`, `otherObjective`, `otherArea`, `decisions`, `actionItems`, `summarizerId`, `summarizerName`, `createdById` ในตาราง `MeetingReport` (รายงานเดิมจะเป็น `null` ส่วน `actionItems` เป็น `""`) และคอลัมน์ `sortOrder` ในตาราง lookup

   จากนั้นรัน seed เพื่ออัปเดตตัวเลือก:

   ```bash
   npx prisma db seed
   ```

   seed จะทำให้ตัวเลือกวัตถุประสงค์ / พื้นที่ / ขอบเขตงาน / กลุ่มโรค ตรงกับรายการใน `prisma/seed.js` ทั้งหมด: เปลี่ยนชื่อโดยคง `id` เดิม, เพิ่มตัวเลือกใหม่, กำหนด `sortOrder` และ**ลบตัวเลือกที่ไม่อยู่ในรายการพร้อม tag ที่ผูกกับรายงาน** (ตัวรายงานไม่ถูกลบ) ถ้าจะแก้ตัวเลือกพวกนี้ให้แก้ใน seed แล้วรันใหม่ อย่าแก้ในฐานข้อมูลตรงๆ ส่วนหน่วยงานผู้จัดและโรคเฉพาะ seed แค่เพิ่มรายการที่ยังไม่มี ไม่ลบของเดิม

2. **ตั้งค่า env** (production):

   ```bash
   NEXTAUTH_SECRET=...               # ค่าเดิม ห้ามเปลี่ยน (ใช้เข้ารหัส token)
   NEXTAUTH_URL=https://epid-odpc2.ddc.moph.go.th/doemeeting/api/auth
   CORS_ALLOWED_ORIGINS=https://doemeeting.pages.dev,https://*.doemeeting.pages.dev,http://localhost:5173
   # ระหว่างพัฒนา front-end อนุญาตทุก origin ได้ด้วย
   # CORS_ALLOWED_ORIGINS=*
   ```

   `NEXTAUTH_URL` ต้องขึ้นต้นด้วย `https://` และมี `/doemeeting/api/auth` ตามที่แอปตั้ง basePath ไว้ (ตอนนี้ไฟล์ `.env` ในเครื่องพัฒนาตั้งเป็น `http://localhost:3000`)

3. ถ้ามี reverse proxy (เช่น nginx) อยู่หน้าแอป ต้องส่งต่อ header `Authorization` และ `Origin` ไปยังแอป และห้ามตัด method `OPTIONS` ทิ้ง

4. ตรวจหลัง deploy:

   ```bash
   # preflight ต้องได้ 204 พร้อม access-control-allow-origin
   curl -i -X OPTIONS https://epid-odpc2.ddc.moph.go.th/doemeeting/api/meetings \
     -H "Origin: https://doemeeting.pages.dev" -H "Access-Control-Request-Method: GET"

   # login ต้องได้ accessToken
   curl -X POST https://epid-odpc2.ddc.moph.go.th/doemeeting/api/token \
     -H "Content-Type: application/json" -d '{"username":"...","password":"..."}'
   ```
