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
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
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

  useEffect(() => {
    const query = destinationQuery.trim();

    if (query.length < 2) {
      setDestinationSuggestions([]);
      setDestinationStatus('idle');
      return undefined;
    }

    const controller = new AbortController();
    const searchDelay = window.setTimeout(async () => {
      setDestinationStatus('loading');

      const searchParams = new URLSearchParams({
        q: query,
        lat: '43.0731',
        lon: '-89.4036',
        limit: '5',
      });

      try {
        const response = await fetch(
          `https://photon.komoot.io/api/?${searchParams.toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error('Destination suggestions failed.');
        }

        const data = await response.json();
        const suggestions = data.features
          .filter((feature) => {
            const { city, county, state } = feature.properties;
            return (
              city === 'Madison' ||
              county === 'Dane' ||
              state === 'WI' ||
              state === 'Wisconsin'
            );
          })
          .slice(0, 5);

        setDestinationSuggestions(suggestions);
        setDestinationStatus(suggestions.length > 0 ? 'idle' : 'error');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setDestinationSuggestions([]);
          setDestinationStatus('error');
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(searchDelay);
    };
  }, [destinationQuery]);

  const getSuggestionLabel = (suggestion) => {
    const { name, housenumber, street, city, state } = suggestion.properties;
    const address = [housenumber, street].filter(Boolean).join(' ');
    const area = [city, state].filter(Boolean).join(', ');

    return [name, address, area].filter(Boolean).join(' · ');
  };

  const pinDestination = (suggestion) => {
    if (!mapRef.current) {
      return;
    }

    const destinationPosition = suggestion.geometry.coordinates;

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

    const label = getSuggestionLabel(suggestion);
    setDestinationQuery(suggestion.properties.name ?? label);
    setDestinationSuggestions([]);
    setDestinationStatus('success');
    setLocationMessage(`Destination pinned: ${label}`);
  };

  const handleDestinationSearch = async (event) => {
    event.preventDefault();

    if (destinationSuggestions.length > 0) {
      pinDestination(destinationSuggestions[0]);
      return;
    }

    if (!destinationQuery.trim()) {
      setDestinationStatus('error');
      setLocationMessage('Enter a destination to search near Madison.');
      return;
    }

    setDestinationStatus('error');
    setLocationMessage('Choose one of the suggested Madison destinations.');
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
            {destinationSuggestions.length > 0 && (
              <div className="suggestions-list">
                {destinationSuggestions.map((suggestion) => (
                  <button
                    className="suggestion-option"
                    key={`${suggestion.properties.osm_type}-${suggestion.properties.osm_id}`}
                    type="button"
                    onClick={() => pinDestination(suggestion)}
                  >
                    {getSuggestionLabel(suggestion)}
                  </button>
                ))}
              </div>
            )}
          </form>
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
          <p className="sheet-label">Current area</p>
          <h2 id="parking-sheet-title">UW-Madison / downtown</h2>
          <p
            className={`sheet-copy status-${
              destinationStatus === 'error' ? 'error' : locationStatus
            }`}
          >
            {locationMessage}
          </p>
        </aside>
      </section>
    </main>
  );
}

export default App;
