// AdminModule — dashboard superadmin (Phase 1 + Phase 2).
// Enregistre tous les controllers admin et fournit les dépendances nécessaires.

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminOrgsController } from './admin-orgs.controller';
import { AdminPlansController } from './admin-plans.controller';
import { AdminTemplatesController } from './admin-templates.controller';
import { AdminGuard } from './admin.guard';
import { AuthorizationHelper } from '../persistence/authorization';

@Module({
  controllers: [
    AdminController,
    AdminUsersController,
    AdminOrgsController,
    AdminPlansController,
    AdminTemplatesController,
  ],
  providers: [AdminGuard, AuthorizationHelper],
  exports: [AuthorizationHelper],
})
export class AdminModule {}
