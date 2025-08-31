// models/PushToken.ts
import { Schema, model } from 'mongoose';
const PushToken = new Schema({
  userId: { type:String, index:true },
  token: { type:String, unique:true, index:true },
  device: String,
  updatedAt: { type: Date, default: Date.now }
});
export default model('PushToken', PushToken);
