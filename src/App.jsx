import { useEffect, useRef } from 'react';
import { Map, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

const MADISON_CENTER = [-89.4036, 43.0731];
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

setWorkerUrl(workerUrl);

function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) {
      return;
    }

    mapRef.current = new Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: MADISON_CENTER,
      zoom: 13.2,
    });

    mapRef.current.addControl(
      new NavigationControl({ showCompass: false }),
      'bottom-right',
    );

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="map-panel" aria-label="Madison parking map">
        <div ref={mapContainerRef} className="map-canvas" />

        <header className="map-header" aria-labelledby="app-title">
          <p className="eyebrow">Madison, Wisconsin</p>
          <h1 id="app-title">Park Madison</h1>
        </header>
      </section>
    </main>
  );
}

export default App;
