import { Request } from "express";
import { Reader, CityResponse, open } from "maxmind";
import { GEOLITE2_DB_PATH } from "../../utils/enviromentVariablesCheck.util";

export interface SearchOrigin {
  lat: number;
  lng: number;
  source: "gps" | "ip";
}

let readerPromise: Promise<Reader<CityResponse> | null> | null = null;

// Opened once and cached, not per request. Returns null (rather than
// throwing) when GEOLITE2_DB_PATH is unset or the file cannot be read, so
// a missing database degrades to "no IP fallback" instead of breaking
// every search request.
function getReader(): Promise<Reader<CityResponse> | null> {
  if (!readerPromise) {
    readerPromise = GEOLITE2_DB_PATH
      ? open<CityResponse>(GEOLITE2_DB_PATH).catch((err) => {
          console.error({
            event: "geolite2_db_open_failed",
            path: GEOLITE2_DB_PATH,
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        })
      : Promise.resolve(null);
  }
  return readerPromise;
}

function parseGpsQueryParams(req: Request): SearchOrigin | null {
  // SearchTutorsQuerySchema already coerces these to numbers via
  // z.coerce.number() and the validate middleware replaces req.query with
  // the parsed result before this ever runs, but Number(...) handles
  // either a number or a raw string safely either way.
  const rawLat = req.query.lat as unknown;
  const rawLng = req.query.lng as unknown;
  if (rawLat === undefined || rawLng === undefined) return null;

  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng, source: "gps" };
}

async function lookupByIp(ip: string | undefined): Promise<SearchOrigin | null> {
  if (!ip) return null;

  const reader = await getReader();
  if (!reader) return null;

  const result = reader.get(ip);
  const lat = result?.location?.latitude;
  const lng = result?.location?.longitude;
  if (lat === undefined || lng === undefined) return null;

  return { lat, lng, source: "ip" };
}

/**
 * Resolves where a home-tutor search should be geo-anchored from, in
 * priority order: GPS coordinates the client sent (lat/lng query params),
 * then a self-hosted MaxMind GeoLite2 IP lookup, then null. Never throws,
 * a search with no resolvable origin just skips geo sort/filter entirely
 * rather than failing, see searchTutors() in tutorSearch.service.ts.
 */
export async function resolveSearchOrigin(req: Request): Promise<SearchOrigin | null> {
  const gpsOrigin = parseGpsQueryParams(req);
  if (gpsOrigin) return gpsOrigin;

  return lookupByIp(req.ip);
}
