import mongoose, { Schema, Document } from 'mongoose';

export interface IBanner extends Document {
  bannerId: string;
  message: string;
  displayFrom: Date;
  displayTo?: Date;
  type: 'banner' | 'popup';
  isPublic: boolean;
}

const BannerSchema = new Schema(
    {
      bannerId: { type: String, required: true },
      message: { type: String, required: true },
      displayFrom: { type: Date, required: true, default: Date.now },
      displayTo: Date,
      type: { type: String, enum: ['banner', 'popup'], default: 'banner' },
      isPublic: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export default mongoose.model<IBanner>('Banner', BannerSchema);