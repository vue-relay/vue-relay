import invariant from 'fbjs/lib/invariant'

/**
 * Fail fast if the user supplies invalid fragments as input.
 */
function assertFragmentMap (
  componentName,
  fragmentSpec
) {
  invariant(
    fragmentSpec && typeof fragmentSpec === 'object',
    'Could not create Relay Container for `%s`. ' +
      'Expected a set of GraphQL fragments, got `%s` instead.',
    componentName,
    fragmentSpec
  )

  for (const key in fragmentSpec) {
    if (fragmentSpec.hasOwnProperty(key)) {
      const fragment = fragmentSpec[key]
      invariant(
        fragment &&
          (typeof fragment === 'object' || typeof fragment === 'function'),
        'Could not create Relay Container for `%s`. ' +
          'The value of fragment `%s` was expected to be a fragment, got `%s` instead.',
        componentName,
        key,
        fragment
      )
    }
  }
}

export default assertFragmentMap
