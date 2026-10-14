import { issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned, type HandleUploadPresignedBody } from '@vercel/blob/client';
import { route } from '@/lib/http';

const ALLOWED = ['image/*', 'audio/*', 'video/*'];
const MAX_BYTES = 200 * 1024 * 1024;

// Browser uploads go straight to Blob via a short-lived presigned URL
// (works with Vercel's OIDC store connection and with a read-write token).
export const POST = route(async (req: Request) => {
  const body = (await req.json()) as HandleUploadPresignedBody;
  return handleUploadPresigned({
    body,
    request: req,
    // Only used to verify upload-completed callbacks, which this app doesn't use.
    webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || 'unused',
    getSignedToken: async (pathname) => ({
      token: await issueSignedToken({
        pathname,
        operations: ['put'],
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: MAX_BYTES,
      }),
      urlOptions: {
        addRandomSuffix: true,
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: MAX_BYTES,
      },
    }),
  });
});
