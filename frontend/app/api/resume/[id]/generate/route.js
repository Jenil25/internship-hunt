import { requireOwnedJob, auth } from '@/lib/auth';
import { getProfile, setResumePath } from '@/lib/db';
import { generateResume } from '@/lib/resume';
import { NextResponse } from 'next/server';

/**
 * Generate a tailored resume for one job, on demand.
 *
 * Deliberately separate from the triage decision: applying is the user's call
 * and must be recorded even if Gemini or the LaTeX service is down. A failure
 * here returns an error the UI can show and retry, without unwinding the
 * application state.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const job = await requireOwnedJob(id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Don't pay for a second generation if one already exists. ?force=1 to redo.
    const force = new URL(request.url).searchParams.get('force') === '1';
    if (job.resume_file_path && !force) {
      return NextResponse.json({ success: true, alreadyExists: true, resume_file_path: job.resume_file_path });
    }
    if (job.pipeline_state === 'ineligible') {
      return NextResponse.json({ error: 'Job is marked ineligible' }, { status: 400 });
    }
    if (!job.job_description) {
      return NextResponse.json({ error: 'No job description stored for this job' }, { status: 400 });
    }

    const session = await auth();
    const profile = await getProfile(session.user.email, job.profile_name || 'general');
    if (!profile) {
      return NextResponse.json({ error: 'No candidate profile found' }, { status: 400 });
    }

    const resumePath = await generateResume({
      job,
      profileJson: profile.profile_json,
      userEmail: session.user.email,
    });

    await setResumePath(id, resumePath, session.user.email);

    return NextResponse.json({ success: true, resume_file_path: resumePath });
  } catch (e) {
    console.error('Resume generation failed:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
