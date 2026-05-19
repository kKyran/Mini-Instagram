'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bookmark, CalendarDays, Grid3X3, Heart, ImageIcon, LockKeyhole, MessageCircle, Send, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../components/AuthProvider';
import { ProfileSummary } from '../../components/ProfileSummary';
import { SideNav } from '../../components/SideNav';
import { UploadButton, uploadButtonAppearance, uploadedFileUrl, uploadHeaders } from '../../lib/uploadthing';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthorId(post) {
  return post?.author?._id || post?.author?.id;
}

function isOwnPost(post, user) {
  return String(getAuthorId(post) || '') === String(user?.id || '') || post?.author?.username === user?.username;
}

function isVideoPost(post) {
  return post?.mediaType === 'video' || (typeof post?.imageUrl === 'string' && post.imageUrl.startsWith('data:video/'));
}

function readSavedPosts() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('mini-instagram-saved-posts') || '[]');
  } catch {
    return [];
  }
}

export default function ProfilePage() {
  const { user, token, updateProfile } = useAuth();
  const [bio, setBio] = useState(user?.bio || '');
  const [posts, setPosts] = useState([]);
  const [archivedPosts, setArchivedPosts] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [selectedPost, setSelectedPost] = useState(null);
  const [likedPosts, setLikedPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');

  useEffect(() => {
    setBio(user?.bio || '');
  }, [user?.bio]);

  useEffect(() => {
    setSavedPosts(readSavedPosts());
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    loadProfilePosts();
    window.addEventListener('mini-instagram:post-created', loadProfilePosts);
    window.addEventListener('mini-instagram:post-archived', loadProfilePosts);
    return () => {
      window.removeEventListener('mini-instagram:post-created', loadProfilePosts);
      window.removeEventListener('mini-instagram:post-archived', loadProfilePosts);
    };
  }, [user?.id, token]);

  async function loadProfilePosts() {
    if (!user) return;
    setMessage('');
    try {
      const [postsRes, archivedRes] = await Promise.all([
        fetch(`${apiUrl}/api/posts`),
        token ? fetch(`${apiUrl}/api/posts/archived/mine`, { headers: { Authorization: `Bearer ${token}` } }) : null
      ]);
      const postsData = await postsRes.json();
      const archivedData = archivedRes ? await archivedRes.json() : { posts: [] };
      if (!postsRes.ok) throw new Error(postsData.message || 'Posts could not be loaded');
      if (archivedRes && !archivedRes.ok) throw new Error(archivedData.message || 'Hidden posts could not be loaded');
      setPosts((postsData.posts || []).filter((post) => isOwnPost(post, user)));
      setArchivedPosts(archivedData.posts || []);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function saveBio(event) {
    event.preventDefault();
    await updateProfile({ bio });
  }

  function toggleLike(postId) {
    setLikedPosts((current) => current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId]);
  }

  function toggleSave(postId) {
    setSavedPosts((current) => {
      const next = current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId];
      localStorage.setItem('mini-instagram-saved-posts', JSON.stringify(next));
      return next;
    });
  }

  const visiblePosts = activeTab === 'hidden' ? archivedPosts : posts;
  const selectedPostLiked = selectedPost ? likedPosts.includes(selectedPost._id) : false;
  const selectedPostSaved = selectedPost ? savedPosts.includes(selectedPost._id) : false;
  const joinedDate = useMemo(() => new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), []);

  if (!user) return <main className="profile-dashboard"><p>Please log in to view your profile.</p></main>;

  return (
    <main className="profile-dashboard">
      <aside className="left-rail profile-left-rail">
        <ProfileSummary initialPosts={posts} hasStory={false} />
        <SideNav activeView="profile" />
      </aside>

      <section className="profile-dash-main">
        <header className="profile-dash-title">
          <h1>My Account</h1>
          <button type="button" onClick={loadProfilePosts}>Refresh</button>
        </header>

        <section className="profile-hero">
          <div className="profile-hero__cover" />
          <div className="profile-hero__content">
            <Avatar user={user} className="profile-hero__avatar" />
            <div className="profile-hero__identity">
              <h2>{user.username}</h2>
              <span>@{user.username}</span>
              <p>{bio || 'No bio yet.'}</p>
            </div>
            <div className="profile-hero__actions">
              <div className="profile-avatar-picker profile-avatar-uploader">
                <UploadButton
                  endpoint="avatarUploader"
                  headers={() => uploadHeaders(token)}
                  appearance={{
                    ...uploadButtonAppearance,
                    container: { display: 'block' },
                    button: {
                      ...uploadButtonAppearance.button,
                      background: 'transparent',
                      border: 0,
                      minHeight: 'auto',
                      padding: 0
                    },
                    allowedContent: { display: 'none' }
                  }}
                  content={{ button: ({ isUploading }) => isUploading ? 'Uploading...' : 'Change avatar' }}
                  onUploadBegin={() => setAvatarMessage('Uploading avatar...')}
                  onClientUploadComplete={async (files) => {
                    const url = uploadedFileUrl(files?.[0]);
                    if (!url) {
                      setAvatarMessage('Upload finished, but no avatar URL was returned.');
                      return;
                    }
                    try {
                      await updateProfile({ avatarUrl: url });
                      setAvatarMessage('Avatar updated.');
                    } catch {
                      setAvatarMessage('Avatar could not be updated.');
                    }
                  }}
                  onUploadError={(error) => setAvatarMessage(error.message || 'Avatar upload failed.')}
                />
              </div>
              {avatarMessage ? <p className="profile-avatar-message">{avatarMessage}</p> : null}
              <form onSubmit={saveBio}>
                <input value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Write bio" maxLength={180} />
                <button type="submit">Save</button>
              </form>
            </div>
          </div>
        </section>

        <section className="profile-stat-grid">
          <article><b>{user.followers?.length || 0}</b><span>Followers</span></article>
          <article><b>{user.following?.length || 0}</b><span>Following</span></article>
          <article><b>{posts.length}</b><span>Posts</span></article>
          <article><b>{savedPosts.length}</b><span>Saved</span></article>
        </section>

        <section className="profile-info-grid">
          <article>
            <h3>Profile</h3>
            <p>{user.email}</p>
            <p><CalendarDays size={16} /> Joined {joinedDate}</p>
          </article>
          <article>
            <h3>Bio</h3>
            <p>{bio || 'Write something about yourself.'}</p>
          </article>
        </section>

        <section className="profile-post-section">
          <header>
            <div>
              <h3>Media</h3>
              <p>Open a post to like it or save it.</p>
            </div>
            <div className="profile-tabs">
              <button type="button" className={activeTab === 'posts' ? 'is-active' : ''} onClick={() => setActiveTab('posts')}>
                <Grid3X3 size={16} /> Posts
              </button>
              <button type="button" className={activeTab === 'hidden' ? 'is-active' : ''} onClick={() => setActiveTab('hidden')}>
                <LockKeyhole size={16} /> Hidden
              </button>
            </div>
          </header>

          {message ? <p className="profile-message">{message}</p> : null}
          {visiblePosts.length ? (
            <div className="profile-post-grid">
              {visiblePosts.map((post) => (
                <button type="button" className="profile-post-tile" key={post._id} onClick={() => setSelectedPost(post)}>
                  {isVideoPost(post) ? <video src={post.imageUrl} muted playsInline /> : <img src={post.imageUrl} alt="" />}
                  <span><ImageIcon size={16} /> {post.caption || 'Post'}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="profile-empty">
              <ImageIcon size={28} />
              <strong>{activeTab === 'hidden' ? 'No hidden posts' : 'No posts yet'}</strong>
              <span>{activeTab === 'hidden' ? 'Posts hidden from the feed will be here.' : 'Create a post and it will appear here.'}</span>
            </div>
          )}
        </section>
      </section>

      {selectedPost ? (
        <div className="profile-post-modal" role="dialog" aria-modal="true">
          <article className="profile-post-view">
            <button type="button" className="profile-post-view__close" onClick={() => setSelectedPost(null)} aria-label="Close post">
              <X size={22} />
            </button>
            <div className="profile-post-view__media">
              {isVideoPost(selectedPost) ? <video src={selectedPost.imageUrl} controls autoPlay /> : <img src={selectedPost.imageUrl} alt="" />}
            </div>
            <aside className="profile-post-view__details">
              <div className="profile-post-view__author">
                <Avatar user={user} />
                <div>
                  <strong>{user.username}</strong>
                  <p>@{user.username}</p>
                </div>
              </div>
              <p>{selectedPost.caption || 'No caption'}</p>
              <div className="profile-post-view__tags">
                {(selectedPost.tags || []).map((tag, index) => <span key={tag._id || tag.slug || index}>#{tag.name || tag}</span>)}
              </div>
              <footer className="profile-post-view__actions">
                <button type="button" className={selectedPostLiked ? 'is-active' : ''} onClick={() => toggleLike(selectedPost._id)}>
                  <Heart size={22} /> {(selectedPost.likes?.length || 0) + (selectedPostLiked ? 1 : 0)}
                </button>
                <button type="button"><MessageCircle size={22} /> {selectedPost.commentCount || 0}</button>
                <button type="button"><Send size={22} /> Share</button>
                <button type="button" className={selectedPostSaved ? 'is-active' : ''} onClick={() => toggleSave(selectedPost._id)}>
                  <Bookmark size={22} /> Save
                </button>
              </footer>
            </aside>
          </article>
        </div>
      ) : null}
    </main>
  );
}
