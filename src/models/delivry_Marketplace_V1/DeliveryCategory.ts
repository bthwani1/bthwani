import mongoose, { Document, Schema } from "mongoose";

export interface IDeliveryCategory extends Document {
  name: string;
  image?: string;
  description?: string;
  isActive:boolean;
  usageType:string;
  parent?: mongoose.Types.ObjectId;
  sortOrder: number; // ★ جديد: رقم الترتيب/الأولوية (كلما كان أصغر كان أعلى)
}

const deliveryCategorySchema = new Schema<IDeliveryCategory>({
  name:        { type: String, required: true },
  image:       { type: String },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  usageType:   { type: String, enum: ["grocery", "restaurant", "retail"], required: true },

  parent:      { type: Schema.Types.ObjectId, ref: "DeliveryCategory" },
  sortOrder:   { type: Number, default: 0, min: 0, index: true },

}, { timestamps: true });
// فهرس يساعد الفرز ضمن نطاق (usageType + parent)
deliveryCategorySchema.index({ usageType: 1, parent: 1, sortOrder: 1 });

// تعيين sortOrder تلقائيًا عند الإنشاء إذا لم يُرسل
deliveryCategorySchema.pre("save", async function (next) {
  const self = this as IDeliveryCategory & Document & { isModified: (k: string)=>boolean };
  // فقط لو جديد وما حدّد sortOrder (أو صفر)
  if (!self.isNew || (typeof self.sortOrder === "number" && self.sortOrder > 0)) return next();

  const Model = self.constructor as mongoose.Model<IDeliveryCategory>;
  const last = await Model
    .findOne({ usageType: self.usageType, parent: self.parent ?? null })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean();

  self.sortOrder = ((last?.sortOrder as number) ?? 0) + 1;
  next();
});

export default mongoose.model<IDeliveryCategory>(
  "DeliveryCategory",
  deliveryCategorySchema
);