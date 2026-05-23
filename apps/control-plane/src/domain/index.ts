// Couche Domain — logique métier pure, testable hors-ligne (P-02+)
// N'importe QUE packages/contracts. Zéro I/O, zéro dépendance vers delivery/, adapters/, persistence/.

export { PdnValidationError, validatePdn } from './pdn/pdn-validator';
export { SourceResolverService } from './source-resolver/source-resolver.service';
export { TemplateCompilerService } from './source-resolver/template-compiler.service';
export { IllegalTransitionError, StateMachineService } from './state-machine/state-machine.service';
export { ContractGeneratorService } from './contract-generator/contract-generator.service';
