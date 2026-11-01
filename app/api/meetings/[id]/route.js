import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  cleanText,
  validateOrganizerAndObjectives,
  validateSummarizer,
} from "@/lib/lookups";
import { meetingUserSelect } from "@/lib/meetingPeople";

// รายละเอียดรายงาน โดยแปลง relation เป็น array ของ { id, name }
export async function GET(request, { params }) {
  const { error: authError } = await requireUser(request);
  if (authError) return authError;

  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id);
  if (isNaN(id)) {
    return NextResponse.json({ message: "ID ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const meeting = await prisma.meetingReport.findUnique({
      where: { id },
      include: {
        organizer: true,
        createdBy: { select: meetingUserSelect },
        summarizer: { select: meetingUserSelect },
        objectives: { include: { objective: true } },
        tagsArea: { include: { area: true } },
        tagsScope: { include: { scope: true } },
        tagsDiseaseGroup: { include: { group: true } },
        tagsDisease: { include: { disease: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json({ message: "ไม่พบรายงาน" }, { status: 404 });
    }

    const {
      objectives,
      tagsArea,
      tagsScope,
      tagsDiseaseGroup,
      tagsDisease,
      ...rest
    } = meeting;

    return NextResponse.json({
      data: {
        ...rest,
        objectives: objectives.map((item) => item.objective),
        areas: tagsArea.map((item) => item.area),
        scopes: tagsScope.map((item) => item.scope),
        diseaseGroups: tagsDiseaseGroup.map((item) => item.group),
        diseases: tagsDisease.map((item) => item.disease),
      },
    });
  } catch (error) {
    console.error("Error fetching meeting:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  const { error: authError } = await requireUser(request);
  if (authError) return authError;

  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id);
  if (isNaN(id)) {
    return NextResponse.json({ message: "ID ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const formData = await request.formData();

    // --- Extract and Validate Fields ---
    const status = formData.get("status");
    const title = formData.get("title");
    const format = formData.get("format");
    const startDate = new Date(formData.get("startDate"));
    const endDate = new Date(formData.get("endDate"));
    const organizerId = parseInt(formData.get("organizerId"), 10);
    const otherOrganizer = cleanText(formData.get("otherOrganizer"));
    const summary = formData.get("summary");
    const otherScope = cleanText(formData.get("otherScope"));
    const otherDiseaseGroup = cleanText(formData.get("otherDiseaseGroup"));

    const objectiveIds = formData
      .getAll("objectiveIds")
      .map((id) => parseInt(id, 10));
    const areaIds = formData.getAll("areaIds").map((id) => parseInt(id, 10));
    const scopeIds = formData.getAll("scopeIds").map((id) => parseInt(id, 10));
    const diseaseGroupIds = formData
      .getAll("diseaseGroupIds")
      .map((id) => parseInt(id, 10));
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
    const { error: otherError, otherObjective } =
      await validateOrganizerAndObjectives({
        organizerId,
        otherOrganizer,
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

    // --- Update Database in a Transaction ---
    const updatedMeeting = await prisma.$transaction(async (tx) => {
      // 1. Update the scalar fields of the meeting report
      await tx.meetingReport.update({
        where: { id },
        data: {
          status,
          title,
          format,
          startDate,
          endDate,
          organizerId,
          otherOrganizer,
          otherObjective,
          summary,
          otherScope,
          otherDiseaseGroup,
          ...summarizer,
        },
      });

      // 2. Clear and set the many-to-many relations
      await tx.meetingObjective.deleteMany({ where: { meetingId: id } });
      if (objectiveIds.length > 0) {
        await tx.meetingObjective.createMany({
          data: objectiveIds.map((objectiveId) => ({
            meetingId: id,
            objectiveId,
          })),
        });
      }

      await tx.tagArea.deleteMany({ where: { meetingId: id } });
      if (areaIds.length > 0) {
        await tx.tagArea.createMany({
          data: areaIds.map((areaId) => ({ meetingId: id, areaId })),
        });
      }

      await tx.tagScope.deleteMany({ where: { meetingId: id } });
      if (scopeIds.length > 0) {
        await tx.tagScope.createMany({
          data: scopeIds.map((scopeId) => ({ meetingId: id, scopeId })),
        });
      }

      await tx.tagDiseaseGroup.deleteMany({ where: { meetingId: id } });
      if (diseaseGroupIds.length > 0) {
        await tx.tagDiseaseGroup.createMany({
          data: diseaseGroupIds.map((groupId) => ({ meetingId: id, groupId })),
        });
      }

      await tx.tagDisease.deleteMany({ where: { meetingId: id } });
      if (diseaseIds.length > 0) {
        await tx.tagDisease.createMany({
          data: diseaseIds.map((diseaseId) => ({ meetingId: id, diseaseId })),
        });
      }

      // Return the updated meeting
      return tx.meetingReport.findUnique({ where: { id } });
    });

    return NextResponse.json(
      { message: "อัปเดตรายงานสำเร็จ", data: updatedMeeting },
      { status: 200 },
    );
  } catch (error) {
    // P2025 = ไม่พบรายงานที่ต้องการแก้ไข
    if (error?.code === "P2025") {
      return NextResponse.json(
        { message: "ไม่พบรายงานที่ต้องการแก้ไข" },
        { status: 404 },
      );
    }
    console.error("Error updating meeting:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const { error: authError } = await requireUser(request);
  if (authError) return authError;

  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id);
  if (isNaN(id)) {
    return NextResponse.json({ message: "ID ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    // Check if the meeting exists before trying to delete
    const meeting = await prisma.meetingReport.findUnique({
      where: { id },
    });

    if (!meeting) {
      return NextResponse.json(
        { message: "ไม่พบรายงานที่ต้องการลบ" },
        { status: 404 },
      );
    }

    // Use a transaction to ensure all related data is deleted along with the report
    await prisma.$transaction([
      prisma.meetingObjective.deleteMany({ where: { meetingId: id } }),
      prisma.tagArea.deleteMany({ where: { meetingId: id } }),
      prisma.tagScope.deleteMany({ where: { meetingId: id } }),
      prisma.tagDiseaseGroup.deleteMany({ where: { meetingId: id } }),
      prisma.tagDisease.deleteMany({ where: { meetingId: id } }),
      prisma.meetingReport.delete({ where: { id } }),
    ]);

    return NextResponse.json({ message: "ลบรายงานสำเร็จ" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return NextResponse.json(
      { message: "เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }
}
