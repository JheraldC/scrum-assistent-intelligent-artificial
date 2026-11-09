import type { Role } from '@scrum/shared';

export interface AuthUser {
  id: string;
  email: string;
  pseudonym: string;
}

export interface ProjectMembership {
  projectId: string;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Persona autenticada (la rellena `requireAuth`). */
    user?: AuthUser;
    /** Membresía en el proyecto de la ruta (la rellena `requireProjectRole`). */
    membership?: ProjectMembership;
  }
}
