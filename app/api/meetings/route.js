import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  cleanText,
  validateOrganizerAndObjectives,
  validateSummarizer,
} from "@/lib/lookups";
import { meetingUserSelect } from "@/lib/meetingPeople";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = path.join(process.cwd(), "public/uploads");

// Helper function to process and save a single file
async function processAndSaveFile(file, allowedTypes) {
  if (!file || file.size === 0) {
    return null;
  }

  // Server-side validation
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`ไฟล์ ${file.name} มีขนาดใหญ่เกิน 10MB`);
  }
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`ไฟล์ ${file.name} ไม่ใช่ประเภทไฟล์ที่อนุญาต`);
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const timestamp = Date.now();
  const filename = `${timestamp}-${file.name.replace(/\s/g, "_")}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  await writeFile(filePath, buffer);

  return `/uploads/${filename}`; // Return the public URL
}

// ช่องข้อความที่ใช้ค้นหาด้วย keyword
const KEYWORD_TEXT_FIELDS = [
  "title",
  "summary",
  "decisions",
  "actionItems",
  "coOrganizer",
  "otherOrganizer",
  "otherObjective",
  "otherScope",
  "otherDiseaseGroup",
];

// รับเฉพาะ YYYY-MM-DD ที่เป็นวันที่จริง (เช่น 2026-02-30 ไม่ผ่าน)
function parseDateParam(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return date;
}

// query ที่ส่งซ้ำได้ เช่น scopeId=4&scopeId=9 ถ้ามีค่าที่ไม่ใช่ตัวเลขคืน null
function parseIdParams(searchParams, key) {
  const values = searchParams.getAll(key).filter((v) => v.trim() !== "");
  if (!values.every((v) => /^\d+$/.test(v.trim()))) return null;
  return values.map((v) => parseInt(v, 10));
}

// คำค้นหนึ่งคำต้องเจอในช่องข้อความหรือชื่อ lookup ที่ผูกกับรายงานอย่างน้อยหนึ่งที่
function keywordCondition(keyword) {
  const contains = { contains: keyword, mode: "insensitive" };
  return {
    OR: [
      ...KEYWORD_TEXT_FIELDS.map((field) => ({ [field]: contains })),
      { organizer: { name: contains } },
      { objectives: { some: { objective: { name: contains } } } },
      { tagsScope: { some: { scope: { name: contains } } } },
      { tagsDiseaseGroup: { some: { group: { name: contains } } } },
      { tagsDisease: { some: { disease: { name: contains } } } },
    ],
  };
}

// รายการประชุม + ค้นหา + ตัวกรอง + แบ่งหน้า
export async function GET(request) {
  const { error: authError } = await requireUser(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page")) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.get("pageSize")) || 20, 1),
    100,
  );
  const search = searchParams.get("search") || "";
  const keywords = searchParams
    .getAll("keyword")
    .map((k) => k.trim())
    .filter(Boolean);
  const department = searchParams.get("department")?.trim() || "";

  const idFilters = {
    organizerId: "organizerId ไม่ถูกต้อง",
    scopeId: "scopeId ไม่ถูกต้อง",
    diseaseGroupId: "diseaseGroupId ไม่ถูกต้อง",
    diseaseId: "diseaseId ไม่ถูกต้อง",
  };
  const ids = {};
  for (const [key, message] of Object.entries(idFilters)) {
    ids[key] = parseIdParams(searchParams, key);
    if (!ids[key]) {
      return NextResponse.json({ message }, { status: 400 });
    }
  }

  const dates = {};
  for (const key of ["dateFrom", "dateTo"]) {
    const value = searchParams.get(key)?.trim();
    if (!value) continue;
    dates[key] = parseDateParam(value);
    if (!dates[key]) {
      return NextResponse.json(
        { message: `${key} ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)` },
        { status: 400 },
      );
    }
  }

  // startDate เก็บเป็นวันที่อย่างเดียว lte dateTo จึงรวมทั้งวัน
  const startDate = {};
  if (dates.dateFrom) startDate.gte = dates.dateFrom;
  if (dates.dateTo) startDate.lte = dates.dateTo;

  // ตัวกรองต่างชนิดรวมแบบ AND ส่วนค่าหลายค่าในตัวกรองเดียวกันเป็น OR
  const where = {
    AND: [
      search ? { title: { contains: search, mode: "insensitive" } } : {},
      ...keywords.map(keywordCondition),
      dates.dateFrom || dates.dateTo ? { startDate } : {},
      ids.organizerId.length ? { organizerId: { in: ids.organizerId } } : {},
      department
        ? {
            OR: [
              { createdBy: { department } },
              { summarizer: { department } },
            ],
          }
        : {},
      ids.scopeId.length
        ? { tagsScope: { some: { scopeId: { in: ids.scopeId } } } }
        : {},
      ids.diseaseGroupId.length
        ? {
            tagsDiseaseGroup: {
              some: { groupId: { in: ids.diseaseGroupId } },
            },
          }
        : {},
      ids.diseaseId.length
        ? { tagsDisease: { some: { diseaseId: { in: ids.diseaseId } } } }
        : {},
    ],
  };

  try {
    const [meetings, total] = await Promise.all([
      prisma.meetingReport.findMany({
        where,
        include: {
          organizer: true,
          createdBy: { select: meetingUserSelect },
          summarizer: { select: meetingUserSelect },
        },
        orderBy: { startDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.meetingReport.count({ where }),
    ]);

    return NextResponse.json({
      data: meetings,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error listing meetings:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const { user, error: authError } = await requireUser(request);
  if (authError) return authError;

  try {
    await mkdir(UPLOAD_DIR, { recursive: true }); // Ensure upload directory exists
    const formData = await request.formData();

    // --- Extract Text Fields ---
    const status = formData.get("status");
    const title = formData.get("title");
    const format = formData.get("format");
    const startDate = new Date(formData.get("startDate"));
    const endDate = new Date(formData.get("endDate"));
    const organizerId = parseInt(formData.get("organizerId"), 10);
    const coOrganizer = cleanText(formData.get("coOrganizer"));
    const summary = formData.get("summary");
    const decisions = cleanText(formData.get("decisions"));
    const actionItems = cleanText(formData.get("actionItems"));
    const otherArea = cleanText(formData.get("otherArea"));
    const objectiveIds = formData
      .getAll("objectiveIds")
      .map((id) => parseInt(id, 10));
    const areaIds = formData.getAll("areaIds").map((id) => parseInt(id, 10));
    const scopeIds = formData.getAll("scopeIds").map((id) => parseInt(id, 10));
    const diseaseGroupIds = formData
      .getAll("diseaseGroupIds")
      .map((id) => parseInt(id, 10));
    const otherScope = cleanText(formData.get("otherScope"));
    const otherDiseaseGroup = cleanText(formData.get("otherDiseaseGroup"));
    const diseaseIds = formData
      .getAll("diseaseIds")
      .map((id) => parseInt(id, 10));

    if (
      !title ||
      !startDate ||
      !endDate ||
      !organizerId ||
      !summary ||
      !actionItems ||
      !status ||
      !["ATTENDEE", "ORGANIZER"].includes(status) ||
      !format ||
      !["Online", "Onsite"].includes(format)
    ) {
      return NextResponse.json(
        { message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วนและถูกต้อง" },
        { status: 400 },
      );
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { message: "รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)" },
        { status: 400 },
      );
    }
    if (endDate < startDate) {
      return NextResponse.json(
        { message: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม" },
        { status: 400 },
      );
    }

    if (objectiveIds.length === 0) {
      return NextResponse.json(
        { message: "กรุณาเลือกวัตถุประสงค์การประชุมอย่างน้อยหนึ่งข้อ" },
        { status: 400 },
      );
    }

    // ถ้าเลือก "อื่นๆ" ของผู้จัด/วัตถุประสงค์ ต้องกรอกช่องระบุเพิ่มเติม
    const {
      error: otherError,
      otherOrganizer,
      otherObjective,
    } = await validateOrganizerAndObjectives({
      organizerId,
      otherOrganizer: cleanText(formData.get("otherOrganizer")),
      objectiveIds,
      otherObjective: cleanText(formData.get("otherObjective")),
    });
    if (otherError) {
      return NextResponse.json({ message: otherError }, { status: 400 });
    }

    const { error: summarizerError, ...summarizer } = await validateSummarizer({
      summarizerId: cleanText(formData.get("summarizerId")),
      summarizerName: cleanText(formData.get("summarizerName")),
    });
    if (summarizerError) {
      return NextResponse.json({ message: summarizerError }, { status: 400 });
    }

    // --- Process Files ---
    const summaryFile = formData.get("summaryFile");
    const image1 = formData.get("image1");
    const image2 = formData.get("image2");

    const summaryFileUrl = await processAndSaveFile(summaryFile, [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    const imageUrl1 = await processAndSaveFile(image1, [
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    const imageUrl2 = await processAndSaveFile(image2, [
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

    // --- Create Database Record ---
    const newMeeting = await prisma.meetingReport.create({
      data: {
        status,
        title,
        format,
        startDate,
        endDate,
        organizerId,
        otherOrganizer,
        coOrganizer,
        otherObjective,
        summary,
        decisions,
        actionItems,
        otherArea,
        summaryFileUrl,
        imageUrl1,
        imageUrl2,
        otherScope,
        otherDiseaseGroup,
        ...summarizer,
        createdById: user.id,
        objectives: {
          create: objectiveIds.map((objectiveId) => ({
            objective: { connect: { id: objectiveId } },
          })),
        },
        tagsArea: {
          create: areaIds.map((areaId) => ({
            area: { connect: { id: areaId } },
          })),
        },
        tagsScope: {
          create: scopeIds.map((scopeId) => ({
            scope: { connect: { id: scopeId } },
          })),
        },
        tagsDiseaseGroup: {
          create: diseaseGroupIds.map((groupId) => ({
            group: { connect: { id: groupId } },
          })),
        },
        tagsDisease: {
          create: diseaseIds.map((diseaseId) => ({
            disease: { connect: { id: diseaseId } },
          })),
        },
      },
    });

    return NextResponse.json(
      { message: "บันทึกรายงานสำเร็จ", data: newMeeting },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating meeting:", error);
    // Check if the error is a custom validation error from our helper
    const isValidationError = ["ไฟล์", "ขนาดใหญ่เกิน", "ไม่ใช่ประเภท"].some(
      (keyword) => error.message.includes(keyword),
    );
    if (isValidationError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }
}
