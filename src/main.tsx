import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import L from 'leaflet';
import App from './App.tsx';
import './index.css';

// Global Leaflet LatLng protection to prevent any (NaN, NaN) uncaught exceptions
if (typeof window !== 'undefined') {
  // Prevent any unhandled Leaflet NaN LatLng errors from bubbling as uncaught crashes
  window.addEventListener('error', (e) => {
    if (e?.message && typeof e.message === 'string' && e.message.includes('Invalid LatLng object')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });

  if (L) {
    const sanitizeCoord = (v: any, fallback: number): number => {
      return typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v) ? v : fallback;
    };

    const sanitizeLatLng = (input: any): [number, number] => {
      if (!input) return [6.308, 99.845];
      if (Array.isArray(input)) {
        return [sanitizeCoord(input[0], 6.308), sanitizeCoord(input[1], 99.845)];
      }
      if (typeof input === 'object') {
        const lat = input.lat ?? input.latitude;
        const lng = input.lng ?? input.lon ?? input.longitude;
        return [sanitizeCoord(lat, 6.308), sanitizeCoord(lng, 99.845)];
      }
      return [6.308, 99.845];
    };

    const sanitizePoint = (pt: any): { x: number; y: number } => {
      if (!pt || typeof pt !== 'object') return { x: 0, y: 0 };
      const x = typeof pt.x === 'number' && Number.isFinite(pt.x) ? pt.x : 0;
      const y = typeof pt.y === 'number' && Number.isFinite(pt.y) ? pt.y : 0;
      return { x, y };
    };

    if ((L as any).LatLng) {
      const OriginalLatLng = (L as any).LatLng;
      (L as any).LatLng = function (lat: any, lng: any, alt?: any) {
        const safeLat = sanitizeCoord(lat, 6.308);
        const safeLng = sanitizeCoord(lng, 99.845);
        return new OriginalLatLng(safeLat, safeLng, alt);
      };
      (L as any).LatLng.prototype = OriginalLatLng.prototype;
    }

    if (typeof (L as any).latLng === 'function') {
      const originalFactory = (L as any).latLng;
      (L as any).latLng = function (...args: any[]) {
        try {
          if (args.length === 0 || args[0] === null || args[0] === undefined) {
            return new (L as any).LatLng(6.308, 99.845);
          }
          if (Array.isArray(args[0])) {
            const lat = sanitizeCoord(args[0][0], 6.308);
            const lng = sanitizeCoord(args[0][1], 99.845);
            return new (L as any).LatLng(lat, lng);
          }
          if (typeof args[0] === 'object' && args[0] !== null) {
            const rawLat = args[0].lat ?? args[0].latitude;
            const rawLng = args[0].lng ?? args[0].lon ?? args[0].longitude;
            const lat = sanitizeCoord(rawLat, 6.308);
            const lng = sanitizeCoord(rawLng, 99.845);
            return new (L as any).LatLng(lat, lng);
          }
          if (typeof args[0] === 'number') {
            const lat = sanitizeCoord(args[0], 6.308);
            const lng = sanitizeCoord(args[1], 99.845);
            return new (L as any).LatLng(lat, lng, args[2]);
          }
          return originalFactory.apply(L, args);
        } catch {
          return new (L as any).LatLng(6.308, 99.845);
        }
      };
    }

    // Intercept Projections
    if ((L as any).Projection) {
      if ((L as any).Projection.SphericalMercator) {
        const origUnproject = (L as any).Projection.SphericalMercator.unproject;
        (L as any).Projection.SphericalMercator.unproject = function (point: any) {
          try {
            const safePt = sanitizePoint(point);
            return origUnproject.call(this, safePt);
          } catch {
            return new (L as any).LatLng(6.308, 99.845);
          }
        };
      }
      if ((L as any).Projection.LonLat) {
        const origUnproject = (L as any).Projection.LonLat.unproject;
        (L as any).Projection.LonLat.unproject = function (point: any) {
          try {
            const safePt = sanitizePoint(point);
            return origUnproject.call(this, safePt);
          } catch {
            return new (L as any).LatLng(6.308, 99.845);
          }
        };
      }
    }

    // Intercept CRS
    if ((L as any).CRS && (L as any).CRS.EPSG3857) {
      const origPointToLatLng = (L as any).CRS.EPSG3857.pointToLatLng;
      (L as any).CRS.EPSG3857.pointToLatLng = function (point: any, zoom: any) {
        try {
          const safePt = sanitizePoint(point);
          const safeZoom = typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : 12;
          return origPointToLatLng.call(this, safePt, safeZoom);
        } catch {
          return new (L as any).LatLng(6.308, 99.845);
        }
      };
    }

    // Intercept Map prototype methods
    if ((L as any).Map && (L as any).Map.prototype) {
      const originalPanTo = (L as any).Map.prototype.panTo;
      (L as any).Map.prototype.panTo = function (latlng: any, options: any) {
        const [lat, lng] = sanitizeLatLng(latlng);
        try {
          return originalPanTo.call(this, [lat, lng], options);
        } catch {
          return this;
        }
      };

      const originalFlyTo = (L as any).Map.prototype.flyTo;
      (L as any).Map.prototype.flyTo = function (latlng: any, zoom: any, options: any) {
        const [lat, lng] = sanitizeLatLng(latlng);
        const safeZoom = typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : 12;
        try {
          return originalFlyTo.call(this, [lat, lng], safeZoom, options);
        } catch {
          return this;
        }
      };

      const originalSetView = (L as any).Map.prototype.setView;
      (L as any).Map.prototype.setView = function (center: any, zoom: any, options: any) {
        const [lat, lng] = sanitizeLatLng(center);
        const safeZoom = typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : 12;
        try {
          return originalSetView.call(this, [lat, lng], safeZoom, options);
        } catch {
          return this;
        }
      };

      const origUnproject = (L as any).Map.prototype.unproject;
      (L as any).Map.prototype.unproject = function (point: any, zoom: any) {
        try {
          const safePt = sanitizePoint(point);
          const safeZoom = typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : this._zoom || 12;
          return origUnproject.call(this, safePt, safeZoom);
        } catch {
          return new (L as any).LatLng(6.308, 99.845);
        }
      };

      const origContainerPointToLatLng = (L as any).Map.prototype.containerPointToLatLng;
      (L as any).Map.prototype.containerPointToLatLng = function (point: any) {
        try {
          const safePt = sanitizePoint(point);
          return origContainerPointToLatLng.call(this, safePt);
        } catch {
          return new (L as any).LatLng(6.308, 99.845);
        }
      };

      const origLayerPointToLatLng = (L as any).Map.prototype.layerPointToLatLng;
      (L as any).Map.prototype.layerPointToLatLng = function (point: any) {
        try {
          const safePt = sanitizePoint(point);
          return origLayerPointToLatLng.call(this, safePt);
        } catch {
          return new (L as any).LatLng(6.308, 99.845);
        }
      };
    }

    // Intercept Marker, Circle, Polyline
    if ((L as any).Marker && (L as any).Marker.prototype) {
      const originalMarkerSetLatLng = (L as any).Marker.prototype.setLatLng;
      (L as any).Marker.prototype.setLatLng = function (latlng: any) {
        const [lat, lng] = sanitizeLatLng(latlng);
        try {
          return originalMarkerSetLatLng.call(this, [lat, lng]);
        } catch {
          return this;
        }
      };
    }

    if ((L as any).Circle && (L as any).Circle.prototype) {
      const origCircleSetLatLng = (L as any).Circle.prototype.setLatLng;
      (L as any).Circle.prototype.setLatLng = function (latlng: any) {
        const [lat, lng] = sanitizeLatLng(latlng);
        try {
          return origCircleSetLatLng.call(this, [lat, lng]);
        } catch {
          return this;
        }
      };
    }

    const origMarkerFactory = (L as any).marker;
    if (typeof origMarkerFactory === 'function') {
      (L as any).marker = function (latlng: any, options: any) {
        const [lat, lng] = sanitizeLatLng(latlng);
        return origMarkerFactory.call(L, [lat, lng], options);
      };
    }

    const origCircleFactory = (L as any).circle;
    if (typeof origCircleFactory === 'function') {
      (L as any).circle = function (latlng: any, options: any) {
        const [lat, lng] = sanitizeLatLng(latlng);
        return origCircleFactory.call(L, [lat, lng], options);
      };
    }

    const origPolylineFactory = (L as any).polyline;
    if (typeof origPolylineFactory === 'function') {
      (L as any).polyline = function (latlngs: any, options: any) {
        try {
          if (Array.isArray(latlngs)) {
            const cleanLatLngs = latlngs
              .map((pt) => sanitizeLatLng(pt))
              .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
            return origPolylineFactory.call(L, cleanLatLngs.length > 0 ? cleanLatLngs : [[6.308, 99.845]], options);
          }
        } catch {
          // fallback
        }
        return origPolylineFactory.call(L, [[6.308, 99.845]], options);
      };
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
