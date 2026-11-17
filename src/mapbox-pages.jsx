// MAP PAGE: community report map (route: #/map). The map view itself is in mapbox-map.jsx.
import { useState } from "react";
import MapView from "./mapbox-map.jsx";
import { Empty, IssueCard, LoadError, useIssues } from "./shared-components.jsx";

export function MapPage() {
  const { issues, error, reload } = useIssues("newest");
  const [sel, setSel] = useState(null);
  const shown = issues?.find((i) => i.id === sel);
  return (
    <main className="wrap page">
      <div className="page-head">
        <div>
          <h1 className="h1-sm">Neighbourhood map</h1>
          <p className="muted">Explore local reports by location. Pins show approximate areas, and the shaded glow shows where reports cluster.</p>
        </div>
      </div>
      {error && <LoadError message={error} retry={reload} />}
      <div className="map-page">
        <section className="map-visual" aria-label="Community reports map">
          {issues && <p className="map-count">{issues.length} {issues.length === 1 ? "report" : "reports"} on the map</p>}
          <div className="map-frame tall map-report-frame">
            {issues && <MapView issues={issues} selectedId={sel} onSelect={setSel} />}
            {shown && <div className="map-selection-preview" aria-label="Selected report"><IssueCard issue={shown} /></div>}
          </div>
        </section>
        <aside className="map-side" aria-live="polite">
          {issues?.length === 0 ? (
            <Empty title="No reports yet">Be the first to add a local report. <a href="#/new">Post an issue</a></Empty>
          ) : shown ? (
            <>
              <IssueCard issue={shown} />
              <p className="muted small">Public pins use approximate locations to protect privacy.</p>
            </>
          ) : (
            <Empty title="Select a report">Choose a pin to read the report and open its discussion.</Empty>
          )}
        </aside>
      </div>
    </main>
  );
}
