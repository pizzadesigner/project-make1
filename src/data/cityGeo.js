// The one place a committed city geometry path is written down (D6).
//
// Per-city geometry for the L1 overview. The key is the project slug (from
// projects.csv `city`), which need not match the file basenames — e.g. the
// koeln slug's files are named "cologne". Omit a layer a city has no file for;
// cities absent here draw nothing.
//
// This lives apart from load.js so `scripts/cities-build.mjs` can import it
// under plain Node: load.js pulls in `?url` imports and `import.meta.env`, both
// of which only exist inside Vite. The build script writing to a path the app
// does not read is exactly how the `.geojson` rename went unnoticed, so the
// script derives its output paths from here rather than composing its own.

export const CITY_GEO = {
  koeln: {
    outline: 'geo/cities/cities_cologne.geojson',
    districts: 'geo/districts/districts_cologne.json',
    infrastructure: 'geo/infrastructure/infrastructure_cologne.geojson',
  },
  'paris-marne-la-vallee': {
    outline: 'geo/cities/paris-marne-la-vallee.geojson',
    districts: 'geo/districts/districts_paris.json',
    infrastructure: 'geo/infrastructure/infrastructure_paris.geojson',
  },
  lisboa: {
    outline: 'geo/cities/cities_lisbon.geojson',
    districts: 'geo/districts/districts_lisbon.json',
    // no infrastructure file yet
  },
  'helsinki-region': {
    outline: 'geo/cities/cities_helsinki.geojson',
    districts: 'geo/districts/districts_helsinki.json',
    // no infrastructure file yet
  },
};
