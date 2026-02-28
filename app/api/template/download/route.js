import { NextResponse } from 'next/server';
import { defaultTemplate } from '@/lib/defaultTemplate';

export async function GET() {
  return new NextResponse(defaultTemplate, {
    headers: {
      'Content-Type': 'application/x-tex',
      'Content-Disposition': 'attachment; filename="master_resume.tex"',
    },
  });
}
