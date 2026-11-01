import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import MeetingForm from "@/components/MeetingForm";
import { getLookups } from "@/lib/lookups";
import { meetingUserSelect } from "@/lib/meetingPeople";

export default async function EditMeetingPage({ params }) {
  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id);
  if (isNaN(id)) {
    notFound();
  }

  // Fetch all data needed for the form in parallel
  const [meeting, lookups] = await Promise.all([
    prisma.meetingReport.findUnique({
      where: { id },
      include: {
        objectives: { select: { objectiveId: true } },
        tagsArea: { select: { areaId: true } },
        tagsScope: { select: { scopeId: true } },
        tagsDiseaseGroup: { select: { groupId: true } },
        tagsDisease: { select: { diseaseId: true } },
        createdBy: { select: meetingUserSelect },
        summarizer: { select: meetingUserSelect },
      },
    }),
    getLookups(),
  ]);

  if (!meeting) {
    notFound();
  }

  const {
    organizers,
    objectives,
    areas,
    scopes,
    diseaseGroups,
    diseases,
    users,
  } = lookups;

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
            users={users}
          />
        </div>
      </main>
    </div>
  );
}
