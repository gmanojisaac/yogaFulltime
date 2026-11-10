import { Component, StrictMode } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { contentDiagnostics } from "./content";
import App from "./App";
import "./styles.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <main className="diagnostic">
        <h1>Your learning space needs attention</h1>
        <p>
          The application encountered an error. Your existing saved progress has
          not been reset.
        </p>
        <pre>{this.state.error}</pre>
        <button onClick={() => location.reload()}>Reload the app</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const errors = contentDiagnostics();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {errors.length ? (
        <main className="diagnostic">
          <h1>Lesson content could not be loaded</h1>
          <p>
            Please restore the supplied Yoga10 kit and run npm run
            validate:content.
          </p>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </main>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
