import { getJobById } from '@/lib/db';
import { getS3Object, parseS3Key, uploadToS3 } from '@/lib/s3';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Local fallback for legacy files
const FILES_BASE = process.env.FILES_BASE_PATH || './local_files';

function getLocalFallbackPath(filesBase, company, format) {
  const ext = format === 'pdf' ? 'pdf' : 'tex';
  if (!company) return path.join(filesBase, `master_resume.${ext}`);
  
  const cleanCompanyNames = [
    company,
    company.replace(/\s+/g, ''),
    company.replace(/[^a-zA-Z0-9]/g, ''),
  ];

  for (const name of cleanCompanyNames) {
    const candidates = [
      path.join(filesBase, 'output', `Resume_${name}.${ext}`),
      path.join(filesBase, 'output', name, 'v1', `Resume_${name}.${ext}`),
      path.join(filesBase, 'resumes', `Resume_${name}.${ext}`),
    ];

    for (const file of candidates) {
      if (fs.existsSync(file)) {
        return file;
      }
    }
  }

  // Baseline fallback to master resume
  const masterFile = path.join(filesBase, `master_resume.${ext}`);
  if (fs.existsSync(masterFile)) {
    return masterFile;
  }

  return null;
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'pdf';
  const inline = searchParams.get('mode') === 'inline';
  const disposition = inline ? 'inline' : 'attachment';

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
          'Content-Disposition': `${disposition}; filename="${filename}"`,
          ...(contentLength && { 'Content-Length': contentLength.toString() }),
        },
      });
    } catch (err) {
      console.warn('S3 download failed (credentials likely missing), trying local disk fallback:', err.message);
      
      const fallbackPath = getLocalFallbackPath(FILES_BASE, job.company, format);
      if (fallbackPath && fs.existsSync(fallbackPath)) {
        const fileBuffer = fs.readFileSync(fallbackPath);
        const filename = path.basename(fallbackPath);
        const mimeType = format === 'pdf' ? 'application/pdf' : 'text/plain';

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `${disposition}; filename="${filename}"`,
            'Content-Length': fileBuffer.length.toString(),
          },
        });
      }

      console.error('S3 download error & fallback failed:', err);
      return NextResponse.json(
        { error: 'Failed to download from S3 and no local fallback found', detail: err.message },
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
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Content-Length': fileBuffer.length.toString(),
    },
  });
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { texContent } = await request.json();

    if (!texContent || !texContent.trim()) {
      return NextResponse.json({ error: 'LaTeX content is required' }, { status: 400 });
    }

    const job = await getJobById(id);
    if (!job || !job.resume_file_path) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resumePath = job.resume_file_path;

    // ─── S3 Path (new jobs) ───
    if (resumePath.startsWith('s3://')) {
      try {
        const texKey = parseS3Key(resumePath, 'tex');
        const pdfKey = parseS3Key(resumePath, 'pdf');

        // 1. Upload updated .tex to S3
        await uploadToS3(texKey, texContent, 'text/plain');

        // 2. Call stateless Flask microservice endpoint
        const filename = path.basename(texKey, '.tex');
        const latexServiceUrl = process.env.LATEX_SERVICE_URL || 'http://localhost:3001';
        
        const compileRes = await fetch(`${latexServiceUrl}/compile-binary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tex_content: texContent,
            filename: filename
          })
        });

        if (!compileRes.ok) {
          const errData = await compileRes.json().catch(() => ({}));
          return NextResponse.json({
            error: 'LaTeX compilation failed',
            log: errData.log || errData.error || 'Stateless PDF compilation failed'
          }, { status: 500 });
        }

        // 3. Get the PDF binary and upload to S3
        const pdfArrayBuffer = await compileRes.arrayBuffer();
        const pdfBuffer = Buffer.from(pdfArrayBuffer);
        await uploadToS3(pdfKey, pdfBuffer, 'application/pdf');

        return NextResponse.json({ success: true });
      } catch (err) {
        console.warn('S3 upload/compile failed (credentials likely missing), trying local disk fallback:', err.message);

        // FALLBACK: Compile locally and save the `.tex` and `.pdf` files locally under `output/`
        try {
          const company = job.company || 'general';
          const cleanName = company.replace(/\s+/g, '');
          const relativeTexPath = `output/Resume_${cleanName}.tex`;
          const relativePdfPath = `output/Resume_${cleanName}.pdf`;

          const localTexPath = path.join(FILES_BASE, relativeTexPath);
          const localPdfPath = path.join(FILES_BASE, relativePdfPath);
          const dirPath = path.dirname(localTexPath);

          // Make sure directory exists
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          // 1. Write the updated .tex content locally
          fs.writeFileSync(localTexPath, texContent, 'utf8');

          // 2. Call local Flask compilation API endpoint using compile-binary
          const latexServiceUrl = process.env.LATEX_SERVICE_URL || 'http://localhost:3001';
          const compileRes = await fetch(`${latexServiceUrl}/compile-binary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tex_content: texContent,
              filename: `Resume_${cleanName}`
            })
          });

          if (!compileRes.ok) {
            const errData = await compileRes.json().catch(() => ({}));
            return NextResponse.json({
              error: 'LaTeX compilation failed (fallback)',
              log: errData.log || errData.error || 'Local PDF compilation fallback failed'
            }, { status: 500 });
          }

          // 3. Write compiled PDF locally so GET serves the updated PDF!
          const pdfArrayBuffer = await compileRes.arrayBuffer();
          const pdfBuffer = Buffer.from(pdfArrayBuffer);
          fs.writeFileSync(localPdfPath, pdfBuffer);

          return NextResponse.json({ success: true });
        } catch (fallbackErr) {
          console.error('Local recompile fallback error:', fallbackErr);
          return NextResponse.json({
            error: 'Failed to update S3 resume and fallback compilation failed',
            detail: err.message,
            fallbackDetail: fallbackErr.message
          }, { status: 500 });
        }
      }
    }

    // ─── Local Path (legacy jobs) ───
    const relativePath = resumePath.replace(/^\/files\//, '');
    const filePath = path.join(FILES_BASE, relativePath);
    const dirPath = path.dirname(filePath);

    // Make sure directories exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // 1. Write the updated .tex content to local disk
    fs.writeFileSync(filePath, texContent, 'utf8');

    // 2. Call local Flask compilation API endpoint
    try {
      const latexServiceUrl = process.env.LATEX_SERVICE_URL || 'http://localhost:3001';
      const compileRes = await fetch(`${latexServiceUrl}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: relativePath })
      });

      if (!compileRes.ok) {
        const errData = await compileRes.json().catch(() => ({}));
        return NextResponse.json({
          error: 'LaTeX compilation failed',
          log: errData.log || errData.error || 'Local PDF compilation failed'
        }, { status: 500 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'LaTeX service unavailable', detail: e.message }, { status: 503 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

