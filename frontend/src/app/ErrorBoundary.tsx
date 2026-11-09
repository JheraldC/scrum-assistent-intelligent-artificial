import { Component, type ErrorInfo, type ReactNode } from 'react';
import { es } from '../i18n/es';
import { ErrorBanner } from '../components/ui/ErrorBanner';

interface State {
  failed: boolean;
}

/** Captura errores de renderizado para no dejar la pantalla en blanco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error de renderizado', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return <ErrorBanner message={es.errors.boundary} onRetry={() => this.setState({ failed: false })} />;
    }
    return this.props.children;
  }
}
