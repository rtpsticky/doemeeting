import prisma from "@/lib/prisma";
import MeetingForm from "@/components/MeetingForm";
import Link from "next/link";

export default async function NewMeetingPage() {
  // Fetch lookup data in parallel for efficiency
  const [organizers, objectives, areas, scopes, diseaseGroups, diseases] =
    await Promise.all([
      prisma.organizerLookup.findMany({ orderBy: { name: "asc" } }),
      prisma.objectiveLookup.findMany({ orderBy: { name: "asc" } }),
      prisma.areaLookup.findMany(), // Remove default asc sort to apply custom sort
      prisma.scopeLookup.findMany({ orderBy: { name: "asc" } }),
      prisma.diseaseGroupLookup.findMany({ orderBy: { name: "asc" } }),
      prisma.diseaseLookup.findMany({ orderBy: { name: "asc" } }),
    ]);

  // Custom sort for Tag Area (เขตสุขภาพ)
  areas.sort((a, b) => {
    const aName = a.name;
    const bName = b.name;

    if (aName === "ไม่เฉพาะเจาะจง") return 1;
    if (bName === "ไม่เฉพาะเจาะจง") return -1;

    // Extract numbers for sorting 'เขตสุขภาพที่ X'
    const aNumMatch = aName.match(/(\d+)/);
    const bNumMatch = bName.match(/(\d+)/);

    if (aNumMatch && bNumMatch) {
      return parseInt(aNumMatch[0], 10) - parseInt(bNumMatch[0], 10);
    }

    // Fallback for any other cases that don't match the pattern
    return aName.localeCompare(bName, "th");
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">
              สร้างรายงานการประชุมใหม่
            </h1>
            <Link
              href="/"
              className="text-sm font-semibold text-sky-600 hover:text-sky-700"
            >
              &larr; กลับไปหน้าหลัก
            </Link>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
          <MeetingForm
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
