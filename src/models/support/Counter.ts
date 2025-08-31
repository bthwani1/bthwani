// models/Counter.ts (لتوليد أرقام التذاكر)
import { Schema, model } from "mongoose";
const CounterSchema = new Schema({ name:{type:String, unique:true}, seq:{type:Number, default:0} });
CounterSchema.statics.next = async function(name:string){ const c:any = await this.findOneAndUpdate({name},{ $inc:{seq:1}},{ upsert:true, new:true }); return c.seq; }
export default model("Counter", CounterSchema) as any as { next:(name:string)=>Promise<number> };
