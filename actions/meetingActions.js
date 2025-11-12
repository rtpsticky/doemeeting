'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createMeeting(formData) {
  const data = {
    title: formData.get('title'),
    format: formData.get('format'),
    startDate: new Date(formData.get('startDate')),
    endDate: new Date(formData.get('endDate')),
    organizerId: parseInt(formData.get('organizerId'), 10),
    otherOrganizer: formData.get('otherOrganizer'),
    summary: formData.get('summary'),
    // ... handle other fields, especially many-to-many relations
  };

  // Basic validation
  if (!data.title || !data.startDate || !data.endDate || !data.organizerId) {
    return { error: 'Missing required fields' };
  }

  try {
    const newMeeting = await prisma.meetingReport.create({
      data: {
        status: 'ATTENDEE', // default
        title: data.title,
        format: data.format,
        startDate: data.startDate,
        endDate: data.endDate,
        organizerId: data.organizerId,
        otherOrganizer: data.otherOrganizer,
        summary: data.summary,
        // TODO: Connect to many-to-many relations (objectives, tags, etc.)
        // This requires more complex logic to handle the IDs from the form
      },
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    return { error: 'Failed to create meeting report.' };
  }

  revalidatePath('/'); // Revalidate the home page to show the new meeting
  redirect('/'); // Redirect to the home page
}
