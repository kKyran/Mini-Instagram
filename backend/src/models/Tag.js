import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    color: { type: String, default: '#2563eb' },
    description: { type: String, default: '' },
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const Tag = mongoose.models.Tag || mongoose.model('Tag', tagSchema);
