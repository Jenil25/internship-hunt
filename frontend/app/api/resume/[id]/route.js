import { getJobById } from '@/lib/db';
import { getS3Object, parseS3Key } from '@/lib/s3';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Local fallback for legacy files
const FILES_BASE = process.env.FILES_BASE_PATH || '/Users/jenilmahyavanshi/n8n-local/local_files';

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'pdf';

  const job = await getJobById(id);
  if (!job || !job.resume_file_path) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
  }

  const resumePath = job.resume_file_path;

  // ─── S3 Path (new jobs) ───
  if (resumePath.startsWith('s3://')) {
    try {
      const s3Key = parseS3Key(resumePath, format);
      const { stream, contentType, contentLength } = await getS3Object(s3Key);

      const filename = path.basename(s3Key);
      const mimeType = format === 'pdf' ? 'application/pdf' : 'text/plain';

      return new NextResponse(stream, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...(contentLength && { 'Content-Length': contentLength.toString() }),
        },
      });
    } catch (err) {
      console.error('S3 download error:', err);
      return NextResponse.json(
        { error: 'Failed to download from S3', detail: err.message },
        { status: 500 }
      );
    }
  }

  // ─── Local Path (legacy jobs) ───
  let relativePath = resumePath.replace(/^\/files\//, '');
  if (format === 'pdf') {
    relativePath = relativePath.replace('.tex', '.pdf');
  }

  const filePath = path.join(FILES_BASE, relativePath);

  if (!fs.existsSync(filePath)) {
    if (format === 'pdf') {
      try {
        const texPath = relativePath.replace('.pdf', '.tex');
        const compileRes = await fetch(
          `${process.env.LATEX_SERVICE_URL || 'http://localhost:3001'}/compile`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: texPath }),
          }
        );
        if (!compileRes.ok || !fs.existsSync(filePath)) {
          return NextResponse.json({ error: 'PDF compilation failed' }, { status: 500 });
        }
      } catch (e) {
        return NextResponse.json({ error: 'LaTeX service unavailable' }, { status: 503 });
      }
    } else {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  }

  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const mimeType = format === 'pdf' ? 'application/pdf' : 'text/plain';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': fileBuffer.length.toString(),
    },
  });
}
