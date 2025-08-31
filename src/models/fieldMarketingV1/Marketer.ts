import { Schema, model, Document } from "mongoose";
export interface IMarketer extends Document {
  fullName: string;
  phone: string;
  email: string;
  password: string;           // bcrypt hash
  city?: string; team?: string; area?: string;
  status: "active"|"suspended";
}
const Sch = new Schema<IMarketer>({
  fullName: { type: String, required: true },
  phone:    { type: String, required: true, unique: true, index: true },
  email:    { type: String, required: true, unique: true, lowercase: true, index: true }, // <—
  password: { type: String, required: true },                                              // <—
  city: String, team: String, area: String,
  status:   { type: String, enum: ["active","suspended"], default: "active" }
},{ timestamps: true });
export default model<IMarketer>("Marketer", Sch);
