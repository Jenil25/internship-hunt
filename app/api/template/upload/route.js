import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    const key = `templates/${session.user.email}/master_resume.tex`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'application/x-tex',
    }));

    return NextResponse.json({ success: true, key });
  } catch (error) {
    console.error('Template upload error:', error);
    return NextResponse.json({ error: 'Failed to upload template' }, { status: 500 });
  }
}
