import QueryRenderer from './VueRelayQueryRenderer'
import { createRefetchContainer } from './VueRelayRefetchContainer'
import { createPaginationContainer } from './VueRelayPaginationContainer'
import { createFragmentContainer } from './VueRelayFragmentContainer'

const {
  MutationTypes,
  RangeOperations,
  commitLocalUpdate,
  commitMutation,
  fetchQuery,
  graphql,
  requestSubscription
} = require('relay-runtime')

export default {
  QueryRenderer,

  MutationTypes,
  RangeOperations,

  commitLocalUpdate,
  commitMutation,
  createRefetchContainer,
  createPaginationContainer,
  createFragmentContainer,
  fetchQuery,
  graphql,
  requestSubscription
}

export {
  QueryRenderer,

  MutationTypes,
  RangeOperations,

  commitLocalUpdate,
  commitMutation,
  createRefetchContainer,
  createPaginationContainer,
  createFragmentContainer,
  fetchQuery,
  graphql,
  requestSubscription
}
