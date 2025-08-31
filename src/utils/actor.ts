// src/utils/actor.ts
export type ActorRole = "admin" | "store" | "driver" | "customer";

export function getActor(req: any): { role: ActorRole; id?: string } {
  if (req.userData?.role === "admin" || req.userData?.role === "superadmin") {
    return { role: "admin", id: String(req.userData._id) };
  }
  if (req.vendorUser) return { role: "store", id: String(req.vendorUser._id) };
  if (req.driverUser) return { role: "driver", id: String(req.driverUser._id) };
  return { role: "customer", id: req.firebaseUser?.uid };
}
