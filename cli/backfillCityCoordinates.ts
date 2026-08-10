import "dotenv/config";
import prisma from "../src/config/database.config";

// One-time backfill for City.latitude/longitude via OpenStreetMap's
// Nominatim search, no API key, no billing account, genuinely free. Only
// touches rows that do not have coordinates yet, so it is safe to re-run
// after adding new cities.
//
// Nominatim's usage policy caps this at 1 request/second and requires an
// identifying User-Agent, both of which are respected below. That is
// fine for a one-time run over a few dozen cities, it would not be fine
// to call this per search request, which is why City coordinates are
// geocoded once here and reused as a centroid, not looked up live.
// https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "mentora-api-city-backfill/1.0 (one-time script, see cli/backfillCityCoordinates.ts)";
const REQUEST_DELAY_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    console.warn(`Nominatim request failed for "${query}": HTTP ${res.status}`);
    return null;
  }

  const results = (await res.json()) as { lat: string; lon: string }[];
  if (!results[0]) {
    console.warn(`No geocoding result for "${query}"`);
    return null;
  }

  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}

async function main() {
  const cities = await prisma.city.findMany({
    where: { latitude: null, longitude: null },
    include: { region: { select: { name: true, countryCode: true } } },
  });

  console.log(`Found ${cities.length} cities without coordinates`);

  let updated = 0;
  let failed = 0;

  for (const city of cities) {
    const country = city.region.countryCode === "CM" ? "Cameroon" : city.region.countryCode;
    const query = `${city.name}, ${city.region.name}, ${country}`;

    const coords = await geocode(query);
    if (!coords) {
      failed++;
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    await prisma.city.update({
      where: { id: city.id },
      data: { latitude: coords.lat, longitude: coords.lng },
    });

    console.log(`Geocoded ${city.name}: ${coords.lat}, ${coords.lng}`);
    updated++;
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`Done. Updated ${updated}, failed ${failed}, total ${cities.length}`);
}

main()
  .catch((err) => {
    console.error("City coordinate backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
