'use client';

import { generateUploadButton } from '@uploadthing/react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const UploadButton = generateUploadButton({
  url: `${apiUrl}/api/uploadthing`
});

export function uploadHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function uploadedFileUrl(file) {
  return file?.ufsUrl || file?.url || file?.serverData?.url || '';
}

export const uploadButtonAppearance = {
  container: {
    display: 'grid',
    gap: '8px',
    justifyItems: 'center'
  },
  button: {
    background: 'var(--slate)',
    border: '0',
    borderRadius: '8px',
    color: 'var(--cloud)',
    cursor: 'pointer',
    fontWeight: 800,
    minHeight: '42px',
    padding: '9px 18px',
    width: 'fit-content'
  },
  allowedContent: {
    color: 'rgba(220, 239, 238, 0.72)',
    fontSize: '0.82rem'
  }
};
