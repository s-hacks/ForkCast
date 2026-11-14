/** Shared request schemas (client + server). Server parsing is authoritative. */
import { z } from "zod";

// Strict positive integer: rejects "60.5", "abc", 0, -1 (FR-28).
export const positiveInt = z.number({ error: "Enter a whole number" }).int("Enter a whole number").positive("Must be at least 1").max(100000);

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Required").max(64),
  password: z.string().min(1, "Required").max(256),
  portal: z.enum(["user", "admin"]),
});

export const contextSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SOLO") }),
  z.object({ type: z.literal("ORGANIZATION"), organizationId: z.string().uuid() }),
]);

export const preparedSchema = z.object({ servings: positiveInt });

export const unitEnum = z.enum(["g", "kg", "oz", "lb", "ml", "l", "each"]);

export const grocerySchema = z.object({
  lines: z
    .array(z.object({ ingredientId: z.string().uuid(), quantity: z.number().positive("Must be > 0").max(1_000_000), unit: unitEnum }))
    .min(1, "Select at least one ingredient")
    .max(50),
});

export const pantrySchema = z.object({ confirm: z.literal(true) });

export const modifySchema = z.object({ servings: positiveInt });

const ingredient = z.object({ pantryItemId: z.string().uuid(), quantity: z.number().positive().max(1_000_000), unit: unitEnum });

export const planBase = z.object({
  dishName: z.string().trim().min(1, "Required").max(120),
  servingsTarget: positiveInt,
  recipeYield: positiveInt,
  serviceCapacity: z.number().int().min(1).max(50),
  ingredients: z.array(ingredient).max(40),
});

export const createPlanSchema = planBase.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.enum(["BREAKFAST", "LUNCH", "DINNER"]),
  publish: z.boolean(),
});

export const updatePlanSchema = planBase.extend({ version: z.number().int(), acknowledgeConflicts: z.boolean().optional() });

export const createItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  unitKind: z.enum(["MASS", "VOLUME", "COUNT"]),
  displayUnit: unitEnum,
  initialQuantity: z.number().min(0).max(1_000_000).optional(),
});

export const adjustSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.enum(["RECEIPT", "ADJUSTMENT"]), quantity: z.number().refine((n) => n !== 0, "Must not be 0"), unit: unitEnum, reason: z.string().trim().min(1, "Required").max(200), acknowledgeConflicts: z.boolean().optional() }),
  z.object({ mode: z.literal("CORRECTION"), countedQuantity: z.number().min(0), unit: unitEnum, reason: z.string().trim().min(1, "Required").max(200), acknowledgeConflicts: z.boolean().optional() }),
]);

export const receiveSchema = z.object({ receivedQuantity: z.number().min(0), unit: unitEnum });
