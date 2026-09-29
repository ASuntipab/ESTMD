/**
 * Loads a local .env when dotenv is available (development). On the server the
 * release has no dev dependencies and the values come from the service
 * environment instead, so a missing dotenv is not an error.
 */
try {
  require('dotenv').config({ quiet: true })
} catch {
  // dotenv is a dev dependency; ignore when it is absent.
}
