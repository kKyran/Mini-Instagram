import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    body: { type: String, required: true, trim: true, maxlength: 300 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
