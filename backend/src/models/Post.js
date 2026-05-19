import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    caption: { type: String, required: true, trim: true, maxlength: 500 },
    imageUrl: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    location: { type: String, default: '' },
    visibility: { type: String, enum: ['private', 'followers', 'public'], default: 'public' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isArchived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

postSchema.index({ caption: 'text', location: 'text' });

export const Post = mongoose.models.Post || mongoose.model('Post', postSchema);
