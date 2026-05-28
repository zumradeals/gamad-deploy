// AdminBillingController — facturation globale cross-tenant (Phase 3, superadmin).
// Lectures directes sans withTenantTx — INV-06 respecté via AdminGuard (rôle lu en base).
// payment_transactions est INSERT-only (INV-04) — lecture seule ici.

import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, count, sql, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  paymentTransactions,
  organizations,
} from '@gamad/schema';
import { DB_TOKEN } from '../adapters/pipeline-repository.adapter';
import { AdminGuard } from './admin.guard';

@Controller('admin/billing')
@UseGuards(AdminGuard)
export class AdminBillingController {
  constructor(@Inject(DB_TOKEN) private readonly db: NodePgDatabase) {}

  /**
   * GET /admin/billing — liste paginée des transactions cross-tenant.
   * Filtres : status, orgId.
   * Inclut un résumé global : totalRevenue, thisMonth, successCount, failedCount.
   */
  @Get()
  async listBilling(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('status') status?: string,
    @Query('orgId') orgId?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '20', 10) || 20));
    const offset = (page - 1) * limit;

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Construction dynamique des conditions WHERE pour la liste paginée
    const listConditions = [];

    if (status && ['pending', 'success', 'failed'].includes(status)) {
      listConditions.push(
        eq(paymentTransactions.status, status as 'pending' | 'success' | 'failed'),
      );
    }
    if (orgId) {
      listConditions.push(eq(paymentTransactions.orgId, orgId));
    }

    const listWhere = listConditions.length > 0 ? and(...listConditions) : undefined;

    // Comptage total pour la pagination
    const [totalRow] = await this.db
      .select({ total: count() })
      .from(paymentTransactions)
      .where(listWhere);

    // Données paginées
    const rows = await this.db
      .select({
        id: paymentTransactions.id,
        orgId: paymentTransactions.orgId,
        orgName: organizations.name,
        type: paymentTransactions.type,
        amount: paymentTransactions.amount,
        currency: paymentTransactions.currency,
        status: paymentTransactions.status,
        provider: paymentTransactions.provider,
        reference: paymentTransactions.reference,
        createdAt: paymentTransactions.createdAt,
      })
      .from(paymentTransactions)
      .innerJoin(organizations, eq(paymentTransactions.orgId, organizations.id))
      .where(listWhere)
      .orderBy(sql`${paymentTransactions.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    // Résumé global (sans filtre status/orgId — vue d'ensemble plateforme)
    const [totalRevenueRow] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.status, 'success'));

    const [thisMonthRow] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${paymentTransactions.amount}), 0)` })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.status, 'success'),
          sql`${paymentTransactions.createdAt} >= ${firstOfMonth}`,
        ),
      );

    const [successCountRow] = await this.db
      .select({ total: count() })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.status, 'success'));

    const [failedCountRow] = await this.db
      .select({ total: count() })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.status, 'failed'));

    return {
      data: rows,
      total: Number(totalRow?.total ?? 0),
      page,
      limit,
      summary: {
        totalRevenue: Number(totalRevenueRow?.total ?? 0),
        thisMonth: Number(thisMonthRow?.total ?? 0),
        successCount: Number(successCountRow?.total ?? 0),
        failedCount: Number(failedCountRow?.total ?? 0),
      },
    };
  }
}
