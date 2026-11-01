import { getLookups } from "@/lib/lookups";
import MeetingForm from "@/components/MeetingForm";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function NewMeetingPage() {
  const [
    { organizers, objectives, areas, scopes, diseaseGroups, diseases, users },
    session,
  ] = await Promise.all([getLookups(), getServerSession(authOptions)]);

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
            users={users}
            currentUser={session?.user}
          />
        </div>
      </main>
    </div>
  );
}
