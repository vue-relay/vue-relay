/**
 * Determine if the object is a plain object that matches the `Variables` type.
 */
function isRelayVariables (variables) {
  return (
    typeof variables === 'object' &&
    variables !== null &&
    !Array.isArray(variables)
  )
}

export default isRelayVariables
