// models/ProductCatalog.ts
import { Schema, model, Types, Document } from 'mongoose';
import { ICategoryMac } from './CategoryMac';

export interface IProductAttributeValue {
  attribute: Types.ObjectId;
  value: string;
  displayValue?: string;
}

export interface IProductCatalog extends Document {
  name: string;
  description?: string;
  image?: string;
  category: Types.ObjectId | ICategoryMac;

  attributes?: IProductAttributeValue[];
  sellingUnits?: string[];
  usageType: 'grocery' | 'restaurant' | 'retail';
}

const ProductAttributeValueSchema = new Schema<IProductAttributeValue>({
  attribute: { type: Schema.Types.ObjectId, ref: 'Attribute', required: true },
  value: { type: String, required: true },
  displayValue: { type: String },
});

const ProductCatalogSchema = new Schema<IProductCatalog>({
  name: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  category: { type: Schema.Types.ObjectId, ref: 'CategoryMac', required: true },
    sellingUnits: [String], 
  attributes: [ProductAttributeValueSchema],
  usageType: { type: String, enum: ['grocery', 'restaurant', 'retail'], required: true },
});

export default model<IProductCatalog>('ProductCatalog', ProductCatalogSchema);
