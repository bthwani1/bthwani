// routes/favorites.ts
import { Router } from "express";
import { addFavorite, removeFavorite, listFavorites, existsFavorite, counts } from "../controllers/favorites.controller";
import { verifyFirebase } from "../middleware/verifyFirebase";

const r = Router();
r.use(verifyFirebase);

r.get("/", listFavorites);                                    // ?type=product|restaurant
r.post("/", addFavorite);                                     // { itemId, itemType }
r.delete("/:itemType/:itemId", removeFavorite);               // /product/ID
r.get("/exists/:itemType/:itemId", existsFavorite);           // /restaurant/ID
r.get("/counts", counts);                                     // ?type=product&ids=a,b,c

export default r;
