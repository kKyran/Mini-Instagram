import mongoose from 'mongoose';

const overlaySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['text', 'mention', 'sticker'], required: true },
    value: { type: String, required: true, trim: true, maxlength: 80 },
    x: { type: Number, default: 50, min: 0, max: 100 },
    y: { type: Number, default: 50, min: 0, max: 100 }
  },
  { _id: true }
);

const storySchema = new mongoose.Schema(
  {
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video'], required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    overlays: [overlaySchema],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: true }
  },
  { timestamps: true }
);

storySchema.index({ author: 1, createdAt: -1 });

export const Story = mongoose.models.Story || mongoose.model('Story', storySchema);
