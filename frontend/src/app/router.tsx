import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './Layout';
import { RequireAuth } from './RequireAuth';
import { EmptyState } from '../components/ui/EmptyState';
import { es } from '../i18n/es';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { BacklogItemPage } from '../pages/backlog/BacklogItemPage';
import { BacklogPage } from '../pages/backlog/BacklogPage';
import { FlowPage } from '../pages/flow/FlowPage';
import { HistoryPage } from '../pages/history/HistoryPage';
import { MembersPage } from '../pages/projects/MembersPage';
import { ProjectFormPage } from '../pages/projects/ProjectFormPage';
import { ProjectLayout } from '../pages/projects/ProjectLayout';
import { RetrospectivePage } from '../pages/sprint/RetrospectivePage';
import { PlanningPage } from '../pages/sprint/PlanningPage';
import { ProjectsPage } from '../pages/projects/ProjectsPage';
import { ValidationsPage } from '../pages/validations/ValidationsPage';

// Las pantallas de cada historia se registran aquí (rutas de plan.md, "Diseño de interfaces").
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Navigate to="/proyectos" replace /> },
      { path: '/entrar', element: <LoginPage /> },
      { path: '/registro', element: <RegisterPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/proyectos', element: <ProjectsPage /> },
          { path: '/proyectos/nuevo', element: <ProjectFormPage /> },
          {
            path: '/proyectos/:projectId',
            element: <ProjectLayout />,
            children: [
              { index: true, element: <FlowPage /> },
              { path: 'backlog', element: <BacklogPage /> },
              { path: 'backlog/nuevo', element: <BacklogItemPage /> },
              { path: 'backlog/:itemId', element: <BacklogItemPage /> },
              { path: 'sprint/planificacion', element: <PlanningPage /> },
              { path: 'sprint/retrospectiva', element: <RetrospectivePage /> },
              { path: 'validaciones', element: <ValidationsPage /> },
              { path: 'participantes', element: <MembersPage /> },
              { path: 'historial', element: <HistoryPage /> },
              { path: 'ajustes', element: <ProjectFormPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <EmptyState title={es.errors.notFound} /> },
    ],
  },
]);
