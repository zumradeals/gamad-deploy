// AdminModule — dashboard superadmin (Phase 1).
// Enregistre AdminController et fournit les dépendances nécessaires.
// AuthorizationHelper est partagé via injection directe (pas de module séparé
// pour éviter de créer un couplage inutile).

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AuthorizationHelper } from '../persistence/authorization';

@Module({
  controllers: [AdminController],
  providers: [AdminGuard, AuthorizationHelper],
  exports: [AuthorizationHelper],
})
export class AdminModule {}
