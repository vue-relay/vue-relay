import QueryRenderer from './VueRelayQueryRenderer'
import { createFragmentContainer } from './VueRelayFragmentContainer'
import { createPaginationContainer } from './VueRelayPaginationContainer'
import { createRefetchContainer } from './VueRelayRefetchContainer'

import {
  MutationTypes,
  RangeOperations,
  applyOptimisticMutation,
  commitLocalUpdate,
  commitMutation,
  fetchQuery,
  graphql,
  requestSubscription
} from 'relay-runtime'

export default {
  QueryRenderer,

  MutationTypes,
  RangeOperations,

  applyOptimisticMutation,
  commitLocalUpdate,
  commitMutation,
  createFragmentContainer,
  createPaginationContainer,
  createRefetchContainer,
  fetchQuery,
  graphql,
  requestSubscription
}

export {
  QueryRenderer,

  MutationTypes,
  RangeOperations,

  applyOptimisticMutation,
  commitLocalUpdate,
  commitMutation,
  createFragmentContainer,
  createPaginationContainer,
  createRefetchContainer,
  fetchQuery,
  graphql,
  requestSubscription
}
