"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";
import Swal from "sweetalert2";

// Reusable form components (no changes)
const FormInput = ({ id, name, label, required, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      id={id}
      name={name}
      required={required}
      {...props}
      className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200"
    />
  </div>
);
const FormTextarea = ({ id, name, label, required, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      id={id}
      name={name}
      required={required}
      {...props}
      className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
    />
  </div>
);
const FormSelect = ({ id, name, label, required, children, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      id={id}
      name={name}
      required={required}
      {...props}
      className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white border-slate-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"
    >
      {children}
    </select>
  </div>
);

export default function MeetingForm({
  meeting = null, // Make meeting optional
  organizers,
  objectives,
  areas,
  scopes,
  diseaseGroups,
  diseases,
}) {
  const router = useRouter();
  const isEditMode = meeting !== null;

  const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState(null); // No longer needed

  // Helper to format date for input type="date"
  const formatDateForInput = (date) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  const diseaseOptions = diseases.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const [selectedDiseases, setSelectedDiseases] = useState(() => {
    if (!isEditMode) return [];
    return meeting.tagsDisease
      .map((tag) => diseaseOptions.find((opt) => opt.value === tag.diseaseId))
      .filter(Boolean);
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    const formData = new FormData(event.target);

    // For simplicity, file re-uploads are not handled in edit mode.
    if (isEditMode) {
      formData.delete("summaryFile");
      formData.delete("image1");
      formData.delete("image2");
    }

    try {
      const url = isEditMode ? `/api/meetings/${meeting.id}` : "/api/meetings";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `เกิดข้อผิดพลาดในการ${isEditMode ? "อัปเดต" : "บันทึก"}`,
        );
      }

      const result = await response.json();

      await Swal.fire({
        title: "สำเร็จ!",
        text: "บันทึกรายงานการประชุมเรียบร้อยแล้ว",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      router.push(isEditMode ? `/meetings/${result.data.id}` : "/");
      router.refresh();
    } catch (err) {
      Swal.fire({
        title: "เกิดข้อผิดพลาด!",
        text: err.message,
        icon: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* --- Basic Info --- */}
      <div className="space-y-4 border-b border-slate-200 pb-8">
        <h2 className="text-lg font-semibold text-slate-800">ข้อมูลพื้นฐาน</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            สถานะ <span className="text-red-500">*</span>
          </label>
          <div className="mt-2 flex space-x-6">
            <div className="flex items-center">
              <input
                id="status-attendee"
                name="status"
                type="radio"
                value="ATTENDEE"
                defaultChecked={!isEditMode || meeting.status === "ATTENDEE"}
                className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label
                htmlFor="status-attendee"
                className="ml-3 block text-sm font-medium text-slate-700"
              >
                ผู้เข้าร่วมประชุม
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="status-organizer"
                name="status"
                type="radio"
                value="ORGANIZER"
                defaultChecked={isEditMode && meeting.status === "ORGANIZER"}
                className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label
                htmlFor="status-organizer"
                className="ml-3 block text-sm font-medium text-slate-700"
              >
                ผู้จัดประชุม
              </label>
            </div>
          </div>
        </div>
        <FormInput
          id="title"
          name="title"
          label="ชื่อเรื่องการประชุม"
          type="text"
          required
          defaultValue={meeting?.title}
        />
        <div>
          <label className="block text-sm font-medium text-slate-700">
            รูปแบบการประชุม
          </label>
          <div className="mt-2 flex space-x-6">
            <div className="flex items-center">
              <input
                id="format-online"
                name="format"
                type="radio"
                value="Online"
                defaultChecked={!isEditMode || meeting.format === "Online"}
                className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label
                htmlFor="format-online"
                className="ml-3 block text-sm font-medium text-slate-700"
              >
                Online
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="format-onsite"
                name="format"
                type="radio"
                value="Onsite"
                defaultChecked={isEditMode && meeting.format === "Onsite"}
                className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label
                htmlFor="format-onsite"
                className="ml-3 block text-sm font-medium text-slate-700"
              >
                Onsite
              </label>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            id="startDate"
            name="startDate"
            label="วันที่เริ่ม"
            type="date"
            required
            defaultValue={formatDateForInput(meeting?.startDate)}
          />
          <FormInput
            id="endDate"
            name="endDate"
            label="วันที่สิ้นสุด"
            type="date"
            required
            defaultValue={formatDateForInput(meeting?.endDate)}
          />
        </div>
      </div>

      {/* --- Organizer --- */}
      <div className="space-y-4 border-b border-slate-200 pb-8">
        <h2 className="text-lg font-semibold text-slate-800">หน่วยงานผู้จัด</h2>
        <FormSelect
          id="organizerId"
          name="organizerId"
          label="หน่วยงานผู้จัดหลัก"
          required
          defaultValue={meeting?.organizerId}
        >
          <option value="">-- เลือกหน่วยงาน --</option>
          {organizers.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </FormSelect>
        <FormInput
          id="otherOrganizer"
          name="otherOrganizer"
          label="หน่วยงานผู้จัดร่วม (ถ้ามี)"
          type="text"
          defaultValue={meeting?.otherOrganizer}
        />
      </div>

      {/* --- Objectives --- */}
      <div className="space-y-4 border-b border-slate-200 pb-8">
        <h2 className="text-lg font-semibold text-slate-800">
          วัตถุประสงค์การประชุม <span className="text-red-500">*</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {objectives.map((objective) => (
            <div key={objective.id} className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id={`objective-${objective.id}`}
                  name="objectiveIds"
                  type="checkbox"
                  value={objective.id}
                  defaultChecked={
                    isEditMode &&
                    meeting.objectives.some(
                      (o) => o.objectiveId === objective.id,
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label
                  htmlFor={`objective-${objective.id}`}
                  className="font-medium text-slate-700"
                >
                  {objective.name}
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- Summary --- */}
      <div className="space-y-4 border-b border-slate-200 pb-8">
        <h2 className="text-lg font-semibold text-slate-800">สรุปการประชุม</h2>
        <FormTextarea
          id="summary"
          name="summary"
          label="เนื้อหาสรุป"
          rows="5"
          required
          defaultValue={meeting?.summary}
        />
      </div>

      {/* --- Tags --- */}
      <div className="space-y-4 border-b border-slate-200 pb-8">
        <h2 className="text-lg font-semibold text-slate-800">
          Tag Area (เขตสุขภาพ)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {areas.map((area) => (
            <div key={area.id} className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id={`area-${area.id}`}
                  name="areaIds"
                  type="checkbox"
                  value={area.id}
                  defaultChecked={
                    isEditMode &&
                    meeting.tagsArea.some((t) => t.areaId === area.id)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label
                  htmlFor={`area-${area.id}`}
                  className="font-medium text-slate-700"
                >
                  {area.name}
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4 border-b border-slate-200 pb-8">
        <h2 className="text-lg font-semibold text-slate-800">
          Tag Scope (ขอบเขตงาน)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {scopes.map((scope) => (
            <div key={scope.id} className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id={`scope-${scope.id}`}
                  name="scopeIds"
                  type="checkbox"
                  value={scope.id}
                  defaultChecked={
                    isEditMode &&
                    meeting.tagsScope.some((t) => t.scopeId === scope.id)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label
                  htmlFor={`scope-${scope.id}`}
                  className="font-medium text-slate-700"
                >
                  {scope.name}
                </label>
              </div>
            </div>
          ))}
        </div>
        <FormInput
          id="otherScope"
          name="otherScope"
          label="ขอบเขตงาน (อื่นๆ โปรดระบุ)"
          type="text"
          defaultValue={meeting?.otherScope}
        />
      </div>
      <div className="space-y-4 border-b border-slate-200 pb-8">
        <h2 className="text-lg font-semibold text-slate-800">
          Tag Disease Group (กลุ่มโรค)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {diseaseGroups.map((group) => (
            <div key={group.id} className="relative flex items-start">
              <div className="flex h-6 items-center">
                <input
                  id={`group-${group.id}`}
                  name="diseaseGroupIds"
                  type="checkbox"
                  value={group.id}
                  defaultChecked={
                    isEditMode &&
                    meeting.tagsDiseaseGroup.some((t) => t.groupId === group.id)
                  }
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label
                  htmlFor={`group-${group.id}`}
                  className="font-medium text-slate-700"
                >
                  {group.name}
                </label>
              </div>
            </div>
          ))}
        </div>
        <FormInput
          id="otherDiseaseGroup"
          name="otherDiseaseGroup"
          label="กลุ่มโรค (อื่นๆ โปรดระบุ)"
          type="text"
          defaultValue={meeting?.otherDiseaseGroup}
        />
      </div>
      <div className="space-y-4 border-b border-slate-200 pb-8">
        <h2 className="text-lg font-semibold text-slate-800">
          Tag Disease (โรคเฉพาะ)
        </h2>
        <Select
          instanceId="disease-select"
          isMulti
          options={diseaseOptions}
          className="basic-multi-select"
          classNamePrefix="select"
          placeholder="ค้นหาและเลือกโรค..."
          onChange={setSelectedDiseases}
          value={selectedDiseases}
          styles={{
            control: (base) => ({
              ...base,
              borderColor: "rgb(203 213 225)",
              "&:hover": { borderColor: "rgb(14 165 233)" },
            }),
          }}
        />
        {selectedDiseases &&
          selectedDiseases.map((disease) => (
            <input
              key={disease.value}
              type="hidden"
              name="diseaseIds"
              value={disease.value}
            />
          ))}
      </div>

      {/* --- File Uploads (Disabled in Edit Mode) --- */}
      {!isEditMode && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">
            ไฟล์แนบ (ไม่เกิน 10MB ต่อไฟล์)
          </h2>
          <FormInput
            id="summaryFile"
            name="summaryFile"
            label="ไฟล์สรุปประชุม (PDF, Word)"
            type="file"
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
          <FormInput
            id="image1"
            name="image1"
            label="รูปภาพประกอบ 1 (JPG, PNG)"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
          <FormInput
            id="image2"
            name="image2"
            label="รูปภาพประกอบ 2 (JPG, PNG)"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </div>
      )}

      {/* --- Submission --- */}
      <div className="flex justify-end pt-6 border-t border-slate-200">
        <button
          type="submit"
          disabled={isLoading}
          className="px-8 py-2.5 font-semibold text-white bg-sky-600 rounded-lg shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          {isLoading
            ? "กำลังบันทึก..."
            : isEditMode
              ? "อัปเดตรายงาน"
              : "บันทึกรายงาน"}
        </button>
      </div>
      {/* Error display is now handled by SweetAlert */}
    </form>
  );
}
