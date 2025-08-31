// src/routes/deliveryMarketplaceV1/deliveryOrderRoutes.ts

import express, {  Request, Response } from "express";
import * as controller from "../../controllers/delivry_Marketplace_V1/DeliveryOrderController";
import { verifyAdmin } from "../../middleware/verifyAdmin";
import { verifyFirebase } from "../../middleware/verifyFirebase";
import Order from "../../models/delivry_Marketplace_V1/Order";
import { authVendor } from "../../middleware/authVendor";
import { driverDeliver, driverPickUp } from "../../controllers/delivry_Marketplace_V1/orderDriver";
import { getDeliveryFee } from "../../controllers/delivry_Marketplace_V1/DeliveryCartController";
import { rateOrder } from "../../controllers/delivry_Marketplace_V1/orderRating";
import Vendor from "../../models/vendor_app/Vendor";
import MerchantProduct from "../../models/mckathi/MerchantProduct";
import DeliveryProduct from "../../models/delivry_Marketplace_V1/DeliveryProduct";

const router = express.Router();



/**
 * @swagger
 * tags:
 *   - name: DeliveryOrders
 *     description: إدارة طلبات سوق التوصيل V1
 */

/**
 * @swagger
 * /delivery/orders:
 *   post:
 *     summary: Create a new delivery order
 *     description: Create a new order in the delivery marketplace. Validates addressId and optional location fields.
 *     tags: [DeliveryOrders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Order payload including addressId and optional city/coordinates.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               addressId:
 *                 type: string
 *                 format: mongoId
 *                 example: "60d21b4667d0d8992e610c85"
 *                 description: ID of the delivery address
 *               city:
 *                 type: string
 *                 example: "Riyadh"
 *                 description: City name (optional, for backward compatibility)
 *               latitude:
 *                 type: number
 *                 example: 24.7136
 *                 description: Latitude coordinate (optional)
 *               longitude:
 *                 type: number
 *                 example: 46.6753
 *                 description: Longitude coordinate (optional)
 *             required:
 *               - addressId
 *     responses:
 *       201:
 *         description: The order was created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation errors or missing/invalid fields.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                         example: "Invalid addressId"
 *                       param:
 *                         type: string
 *                         example: "addressId"
 *                       location:
 *                         type: string
 *                         example: "body"
 *       401:
 *         description: Missing or invalid bearer token.
 *       500:
 *         description: Server error while creating order.
 */
router.post(
  "/",
 verifyFirebase,
  controller.createOrder
);

/**
 * @swagger
 * /delivery/orders/vendor/orders:
 *   get:
 *     summary: Retrieve orders for a vendor
 *     description: Fetch all orders containing subOrders assigned to the authenticated vendor. Vendor role required.
 *     tags: [DeliveryOrders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of orders for the vendor.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         description: Missing or invalid bearer token.
 *       403:
 *         description: Vendor role required.
 *       500:
 *         description: Server error while fetching vendor orders.
 */
router.delete("/orders/:id", verifyFirebase, controller.cancelOrder);
router.put(
  ":id/vendor-accept",
  authVendor,
  controller.vendorAcceptOrder
);
router.post("/:id/rate", verifyFirebase, rateOrder);
router.get('/export/orders/excel', controller.exportOrdersToExcel);
router.get("/me", verifyFirebase, controller.getUserOrders);

router.patch("/:id/driver-pickup", driverPickUp);
router.patch("/:id/admin-status",verifyFirebase,verifyAdmin, controller.adminChangeStatus);
router.patch("/:id/driver-deliver", driverDeliver);
router.get(
  "/vendor/orders",authVendor,

  async (req: Request, res: Response) => {
    try {
      // 1. جلب التاجر الحالي من خلال التوكن
      const vendor = await Vendor.findById(req.user.id).lean();
      if (!vendor) {
         res.status(404).json({ message: "التاجر غير موجود" });
         return;
      }

      // 2. جلب معرف المتجر الخاص بالتاجر
      const storeId = vendor.store;
      if (!storeId) {
         res.status(404).json({ message: "لا يوجد متجر مرتبط بهذا التاجر" });
         return;
      }

      // 3. جلب جميع الطلبات التي تحتوي على subOrder خاص بمتجر هذا التاجر
const orders = await Order.find({
  "subOrders.store": storeId
})
.populate("subOrders.store", "name logo address")
.lean();
const allMerchantProductIds = [];
const allDeliveryProductIds = [];

for (const order of orders) {
  for (const sub of order.subOrders) {
    for (const item of sub.items) {
      if (item.productType === "merchantProduct")
        allMerchantProductIds.push(item.product);
      if (item.productType === "deliveryProduct")
        allDeliveryProductIds.push(item.product);
    }
  }
}
const merchantProducts = await MerchantProduct.find({ _id: { $in: allMerchantProductIds } })
  .select("price customImage product") // أضف product
  .populate({ path: "product", select: "name" }) // جلب الاسم من ProductCatalog
  .lean();
const deliveryProducts = await DeliveryProduct.find({ _id: { $in: allDeliveryProductIds } })
  .select("name price image")
  .lean();

// عمل index للنتائج:
const merchantProductMap = Object.fromEntries(
  merchantProducts.map(p => [
    p._id.toString(),
    {
      ...p,
      name: (typeof p.product === "object" && p.product && "name" in p.product)
        ? p.product.name
        : undefined
    }
  ])
);
const deliveryProductMap = Object.fromEntries(deliveryProducts.map(p => [p._id.toString(), p]));
for (const order of orders) {
  for (const sub of order.subOrders) {
    for (const item of sub.items) {
      if (item.productType === "merchantProduct") {
(item as any).details = merchantProductMap[item.product.toString()] || null;
      }
      if (item.productType === "deliveryProduct") {
      (item as any).details = deliveryProductMap[item.product.toString()] || null;
      }
    }
  }
}


      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "خطأ بالخادم" });
    }
  }
);


