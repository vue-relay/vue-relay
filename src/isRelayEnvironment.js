/**
 * Determine if a given value is an object that implements the `Environment`
 * interface defined in `RelayEnvironmentTypes`.
 */
function isRelayEnvironment (environment) {
  return (
    typeof environment === 'object' &&
    environment !== null &&
    // TODO: add applyMutation/sendMutation once ready in both cores
    typeof environment.check === 'function' &&
    typeof environment.lookup === 'function' &&
    typeof environment.retain === 'function' &&
    typeof environment.sendQuery === 'function' &&
    typeof environment.execute === 'function' &&
    typeof environment.subscribe === 'function'
  )
}

export default isRelayEnvironment
