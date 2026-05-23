// Requis pour @Injectable() / @Inject() dans les tests Vitest (esbuild ne génère pas
// emitDecoratorMetadata — reflect-metadata doit être importé avant tout decorator).
import 'reflect-metadata';
