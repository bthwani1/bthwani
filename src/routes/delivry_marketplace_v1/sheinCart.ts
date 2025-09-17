// routes/sheinCart.ts
import { Router } from "express";
import SheinCart from "../../models/delivry_Marketplace_V1/SheinCart";
import { User } from "../../models/user";

const r = Router();

// add item
r.post("/shein/cart/add", async (req, res) => {
  const uid = req.user?.id;
  if (!uid) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = await User.findOne({ firebaseUID: uid });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const item = req.body; // نفس الـpayload من الويب فيو
  await SheinCart.updateOne(
    { user: user._id },
    {
      $setOnInsert: { user: user._id },
      $push: { items: item },
      $set: { updatedAt: new Date() },
    },
    { upsert: true }
  );
  res.status(201).json({ ok: true });
});

// get cart
r.get("/shein/cart", async (req, res) => {
  const uid = req.user?.id;
  if (!uid) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = await User.findOne({ firebaseUID: uid });
  const doc = await SheinCart.findOne({ user: user!._id });
  res.json({ items: doc?.items || [] });
});

// clear
r.delete("/shein/cart", async (req, res) => {
  const uid = req.user?.id;
  if (!uid) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = await User.findOne({ firebaseUID: uid });
  await SheinCart.deleteOne({ user: user!._id });
  res.json({ ok: true });
});
r.patch("/shein/cart/item/:id", async (req, res) => {
  const uid = req.user?.id; if (!uid) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = await User.findOne({ firebaseUID: uid });
  const { id } = req.params; const { quantity } = req.body;
  if (typeof quantity !== "number" || quantity < 0) {
    res.status(400).json({ message: "Bad quantity" });
    return;
  } 

  if (quantity === 0) {
    await SheinCart.updateOne({ user: user!._id }, { $pull: { items: { id } }, $set: { updatedAt: new Date() } });
  } else {
    await SheinCart.updateOne(
      { user: user!._id, "items.id": id },
      { $set: { "items.$.quantity": quantity, updatedAt: new Date() } }
    );
  }
  res.json({ ok: true });
});

// DELETE عنصر واحد
r.delete("/shein/cart/item/:id", async (req, res) => {
  const uid = req.user?.id; if (!uid) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = await User.findOne({ firebaseUID: uid });
  const { id } = req.params;
  await SheinCart.updateOne({ user: user!._id }, { $pull: { items: { id } }, $set: { updatedAt: new Date() } });
  res.json({ ok: true });
});
export default r;
