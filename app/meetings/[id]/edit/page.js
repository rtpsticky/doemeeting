import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import MeetingForm from "@/components/MeetingForm";

export default async function EditMeetingPage({ params }) {
  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id);
  if (isNaN(id)) {
    notFound();
  }

  // Fetch all data needed for the form in parallel
  const [
    meeting,
    organizers,
    objectives,
    areas,
    scopes,
    diseaseGroups,
    diseases,
  ] = await Promise.all([
    prisma.meetingReport.findUnique({
      where: { id },
      include: {
        objectives: { select: { objectiveId: true } },
        tagsArea: { select: { areaId: true } },
        tagsScope: { select: { scopeId: true } },
        tagsDiseaseGroup: { select: { groupId: true } },
        tagsDisease: { select: { diseaseId: true } },
      },
    }),
    prisma.organizerLookup.findMany({ orderBy: { name: "asc" } }),
    prisma.objectiveLookup.findMany({ orderBy: { name: "asc" } }),
    prisma.areaLookup.findMany(), // Custom sort will be applied
    prisma.scopeLookup.findMany({ orderBy: { name: "asc" } }),
    prisma.diseaseGroupLookup.findMany({ orderBy: { name: "asc" } }),
    prisma.diseaseLookup.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!meeting) {
    notFound();
  }

  // Custom sort for Tag Area (same as in new page)
  areas.sort((a, b) => {
    const aName = a.name;
    const bName = b.name;
    if (aName === "ไม่เฉพาะเจาะจง") return 1;
    if (bName === "ไม่เฉพาะเจาะจง") return -1;
    const aNumMatch = aName.match(/(\d+)/);
    const bNumMatch = bName.match(/(\d+)/);
    if (aNumMatch && bNumMatch) {
      return parseInt(aNumMatch[0], 10) - parseInt(bNumMatch[0], 10);
    }
    return aName.localeCompare(bName, "th");
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">
              แก้ไขรายงานการประชุม
            </h1>
            <Link
              href={`/meetings/${id}`}
              className="text-sm font-semibold text-sky-600 hover:text-sky-700"
            >
              &larr; กลับไปหน้ารายละเอียด
            </Link>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
          <MeetingForm
            meeting={meeting}
            organizers={organizers}
            objectives={objectives}
            areas={areas}
            scopes={scopes}
            diseaseGroups={diseaseGroups}
            diseases={diseases}
          />
        </div>
      </main>
    </div>
  );
}
