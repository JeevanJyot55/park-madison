import { useEffect, useRef, useState } from 'react';
import { Map, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

const MADISON_CENTER = [-89.4036, 43.0731];
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

setWorkerUrl(workerUrl);

function App() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationStatus, setDestinationStatus] = useState('idle');
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationMessage, setLocationMessage] = useState(
    'Nearby parking options will appear here once we add the first data source.',
  );

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
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const handleDestinationSearch = async (event) => {
    event.preventDefault();

    const query = destinationQuery.trim();

    if (!query) {
      setDestinationStatus('error');
      setLocationMessage('Enter a destination to search near Madison.');
      return;
    }

    setDestinationStatus('loading');
    setLocationMessage(`Searching for "${query}"...`);

    const searchParams = new URLSearchParams({
      q: `${query}, Madison, WI`,
      format: 'jsonv2',
      limit: '1',
      addressdetails: '1',
      viewbox: '-89.533,43.017,-89.305,43.145',
      bounded: '1',
    });

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`,
      );

      if (!response.ok) {
        throw new Error('Destination search failed.');
      }

      const [result] = await response.json();

      if (!result || !mapRef.current) {
        setDestinationStatus('error');
        setLocationMessage('No Madison destination found for that search.');
        return;
      }

      const destinationPosition = [
        Number.parseFloat(result.lon),
        Number.parseFloat(result.lat),
      ];

      if (!destinationMarkerRef.current) {
        const markerElement = document.createElement('div');
        markerElement.className = 'destination-marker';
        destinationMarkerRef.current = new Marker({ element: markerElement });
      }

      destinationMarkerRef.current
        .setLngLat(destinationPosition)
        .addTo(mapRef.current);

      mapRef.current.flyTo({
        center: destinationPosition,
        zoom: 15,
        essential: true,
      });

      setDestinationStatus('success');
      setLocationMessage(`Destination pinned: ${result.display_name}`);
    } catch {
      setDestinationStatus('error');
      setLocationMessage('Destination search is unavailable right now.');
    }
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationMessage('Current location is not available in this browser.');
      return;
    }

    setLocationStatus('loading');
    setLocationMessage('Finding your current location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPosition = [
          position.coords.longitude,
          position.coords.latitude,
        ];

        if (!mapRef.current) {
          return;
        }

        if (!userMarkerRef.current) {
          const markerElement = document.createElement('div');
          markerElement.className = 'user-location-marker';
          userMarkerRef.current = new Marker({ element: markerElement });
        }

        userMarkerRef.current.setLngLat(userPosition).addTo(mapRef.current);
        mapRef.current.flyTo({
          center: userPosition,
          zoom: 15,
          essential: true,
        });

        setLocationStatus('success');
        setLocationMessage('Current location found. Parking options will use this later.');
      },
      () => {
        setLocationStatus('error');
        setLocationMessage('Location permission was denied or unavailable.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 10000,
      },
    );
  };

  return (
    <main className="app-shell">
      <section className="map-panel" aria-label="Madison parking map">
        <div ref={mapContainerRef} className="map-canvas" />

        <header className="map-header" aria-labelledby="app-title">
          <p className="eyebrow">Madison, Wisconsin</p>
          <h1 id="app-title">Park Madison</h1>
        </header>

        <button
          className="locate-button"
          type="button"
          onClick={handleLocateUser}
          disabled={locationStatus === 'loading'}
        >
          {locationStatus === 'loading' ? 'Locating...' : 'Locate me'}
        </button>

        <aside className="parking-sheet" aria-labelledby="parking-sheet-title">
          <div className="sheet-handle" aria-hidden="true" />
          <form className="destination-form" onSubmit={handleDestinationSearch}>
            <label className="destination-field" htmlFor="destination-search">
              <span className="sheet-label">Where are you going?</span>
              <span className="destination-row">
                <input
                  id="destination-search"
                  type="search"
                  placeholder="Search destination"
                  autoComplete="off"
                  value={destinationQuery}
                  onChange={(event) => setDestinationQuery(event.target.value)}
                />
                <button
                  className="destination-submit"
                  type="submit"
                  disabled={destinationStatus === 'loading'}
                >
                  {destinationStatus === 'loading' ? '...' : 'Search'}
                </button>
              </span>
            </label>
          </form>
          <div className="sheet-section">
            <p className="sheet-label">Current area</p>
            <h2 id="parking-sheet-title">UW-Madison / downtown</h2>
          </div>
          <p className={`sheet-copy status-${locationStatus}`}>
            {locationMessage}
          </p>
        </aside>
      </section>
    </main>
  );
}

export default App;
