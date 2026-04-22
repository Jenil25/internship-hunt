import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Get an object from S3 as a readable stream.
 * @param {string} key - S3 object key (e.g. "resumes/ByteDance/v1/Resume_ByteDance.pdf")
 * @returns {Promise<{stream: ReadableStream, contentType: string, contentLength: number}>}
 */
export async function getS3Object(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  const response = await s3Client.send(command);
  return {
    stream: response.Body,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
}

/**
 * Parse an S3 URI or resume_file_path into an S3 key.
 * Handles both formats:
 *   - s3://bucket/resumes/Company/v1/file.tex  → resumes/Company/v1/file.tex
 *   - /files/output/Company/v1/file.tex        → resumes/Company/v1/file.tex (legacy)
 */
export function parseS3Key(resumeFilePath, format = 'tex') {
  let key = resumeFilePath;

  // Handle s3:// URIs
  if (key.startsWith('s3://')) {
    key = key.replace(/^s3:\/\/[^/]+\//, ''); // strip s3://bucket/
  }

  // Handle legacy /files/output/ paths
  if (key.startsWith('/files/output/')) {
    key = key.replace('/files/output/', 'resumes/');
  }

  // Switch extension if requesting PDF
  if (format === 'pdf') {
    key = key.replace(/\.tex$/, '.pdf');
  }

  return key;
}

export { s3Client, BUCKET };
