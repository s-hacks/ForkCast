-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MealPeriod" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('MASS', 'VOLUME', 'COUNT');

-- CreateEnum
CREATE TYPE "ContextType" AS ENUM ('SOLO', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "CommitmentType" AS ENUM ('PREPARED_FOOD', 'GROCERY', 'PANTRY', 'SERVING');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GroceryLineStatus" AS ENUM ('PROMISED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "AllocationSource" AS ENUM ('USE_PANTRY', 'PLAN_AUTO', 'GROCERY_RECEIPT');

-- CreateEnum
CREATE TYPE "InventoryTxnType" AS ENUM ('INITIAL', 'RECEIPT', 'CORRECTION', 'ADJUSTMENT', 'GROCERY_RECEIPT', 'CONSUMPTION', 'RESERVE', 'RELEASE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contextType" "ContextType",
    "organizationId" UUID,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("userId","organizationId")
);

-- CreateTable
CREATE TABLE "MealSlot" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "period" "MealPeriod" NOT NULL,

    CONSTRAINT "MealSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "dishName" TEXT NOT NULL,
    "servingsTarget" INTEGER NOT NULL,
    "recipeYield" INTEGER NOT NULL,
    "serviceCapacity" INTEGER NOT NULL DEFAULT 1,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanIngredient" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "pantryItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "inputUnit" TEXT NOT NULL,
    "removedAt" TIMESTAMPTZ,

    CONSTRAINT "PlanIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryItem" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unitKind" "UnitKind" NOT NULL,
    "displayUnit" TEXT NOT NULL,
    "onHandQty" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" UUID NOT NULL,
    "pantryItemId" UUID NOT NULL,
    "type" "InventoryTxnType" NOT NULL,
    "deltaOnHand" INTEGER NOT NULL,
    "deltaReserved" INTEGER NOT NULL,
    "onHandAfter" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" UUID,
    "planId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryAllocation" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "planIngredientId" UUID NOT NULL,
    "pantryItemId" UUID NOT NULL,
    "commitmentId" UUID,
    "createdById" UUID,
    "quantity" INTEGER NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "AllocationSource" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PantryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "contextType" "ContextType" NOT NULL,
    "organizationId" UUID,
    "type" "CommitmentType" NOT NULL,
    "status" "CommitmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "servings" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "cancelledAt" TIMESTAMPTZ,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryLine" (
    "id" UUID NOT NULL,
    "commitmentId" UUID NOT NULL,
    "planIngredientId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "GroceryLineStatus" NOT NULL DEFAULT 'PROMISED',
    "receivedQty" INTEGER,
    "receivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("userId","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_key_createdAt_idx" ON "LoginAttempt"("key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MealSlot_date_period_key" ON "MealSlot"("date", "period");

-- CreateIndex
CREATE INDEX "MealPlan_slotId_idx" ON "MealPlan"("slotId");

-- CreateIndex
CREATE INDEX "PlanIngredient_planId_idx" ON "PlanIngredient"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PantryItem_name_key" ON "PantryItem"("name");

-- CreateIndex
CREATE INDEX "InventoryTransaction_pantryItemId_createdAt_idx" ON "InventoryTransaction"("pantryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "PantryAllocation_pantryItemId_status_idx" ON "PantryAllocation"("pantryItemId", "status");

-- CreateIndex
CREATE INDEX "PantryAllocation_planId_status_idx" ON "PantryAllocation"("planId", "status");

-- CreateIndex
CREATE INDEX "Commitment_planId_status_idx" ON "Commitment"("planId", "status");

-- CreateIndex
CREATE INDEX "Commitment_userId_status_idx" ON "Commitment"("userId", "status");

-- CreateIndex
CREATE INDEX "Commitment_organizationId_status_idx" ON "Commitment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "GroceryLine_planIngredientId_status_idx" ON "GroceryLine"("planIngredientId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "MealSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanIngredient" ADD CONSTRAINT "PlanIngredient_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanIngredient" ADD CONSTRAINT "PlanIngredient_pantryItemId_fkey" FOREIGN KEY ("pantryItemId") REFERENCES "PantryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_pantryItemId_fkey" FOREIGN KEY ("pantryItemId") REFERENCES "PantryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryAllocation" ADD CONSTRAINT "PantryAllocation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryAllocation" ADD CONSTRAINT "PantryAllocation_planIngredientId_fkey" FOREIGN KEY ("planIngredientId") REFERENCES "PlanIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryAllocation" ADD CONSTRAINT "PantryAllocation_pantryItemId_fkey" FOREIGN KEY ("pantryItemId") REFERENCES "PantryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryAllocation" ADD CONSTRAINT "PantryAllocation_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "Commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryLine" ADD CONSTRAINT "GroceryLine_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "Commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryLine" ADD CONSTRAINT "GroceryLine_planIngredientId_fkey" FOREIGN KEY ("planIngredientId") REFERENCES "PlanIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Hand-written integrity constraints (docs/database-design.md) =====
ALTER TABLE "PantryItem" ADD CONSTRAINT pantry_qty_check
  CHECK ("onHandQty" >= 0 AND "reservedQty" >= 0 AND "reservedQty" <= "onHandQty");
ALTER TABLE "MealPlan" ADD CONSTRAINT plan_positive_check
  CHECK ("servingsTarget" > 0 AND "recipeYield" > 0 AND "serviceCapacity" >= 1);
CREATE UNIQUE INDEX plan_one_active_per_slot ON "MealPlan" ("slotId") WHERE status <> 'CANCELLED';
ALTER TABLE "PlanIngredient" ADD CONSTRAINT plan_ingredient_qty_check CHECK ("quantity" > 0);
CREATE UNIQUE INDEX plan_ingredient_unique_live ON "PlanIngredient" ("planId", "pantryItemId") WHERE "removedAt" IS NULL;
ALTER TABLE "Commitment" ADD CONSTRAINT commitment_context_check CHECK (
  ("contextType" = 'SOLO' AND "organizationId" IS NULL) OR
  ("contextType" = 'ORGANIZATION' AND "organizationId" IS NOT NULL));
ALTER TABLE "Commitment" ADD CONSTRAINT commitment_servings_check CHECK (
  (("type" = 'PREPARED_FOOD') = ("servings" IS NOT NULL)) AND ("servings" IS NULL OR "servings" > 0));
CREATE UNIQUE INDEX commitment_one_active ON "Commitment" ("planId", "userId", "type") WHERE status = 'ACTIVE';
ALTER TABLE "GroceryLine" ADD CONSTRAINT grocery_qty_check CHECK ("quantity" > 0 AND ("receivedQty" IS NULL OR "receivedQty" >= 0));
ALTER TABLE "PantryAllocation" ADD CONSTRAINT allocation_qty_check CHECK ("quantity" > 0);
