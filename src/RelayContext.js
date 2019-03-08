import isRelayEnvironment from './isRelayEnvironment'
import isRelayVariables from './isRelayVariables'

import invariant from 'fbjs/lib/invariant'

/**
 * Asserts that the input is a matches the `RelayContext` type defined in
 * `RelayEnvironmentTypes` and returns it as that type.
 */
function assertRelayContext (relay) {
  invariant(
    isRelayContext(relay),
    'RelayContext: Expected `context.relay` to be an object conforming to ' +
      'the `RelayContext` interface, got `%s`.',
    relay
  )
  return relay
}

/**
 * Determine if the input is a plain object that matches the `RelayContext`
 * type defined in `RelayEnvironmentTypes`.
 */
function isRelayContext (context) {
  return (
    typeof context === 'object' &&
    context !== null &&
    !Array.isArray(context) &&
    isRelayEnvironment(context.environment) &&
    isRelayVariables(context.variables)
  )
}

export {
  assertRelayContext,
  isRelayContext
}
