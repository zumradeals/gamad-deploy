// AdminModule — dashboard superadmin (Phase 1 + Phase 2 + Phase 3).
// Enregistre tous les controllers admin et fournit les dépendances nécessaires.

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminOrgsController } from './admin-orgs.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminTemplatesController } from './admin-templates.controller';
import { AdminDeploymentsController } from './admin-deployments.controller';
import { AdminServersController } from './admin-servers.controller';
import { AdminBillingController } from './admin-billing.controller';
import { AdminAuditController } from './admin-audit.controller';
import { AdminGuard } from './admin.guard';
import { AuthorizationHelper } from '../persistence/authorization';

@Module({
  controllers: [
    AdminController,
    AdminUsersController,
    AdminOrgsController,
    AdminPlansController,
    AdminTemplatesController,
    AdminDeploymentsController,
    AdminServersController,
    AdminBillingController,
    AdminAuditController,
  ],
  providers: [AdminGuard, AuthorizationHelper],
  exports: [AuthorizationHelper],
})
export class AdminModule {}
