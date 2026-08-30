import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { I18nProvider } from "./i18n/I18nContext";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element is missing");

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>
);