router.get("/fee", getDeliveryFee);

/**
 * @swagger
 * /delivery/orders/user/{userId}:
 *   get:
 *     summary: Retrieve orders by user ID
 *     description: Fetch all orders placed by a specific user.
 *     tags: [DeliveryOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: mongoId
 *         description: User ID whose orders are to be retrieved.
 *     responses:
 *       200:
 *         description: List of orders for the specified user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid userId.
 *       401:
 *         description: Missing or invalid bearer token.
 *       404:
 *         description: No orders found for the user.
 *       500:
 *         description: Server error while fetching user orders.
 */
router.get("/user/:userId", controller.getUserOrders);
router.post("/:id/repeat", controller.repeatOrder);

/**
 * @swagger
 * /delivery/orders/{id}:
 *   get:
 *     summary: Retrieve order by ID
 *     description: Fetch a single order by its ID.
 *     tags: [DeliveryOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: mongoId
 *         description: Order ID to retrieve.
 *     responses:
 *       200:
 *         description: Order details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid order ID.
 *       401:
 *         description: Missing or invalid bearer token.
 *       404:
 *         description: Order not found.
 *       500:
 *         description: Server error while fetching order.
 */
router.get("/:id", controller.getOrderById);

/**
 * @swagger
 * /delivery/orders:
 *   get:
 *     summary: Retrieve all orders (Admin)
 *     description: Fetch all orders in the system. Admin role required.
 *     tags: [DeliveryOrders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all orders.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         description: Missing or invalid bearer token.
 *       403:
 *         description: Admin role required.
 *       500:
 *         description: Server error while fetching orders.
 */
router.get("/", verifyFirebase, verifyAdmin, controller.getAllOrders);


// تعيين/تغيير سائق (طلب كامل)
router.patch("/:id/assign-driver", verifyFirebase, verifyAdmin, controller.assignDriver);

// تعيين/تغيير سائق (SubOrder)
router.patch("/:orderId/sub-orders/:subId/assign-driver", verifyFirebase, verifyAdmin, controller.assignDriverToSubOrder);

// تغيير حالة SubOrder
router.patch("/:orderId/sub-orders/:subId/status", verifyFirebase, verifyAdmin, controller.updateSubOrderStatus);

// POD للطلب الكامل
router.patch("/:id/pod", verifyFirebase, verifyAdmin, controller.setOrderPOD);

// POD للـ SubOrder
router.patch("/:orderId/sub-orders/:subId/pod", verifyFirebase, verifyAdmin, controller.setSubOrderPOD);

// ملاحظات
router.post("/:id/notes", verifyFirebase, verifyAdmin, controller.addOrderNote);
router.get("/:id/notes", verifyFirebase, verifyAdmin, controller.getOrderNotes);

/**
 * @swagger
 * /delivery/orders/{id}:
 *   put:
 *     summary: Update order status by ID
 *     description: Allows Admin or assigned Driver to update the status of an order.
 *     tags: [DeliveryOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: mongoId
 *         description: Order ID to update.
 *     requestBody:
 *       description: New status for the order.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, accepted, in_progress, completed, cancelled]
 *                 example: "in_progress"
 *                 description: New status value.
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Order status updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid order ID or status value.
 *       401:
 *         description: Missing or invalid bearer token.
 *       403:
 *         description: Admin or Driver role required.
 *       404:
 *         description: Order not found.
 *       500:
 *         description: Server error while updating order.
 */
router.put(
  ':id/status',
  verifyFirebase,
  controller.updateOrderStatus
);

export default router;
