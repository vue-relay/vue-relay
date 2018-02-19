const isRelayEnvironment = function (environment) {
  return (
    typeof environment === 'object' &&
    environment !== null &&
    typeof environment.applyMutation === 'function' &&
    typeof environment.check === 'function' &&
    typeof environment.check === 'function' &&
    typeof environment.lookup === 'function' &&
    typeof environment.retain === 'function' &&
    typeof environment.sendMutation === 'function' &&
    typeof environment.sendQuery === 'function' &&
    typeof environment.execute === 'function' &&
    typeof environment.subscribe === 'function'
  )
}

const isRelayVariables = function (variables) {
  return (
    typeof variables === 'object' &&
    variables !== null &&
    !Array.isArray(variables)
  )
}

const isRelayContext = function (context) {
  return (
    typeof context === 'object' &&
    context !== null &&
    !Array.isArray(context) &&
    isRelayEnvironment(context.environment) &&
    isRelayVariables(context.variables)
  )
}

export default isRelayContext
