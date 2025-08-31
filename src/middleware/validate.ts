// middleware/validate.ts
import type { ZodError, ZodSchema, ZodTypeAny } from 'zod';
import { RequestHandler } from 'express';

type Schemas = {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
};
export const validate2 = (schema: ZodTypeAny): RequestHandler => (req,res,next) => {
  const r = schema.safeParse({ body:req.body, query:req.query, params:req.params });
  if (!r.success) {
    const errors = r.error.issues.map(i => ({ path: i.path.join("."), message: i.message }));
     res.status(400).json({ message: "Invalid request", errors });
     return;
  }
  next();
};
export const validate = (schemas: Schemas): RequestHandler => {
  return (req, res, next) => {
    try {
      if (schemas.body)   req.body   = schemas.body.parse(req.body);
      if (schemas.query)  req.query  = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      const ze = err as ZodError;
      if (ze?.issues) {
        res.status(400).json({
          message: 'Validation error',
          errors: ze.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
        });
        return;
      }
      next(err);
    }
  };
};
