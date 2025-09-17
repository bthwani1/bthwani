import { Request, Response } from "express";
import DeliveryCategory from "../../models/delivry_Marketplace_V1/DeliveryCategory";

// Create
// Create
export const create = async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (!body.image) {
      res.status(400).json({ message: "Image URL is required" });
      return;
    }
    if (!body.name) {
      res.status(400).json({ message: "Name is required" });
      return;
    }
    if (!body.usageType) {
      res.status(400).json({ message: "usageType is required" });
      return;
    }

    // ★ لو أرسلت sortOrder: نعمل shift لمن لديهم نفس النطاق (usageType + parent)
    if (typeof body.sortOrder === "number" && body.sortOrder >= 0) {
      await DeliveryCategory.updateMany(
        {
          usageType: body.usageType,
          parent: body.parent ?? null,
          sortOrder: { $gte: body.sortOrder },
        },
        { $inc: { sortOrder: 1 } }
      );
    }

    const data = new DeliveryCategory({
      ...body,
      parent: body.parent ?? null,
    });
    await data.save();

    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};


// Read all
// Read all
export const getAll = async (req: Request, res: Response) => {
  try {
    const { search, usageType, parent, withNumbers } = req.query as {
      search?: string; usageType?: string; parent?: string; withNumbers?: string;
    };

    const filter: any = {};
    if (usageType) filter.usageType = usageType;
    if (typeof parent !== "undefined") {
      filter.parent = parent === "" || parent === "null" ? null : parent;
    }
    if (search) filter.name = { $regex: search, $options: "i" };

    const data = await DeliveryCategory.find(filter).sort({ sortOrder: 1, name: 1 });

    if (withNumbers === "1") {
      const numbered = data.map((doc, idx) => ({
        ...doc.toObject(),
        displayIndex: idx + 1, // ★ رقم العرض للواجهة
      }));
      res.json(numbered);
      return;
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getChildren = async (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;
    const { withNumbers } = req.query as { withNumbers?: string };

    const data = await DeliveryCategory
      .find({ parent: parentId })
      .sort({ sortOrder: 1, name: 1 });

    if (withNumbers === "1") {
      return res.json(
        data.map((d, i) => ({ ...d.toObject(), displayIndex: i + 1 }))
      );
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};



// Read by ID
export const getById = async (req: Request, res: Response) => {
  try {
    const data = await DeliveryCategory.findById(req.params.id);
    if (!data) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Update
export const update = async (req: Request, res: Response) => {
  try {
    const body = req.body;

    const updated = await DeliveryCategory.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Delete
export const remove = async (req: Request, res: Response) => {
  try {
    await DeliveryCategory.findByIdAndDelete(req.params.id);
    res.json({ message: "DeliveryCategory deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
export const getMainCategories = async (req: Request, res: Response) => {
  try {
    const { search, usageType, withNumbers } = req.query as {
      search?: string; usageType?: string; withNumbers?: string;
    };

    const filter: any = { parent: null };
    if (usageType) filter.usageType = usageType;
    if (search) filter.name = { $regex: search, $options: "i" };

    const data = await DeliveryCategory.find(filter).sort({ sortOrder: 1, name: 1 });

    if (withNumbers === "1") {
      return res.json(
        data.map((d, i) => ({ ...d.toObject(), displayIndex: i + 1 }))
      );
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
export const bulkReorder = async (req: Request, res: Response) => {
  try {
    const { items, usageType, parent } = req.body as {
      items: Array<{ _id: string; sortOrder: number }>;
      usageType: "grocery" | "restaurant" | "retail";
      parent?: string | null;
    };

    if (!Array.isArray(items) || !usageType) {
      res.status(400).json({ message: "items[] and usageType are required" });
      return;
    }

    const ops = items.map(it => ({
      updateOne: {
        filter: { _id: it._id, usageType, parent: parent ?? null },
        update: { $set: { sortOrder: it.sortOrder } },
      },
    }));

    await DeliveryCategory.bulkWrite(ops);

    const data = await DeliveryCategory
      .find({ usageType, parent: parent ?? null })
      .sort({ sortOrder: 1, name: 1 });

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
export const moveUp = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const current = await DeliveryCategory.findById(id);
    if (!current) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const prev = await DeliveryCategory.findOne({
      usageType: current.usageType,
      parent: current.parent ?? null,
      sortOrder: { $lt: current.sortOrder },
    }).sort({ sortOrder: -1 });

    if (!prev) return res.json({ message: "Already at top" });

    // swap
    const temp = current.sortOrder;
    current.sortOrder = prev.sortOrder;
    prev.sortOrder = temp;
    await Promise.all([current.save(), prev.save()]);

    res.json({ message: "Moved up", current });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const moveDown = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const current = await DeliveryCategory.findById(id);
    if (!current) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const next = await DeliveryCategory.findOne({
      usageType: current.usageType,
      parent: current.parent ?? null,
      sortOrder: { $gt: current.sortOrder },
    }).sort({ sortOrder: 1 });

    if (!next) return res.json({ message: "Already at bottom" });

    const temp = current.sortOrder;
    current.sortOrder = next.sortOrder;
    next.sortOrder = temp;
    await Promise.all([current.save(), next.save()]);

    res.json({ message: "Moved down", current });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
