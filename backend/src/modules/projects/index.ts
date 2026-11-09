export { projectsRoutes } from './routes.js';
// El gancho de autorización por proyecto vive en platform/access.ts; se reexporta como interfaz del módulo.
export { requireProjectRole } from '../../platform/access.js';
