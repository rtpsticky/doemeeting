import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";
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

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: "ไม่อนุญาต" }, { status: 401 });
  }

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
    const otherOrganizer = formData.get("otherOrganizer");
    const summary = formData.get("summary");
    const objectiveIds = formData
      .getAll("objectiveIds")
      .map((id) => parseInt(id, 10));
    const areaIds = formData.getAll("areaIds").map((id) => parseInt(id, 10));
    const scopeIds = formData.getAll("scopeIds").map((id) => parseInt(id, 10));
    const diseaseGroupIds = formData
      .getAll("diseaseGroupIds")
      .map((id) => parseInt(id, 10));
    const otherScope = formData.get("otherScope");
    const otherDiseaseGroup = formData.get("otherDiseaseGroup");
    const diseaseIds = formData
      .getAll("diseaseIds")
      .map((id) => parseInt(id, 10));

    if (
      !title ||
      !startDate ||
      !endDate ||
      !organizerId ||
      !summary ||
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

    if (objectiveIds.length === 0) {
      return NextResponse.json(
        { message: "กรุณาเลือกวัตถุประสงค์การประชุมอย่างน้อยหนึ่งข้อ" },
        { status: 400 },
      );
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
        summary,
        summaryFileUrl,
        imageUrl1,
        imageUrl2,
        otherScope,
        otherDiseaseGroup,
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
