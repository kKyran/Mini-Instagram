import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['post_like', 'story_like', 'comment', 'follow'], required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    story: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', default: null },
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    text: { type: String, default: '', maxlength: 300 },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ receiver: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
