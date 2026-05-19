import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /.+@.+\..+/ },
    password: { type: String, required: true, minlength: 6 },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 180 },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    avatarUrl: this.avatarUrl,
    bio: this.bio,
    followers: (this.followers || []).map((id) => id.toString()),
    following: (this.following || []).map((id) => id.toString()),
    role: this.role
  };
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
