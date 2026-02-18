// Sentry Configuration for Error Monitoring
import * as Sentry from "@sentry/browser";
import { BrowserTracing } from "@sentry/tracing";

const sentryConfig = {
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  integrations: [
    new BrowserTracing({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      ),
    }),
  ],
  
  // Performance monitoring
  tracesSampleRate: import.meta.env.VITE_ENVIRONMENT === 'production' ? 0.1 : 1.0,
  
  // Release tracking
  release: import.meta.env.VITE_APP_VERSION || '1.0.0',
  
  // User context
  beforeSend(event, hint) {
    // Filter out non-critical errors in production
    if (import.meta.env.VITE_ENVIRONMENT === 'production') {
      const error = hint.originalException;
      
      // Ignore common non-critical errors
      if (error && error.message) {
        const ignoredMessages = [
          'Non-Error promise rejection captured',
          'ResizeObserver loop limit exceeded',
          'Network request failed',
        ];
        
        if (ignoredMessages.some(msg => error.message.includes(msg))) {
          return null;
        }
      }
    }
    
    return event;
  },

  // Privacy settings
  beforeBreadcrumb(breadcrumb, hint) {
    // Remove sensitive data from breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.data) {
      delete breadcrumb.data.password;
      delete breadcrumb.data.token;
    }
    return breadcrumb;
  },
};

// Initialize Sentry only if DSN is provided and not in dev mode
if (sentryConfig.dsn && import.meta.env.VITE_ENABLE_CRASH_REPORTING === 'true') {
  Sentry.init(sentryConfig);
}

export { Sentry };

// Custom error boundary component
export const ErrorBoundary = Sentry.withErrorBoundary(({ children }) => children, {
  fallback: ({ error, resetError }) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong</h2>
        <p className="text-gray-600 mb-4">
          We've been notified about this error and we'll fix it soon.
        </p>
        <button
          onClick={resetError}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  ),
  beforeCapture: (scope) => {
    scope.setTag('errorBoundary', true);
  },
});