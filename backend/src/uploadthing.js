import { createUploadthing } from 'uploadthing/express';
import { UploadThingError } from 'uploadthing/server';
import { verifyToken } from './utils/auth.js';

const f = createUploadthing();

function authenticatedUpload(purpose) {
  return async ({ req }) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UploadThingError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new UploadThingError({ code: 'UNAUTHORIZED', message: 'Invalid token' });
    }
    return {
      purpose,
      userId: payload.sub,
      username: payload.username
    };
  };
}

export const uploadRouter = {
  avatarUploader: f({ image: { maxFileSize: '2MB', maxFileCount: 1 } })
    .middleware(authenticatedUpload('avatar'))
    .onUploadComplete(({ file, metadata }) => ({
    uploadedBy: metadata.userId,
    url: file.ufsUrl || file.url,
    purpose: metadata.purpose
  })),
  postImageUploader: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
    video: { maxFileSize: '16MB', maxFileCount: 1 }
  })
    .middleware(authenticatedUpload('post-media'))
    .onUploadComplete(({ file, metadata }) => ({
    uploadedBy: metadata.userId,
    url: file.ufsUrl || file.url,
    purpose: metadata.purpose
  })),
  storyMediaUploader: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
    video: { maxFileSize: '16MB', maxFileCount: 1 }
  })
    .middleware(authenticatedUpload('story-media'))
    .onUploadComplete(({ file, metadata }) => ({
    uploadedBy: metadata.userId,
    url: file.ufsUrl || file.url,
    purpose: metadata.purpose
  }))
};

export function isUploadThingConfigured() {
  const token = process.env.UPLOADTHING_TOKEN || '';
  return Boolean(token && token !== 'replace-with-uploadthing-token');
}
