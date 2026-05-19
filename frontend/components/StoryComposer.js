'use client';

import { AtSign, ImagePlus, Move, Sticker, Type, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { apiUrl } from '../lib/api-config';
import { UploadButton, uploadButtonAppearance, uploadedFileUrl, uploadHeaders } from '../lib/uploadthing';
import { useAuth } from './AuthProvider';
const stickerOptions = ['MINI', 'WOW', 'LIVE', 'NEW', '*'];

function clamp(value) {
  return Math.min(92, Math.max(8, value));
}

export function StoryComposer({ onDone }) {
  const { token } = useAuth();
  const canvasRef = useRef(null);
  const draggingRef = useRef(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [overlays, setOverlays] = useState([]);
  const [text, setText] = useState('');
  const [mention, setMention] = useState('');
  const [message, setMessage] = useState('');

  function addOverlay(type, value) {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    setOverlays((current) => [
      ...current,
      { id: crypto.randomUUID(), type, value: cleanValue, x: 50, y: 50 }
    ]);
  }

  function addText() {
    addOverlay('text', text);
    setText('');
  }

  function addMention() {
    const cleanMention = mention.trim().replace(/^@/, '');
    addOverlay('mention', `@${cleanMention}`);
    setMention('');
  }

  function pointerPosition(event) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100)
    };
  }

  function moveOverlay(event) {
    if (!draggingRef.current) return;
    const next = pointerPosition(event);
    if (!next) return;
    setOverlays((current) => current.map((overlay) => (
      overlay.id === draggingRef.current ? { ...overlay, ...next } : overlay
    )));
  }

  async function submit(event) {
    event.preventDefault();
    if (!token || !mediaUrl) return;

    try {
      const res = await fetch(`${apiUrl}/api/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mediaUrl, mediaType, overlays })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Story was not created.');
      window.dispatchEvent(new CustomEvent('mini-instagram:story-created', { detail: { story: data.story } }));
      onDone?.();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="story-modal" role="dialog" aria-modal="true" aria-label="Create story">
      <form className="story-panel" onSubmit={submit}>
        <button type="button" className="story-close" onClick={onDone} aria-label="Close story editor">
          <X size={22} />
        </button>

        {!mediaUrl ? (
          <div className="story-dropzone">
            <ImagePlus size={70} />
            <p>Upload a photo or video</p>
            <UploadButton
              endpoint="storyMediaUploader"
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
                setMediaUrl(url);
                setMediaType(file?.type?.startsWith('video/') ? 'video' : 'image');
                setMessage('');
              }}
              onUploadError={(error) => setMessage(error.message || 'Upload failed.')}
            />
          </div>
        ) : (
          <div className="story-editor">
            <div
              className="story-canvas"
              ref={canvasRef}
              onPointerMove={moveOverlay}
              onPointerUp={() => { draggingRef.current = null; }}
              onPointerLeave={() => { draggingRef.current = null; }}
            >
              {mediaType === 'video' ? (
                <video src={mediaUrl} controls />
              ) : (
                <img src={mediaUrl} alt="" />
              )}
              {overlays.map((overlay) => (
                <button
                  type="button"
                  className={`story-overlay story-overlay--${overlay.type}`}
                  key={overlay.id}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    draggingRef.current = overlay.id;
                  }}
                  style={{ left: `${overlay.x}%`, top: `${overlay.y}%` }}
                  title="Drag to move"
                >
                  {overlay.value}
                </button>
              ))}
            </div>

            <aside className="story-tools">
              <label>
                <span><Type size={16} />Text</span>
                <div className="story-tool-row">
                  <input value={text} onChange={(event) => setText(event.target.value)} placeholder="Write text" />
                  <button type="button" onClick={addText}>Add</button>
                </div>
              </label>

              <label>
                <span><AtSign size={16} />Tag people</span>
                <div className="story-tool-row">
                  <input value={mention} onChange={(event) => setMention(event.target.value)} placeholder="username" />
                  <button type="button" onClick={addMention}>Tag</button>
                </div>
              </label>

              <div className="story-stickers">
                <span><Sticker size={16} />Stickers</span>
                <div>
                  {stickerOptions.map((sticker) => (
                    <button type="button" key={sticker} onClick={() => addOverlay('sticker', sticker)}>
                      {sticker}
                    </button>
                  ))}
                </div>
              </div>

              <p className="story-hint"><Move size={16} />Drag text, tags, and stickers on the media.</p>

              <div className="story-actions">
                <button type="button" className="secondary" onClick={() => { setMediaUrl(''); setOverlays([]); }}>
                  Change media
                </button>
                <button type="submit">Share story</button>
              </div>
            </aside>
          </div>
        )}

        {message ? <p className="story-message">{message}</p> : null}
      </form>
    </div>
  );
}
