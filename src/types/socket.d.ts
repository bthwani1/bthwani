// src/types/socket.d.ts
import "socket.io";
declare module "socket.io" {
  interface Socket {
    data: {
      uid?: string;
      userId?: string;
      role?: "admin" | "superadmin" | "vendor" | "driver" | "customer";
      vendorId?: string;
      driverId?: string;
    };
  }
}
