'use client';

import { ImagePlus, Images, X } from 'lucide-react';
import { useState } from 'react';
import { UploadButton, uploadButtonAppearance, uploadedFileUrl, uploadHeaders } from '../lib/uploadthing';
import { useAuth } from './AuthProvider';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function PostComposer({ onDone }) {
  const { token, user } = useAuth();
  const [imageUrl, setImageUrl] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [message, setMessage] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!token) return;
    if (!imageUrl) {
      setMessage('Choose an image first.');
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      setIsSharing(true);
      setMessage('Sharing post...');
      const res = await fetch(`${apiUrl}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caption, imageUrl, mediaType, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) }),
        signal: controller.signal
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Post was not created.');
      setCaption('');
      setTags('');
      setImageUrl('');
      setMediaType('');
      setMessage('Post shared.');
      event.currentTarget?.reset();
      window.dispatchEvent(new CustomEvent('mini-instagram:post-created', { detail: { post: data.post } }));
      onDone?.();
    } catch (error) {
      setMessage(error.name === 'AbortError' ? 'Post request timed out. Try a smaller file.' : error.message);
    } finally {
      clearTimeout(timeout);
      setIsSharing(false);
    }
  }

  if (!user) return null;

  return (
    <div className="create-modal" role="dialog" aria-modal="true" aria-label="Create post">
      <form className="create-panel" onSubmit={submit}>
        <button type="button" className="create-close" onClick={onDone} aria-label="Close create post">
          <X size={22} />
        </button>

        {!imageUrl ? (
          <div className="create-dropzone">
            <Images size={72} />
            <p>Upload a photo or video</p>
            <UploadButton
              endpoint="postImageUploader"
              headers={() => uploadHeaders(token)}
              appearance={uploadButtonAppearance}
              content={{ button: ({ isUploading }) => isUploading ? 'Uploading...' : 'Select from computer' }}
              onUploadBegin={() => setMessage('Uploading media...')}
              onClientUploadComplete={(files) => {
                const file = files?.[0];
                const url = uploadedFileUrl(file);
                if (!url) {
                  setMessage('Upload finished, but no file URL was returned.');
                  return;
                }
                setImageUrl(url);
                setMediaType(file?.type?.startsWith('video/') ? 'video' : 'image');
                setMessage('');
              }}
              onUploadError={(error) => setMessage(error.message || 'Upload failed.')}
            />
          </div>
        ) : (
          <div className="create-editor">
            <div className="create-preview">
              {mediaType === 'video' ? (
                <video src={imageUrl} controls />
              ) : (
                <img src={imageUrl} alt="" />
              )}
            </div>
            <div className="create-fields">
              <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Write a caption..." required />
              <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Hashtags separated by commas" />
              <div className="create-actions">
                <button type="button" className="secondary" onClick={() => { setImageUrl(''); setMediaType(''); }}>
                  Change media
                </button>
                <button type="submit" disabled={isSharing}>
                  <ImagePlus size={18} />
                  {isSharing ? 'Sharing...' : 'Share Post'}
                </button>
              </div>
            </div>
          </div>
        )}

        {message ? <p className="create-message">{message}</p> : null}
      </form>
    </div>
  );
}
