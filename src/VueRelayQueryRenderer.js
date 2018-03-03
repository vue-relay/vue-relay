import VueRelayQueryFetcher from './VueRelayQueryFetcher'

const areEqual = require('fbjs/lib/areEqual')

const NETWORK_ONLY = 'NETWORK_ONLY'
const STORE_THEN_NETWORK = 'STORE_THEN_NETWORK'
// eslint-disable-next-line no-unused-vars
const DataFromEnum = {
  NETWORK_ONLY,
  STORE_THEN_NETWORK
}

const getLoadingRenderProps = function () {
  return {
    error: null,
    props: null, // `props: null` indicates that the data is being fetched (i.e. loading)
    retry: null
  }
}

const getEmptyRenderProps = function (_) {
  return {
    error: null,
    props: {}, // `props: {}` indicates no data available
    retry: null
  }
}

const getRenderProps = function (error, snapshot, queryFetcher, retryCallbacks) {
  return {
    error: error,
    props: snapshot ? snapshot.data : null,
    retry: () => {
      const syncSnapshot = queryFetcher.retry()
      if (syncSnapshot) {
        retryCallbacks.handleDataChange({ snapshot: syncSnapshot })
      } else if (error) {
        // If retrying after an error and no synchronous result available,
        // reset the render props
        retryCallbacks.handleRetryAfterError(error)
      }
    }
  }
}

const fetchQueryAndComputeStateFromProps = function (props, queryFetcher, retryCallbacks) {
  const { environment, query, variables } = props

  if (query) {
    const genericEnvironment = environment

    const {
      createOperationSelector,
      getRequest
    } = genericEnvironment.unstable_internal
    const request = getRequest(query)
    const operation = createOperationSelector(request, variables)

    try {
      const storeSnapshot =
        props.dataFrom === STORE_THEN_NETWORK
          ? queryFetcher.lookupInStore(genericEnvironment, operation)
          : null
      const querySnapshot = queryFetcher.fetch({
        cacheConfig: props.cacheConfig,
        dataFrom: props.dataFrom,
        environment: genericEnvironment,
        onDataChange: retryCallbacks.handleDataChange,
        operation
      })
      // Use network data first, since it may be fresher
      const snapshot = querySnapshot || storeSnapshot
      if (!snapshot) {
        return {
          relayContextEnvironment: environment,
          relayContextVariables: operation.variables,
          renderProps: getLoadingRenderProps()
        }
      }

      return {
        relayContextEnvironment: environment,
        relayContextVariables: operation.variables,
        renderProps: getRenderProps(
          null,
          snapshot,
          queryFetcher,
          retryCallbacks
        )
      }
    } catch (error) {
      return {
        relayContextEnvironment: environment,
        relayContextVariables: operation.variables,
        renderProps: getRenderProps(error, null, queryFetcher, retryCallbacks)
      }
    }
  } else {
    queryFetcher.dispose()

    return {
      relayContextEnvironment: environment,
      relayContextVariables: variables,
      renderProps: getEmptyRenderProps()
    }
  }
}

const props = {
  cacheConfig: {},
  dataFrom: {},
  environment: {
    required: true
  },
  query: {},
  variables: {
    type: Object,
    default: () => ({})
  }
}

export default {
  name: 'relay-query-renderer',
  props,
  data () {
    const handleDataChange = ({ error, snapshot }) => {
      this.setState({ renderProps: getRenderProps(error, snapshot, queryFetcher, retryCallbacks) })
    }

    const handleRetryAfterError = (_) => {
      this.setState({ renderProps: getLoadingRenderProps() })
    }

    const retryCallbacks = {
      handleDataChange,
      handleRetryAfterError
    }

    const queryFetcher = new VueRelayQueryFetcher()

    const state = fetchQueryAndComputeStateFromProps(
      this.$props,
      queryFetcher,
      retryCallbacks
    )

    return {
      // React's getChildContext() is dynamically resolved,
      // Vue does not have this feature, instead, we `inject` a static reference.
      // `context` is frozen to prevent reference changes to `context.relay`.
      // `context.relay` itself is not frozen and should be updated accordingly.
      context: Object.freeze({
        relay: {
          environment: state.relayContextEnvironment,
          variables: state.relayContextVariables
        }
      }),
      state: Object.freeze({
        prevPropsEnvironment: this.environment,
        prevPropsVariables: this.variables,
        prevQuery: this.query,
        queryFetcher,
        retryCallbacks,
        ...state
      })
    }
  },
  methods: {
    setState (state) {
      this.state = Object.freeze({
        ...this.state,
        ...state
      })
    }
  },
  watch: Object.assign(...Object.keys(props).map((key) => ({ [key]: function () {
    if (
      this.state.prevQuery !== this.query ||
      this.state.prevPropsEnvironment !== this.environment ||
      !areEqual(this.state.prevPropsVariables, this.variables)
    ) {
      const state = fetchQueryAndComputeStateFromProps(
        this.$props,
        this.state.queryFetcher,
        this.state.retryCallbacks
      )

      // React getDerivedStateFromProps is static method.
      // Vue beforeUpdate is instance method.
      // Thus updaing relayContext here instead of in render.
      this.context.relay.environment = state.relayContextEnvironment
      this.context.relay.variables = state.relayContextVariables

      this.setState({
        prevQuery: this.query,
        prevPropsEnvironment: this.environment,
        prevPropsVariables: this.variables,
        ...state
      })
    }
  } }))),
  render (h) {
    if (process.env.NODE_ENV !== 'production') {
      require('relay-runtime/lib/deepFreeze')(this.state.renderProps)
    }
    return h(this.component)
  },
  created () {
    this.component = {
      name: 'relay-context-provider',
      provide: {
        relay: this.context.relay
      },
      render: (h) => {
        return h('keep-alive', {
          props: {
            include: []
          }
        }, this.$scopedSlots.default(this.state.renderProps))
      }
    }
  },
  beforeDestroy () {
    this.state.queryFetcher.dispose()
  }
}
