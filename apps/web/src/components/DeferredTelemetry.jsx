import { Component, lazy, Suspense, useEffect, useState } from "react";
import { scheduleAfterCriticalIdle } from "../lib/nonCriticalScheduler";

// Post-critical Vercel Analytics + Speed Insights. Dynamic import keeps both
// packages off the initial application graph. Import, network, or render
// failure must never affect portfolio UI (boundary returns null).

const LazyTelemetry = lazy(() =>
  Promise.all([
    import("@vercel/analytics/react"),
    import("@vercel/speed-insights/react"),
  ]).then(([analytics, speed]) => ({
    default: function TelemetryMount() {
      const Analytics = analytics.Analytics;
      const SpeedInsights = speed.SpeedInsights;
      return (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      );
    },
  })),
);

class TelemetryErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export function DeferredTelemetry() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return scheduleAfterCriticalIdle(() => {
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  return (
    <TelemetryErrorBoundary>
      <Suspense fallback={null}>
        <LazyTelemetry />
      </Suspense>
    </TelemetryErrorBoundary>
  );
}
