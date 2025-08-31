// models/MessagingPrefs.ts
import { Schema, model } from "mongoose";
const MessagingPrefsSchema = new Schema({
  userId: { type: String, unique: true, required: true },
  channels: {
    inApp: { type:Boolean, default:true },
    push:  { type:Boolean, default:true },
    sms:   { type:Boolean, default:false },
    email: { type:Boolean, default:false },
  },
  quietHours: { start:String, end:String, tz:{ type:String, default:"Asia/Aden" } }, // "HH:mm"
  caps: { perDay: { type:Number, default: 10 } },
}, { timestamps: true });
export default model("MessagingPrefs", MessagingPrefsSchema);
