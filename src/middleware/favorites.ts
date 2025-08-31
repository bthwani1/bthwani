// validators/favorites.ts
import { z } from "zod";

export const favoriteBodySchema = z.object({
  itemId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  itemType: z.enum(["product", "restaurant"]),
});
