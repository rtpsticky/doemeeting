import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import DeleteMeetingButton from "@/components/DeleteMeetingButton";
import { organizerDisplayName } from "@/lib/otherOption";
import {
  meetingUserSelect,
  summarizerDisplayName,
  userDisplayName,
} from "@/lib/meetingPeople";

// Helper component for displaying a detail item
const DetailItem = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-base text-slate-900">{value}</dd>
    </div>
  );
};

// Helper for file links
const FileLink = ({ url, label }) => {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sky-600 hover:text-sky-800 underline"
    >
      {label}
    </a>
  );
};

// Helper component for displaying a list of tags
const TagList = ({ label, items, renderItem }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="md:col-span-2">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-2 flex flex-wrap gap-2">{items.map(renderItem)}</dd>
    </div>
  );
};

// Helper for individual tag
const Tag = ({ children }) => (
  <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
    {children}
  </span>
);

export default async function MeetingDetailsPage({ params }) {
  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id);
  if (isNaN(id)) {
    notFound();
  }

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
    notFound();
  }

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800 truncate">
              รายละเอียดการประชุม
            </h1>
            <div className="flex items-center space-x-4">
              <Link
                href={`/meetings/${id}/edit`}
                className="px-4 py-2 font-semibold text-white bg-yellow-500 rounded-lg shadow-sm hover:bg-yellow-600"
              >
                แก้ไข
              </Link>
              <DeleteMeetingButton meetingId={id} />
              <Link
                href="/"
                className="text-sm font-semibold text-slate-600 hover:text-slate-800 flex-shrink-0"
              >
                &larr; กลับไปหน้าหลัก
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow">
          <div className="border-b border-slate-200 pb-6 mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {meeting.title}
            </h2>
            <p className="mt-2 text-base text-slate-600">
              {formatDate(meeting.startDate)} - {formatDate(meeting.endDate)}
            </p>
          </div>

          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <DetailItem label="รูปแบบการประชุม" value={meeting.format} />
            <DetailItem
              label="หน่วยงานผู้จัดหลัก"
              value={organizerDisplayName(meeting)}
            />
            <DetailItem
              label="หน่วยงานผู้จัดร่วม"
              value={meeting.coOrganizer}
            />

            <DetailItem
              label="ผู้สรุปการประชุม"
              value={summarizerDisplayName(meeting)}
            />
            <DetailItem
              label="ผู้ทำรายการ"
              value={userDisplayName(meeting.createdBy)}
            />

            <div className="md:col-span-2">
              <dt className="text-sm font-medium text-slate-500">
                สรุปเนื้อหาการประชุม
              </dt>
              <dd className="mt-1 text-base text-slate-900 whitespace-pre-wrap">
                {meeting.summary}
              </dd>
            </div>

            <div className="md:col-span-2">
              <dt className="text-sm font-medium text-slate-500">
                สิ่งที่ต้องดำเนินการ
              </dt>
              <dd className="mt-1 text-base text-slate-900 whitespace-pre-wrap">
                {meeting.actionItems || "-"}
              </dd>
            </div>

            <div className="md:col-span-2">
              <dt className="text-sm font-medium text-slate-500">ไฟล์แนบ</dt>
              <dd className="mt-2 flex flex-col space-y-2">
                <FileLink url={meeting.summaryFileUrl} label="ไฟล์สรุปประชุม" />
                <FileLink url={meeting.imageUrl1} label="รูปภาพประกอบ 1" />
                <FileLink url={meeting.imageUrl2} label="รูปภาพประกอบ 2" />
              </dd>
            </div>
          </dl>
        </div>

        {/* Tags & Additional Details Section */}
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow mt-8">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-4 mb-6">
            รายละเอียดเพิ่มเติม
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
            <div className="md:col-span-2">
              <TagList
                label="วัตถุประสงค์การประชุม"
                items={meeting.objectives}
                renderItem={(item) => (
                  <Tag key={item.objective.id}>{item.objective.name}</Tag>
                )}
              />
              {meeting.otherObjective && (
                <p className="mt-2 text-sm text-slate-600">
                  อื่นๆ: {meeting.otherObjective}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <TagList
                label="พื้นที่ (Area)"
                items={meeting.tagsArea}
                renderItem={(item) => (
                  <Tag key={item.area.id}>{item.area.name}</Tag>
                )}
              />
              {meeting.otherArea && (
                <p className="mt-2 text-sm text-slate-600">
                  อื่นๆ: {meeting.otherArea}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <TagList
                label="Tag Scope (ขอบเขตงาน)"
                items={meeting.tagsScope}
                renderItem={(item) => (
                  <Tag key={item.scope.id}>{item.scope.name}</Tag>
                )}
              />
              {meeting.otherScope && (
                <p className="mt-2 text-sm text-slate-600">
                  อื่นๆ: {meeting.otherScope}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <TagList
                label="Tag Disease Group (กลุ่มโรค)"
                items={meeting.tagsDiseaseGroup}
                renderItem={(item) => (
                  <Tag key={item.group.id}>{item.group.name}</Tag>
                )}
              />
              {meeting.otherDiseaseGroup && (
                <p className="mt-2 text-sm text-slate-600">
                  อื่นๆ: {meeting.otherDiseaseGroup}
                </p>
              )}
            </div>

            <TagList
              label="Tag Disease (โรคเฉพาะ)"
              items={meeting.tagsDisease}
              renderItem={(item) => (
                <Tag key={item.disease.id}>{item.disease.name}</Tag>
              )}
            />
          </dl>
        </div>
      </main>
    </div>
  );
}
