import { Types } from "mongoose";
import { INote } from "../models/delivry_Marketplace_V1/Order";

export function sanitizeNotes(raw: any): INote[] {
  const toNote = (v: any): INote | null => {
    if (typeof v === "string") {
      const body = v.trim();
      if (!body) return null;
      return {
        body,
        visibility: "internal",
        byRole: "system",
        createdAt: new Date(),
      };
    }
    if (v && typeof v === "object") {
      const body = (v.body ?? "").toString().trim();
      if (!body) return null;
      const visibility = v.visibility === "public" ? "public" : "internal";
      const byRole: INote["byRole"] = [
        "customer",
        "admin",
        "store",
        "driver",
        "system",
      ].includes(v.byRole)
        ? v.byRole
        : "system";
      const byId = v.byId ? new Types.ObjectId(v.byId) : undefined;
      const createdAt = v.createdAt ? new Date(v.createdAt) : new Date();
      return { body, visibility, byRole, byId, createdAt };
    }
    return null;
  };

  // notes كانت نص؟ حوّلها لمصفوفة بملاحظة واحدة
  if (!Array.isArray(raw)) {
    const n = toNote(raw);
    return n ? [n] : [];
  }

  // notes مصفوفة: خرّط العناصر كلها لملاحظات سليمة
  return raw.map(toNote).filter((n): n is INote => !!n);
}
