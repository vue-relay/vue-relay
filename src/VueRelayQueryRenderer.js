import Vue from 'vue'
import VueRelayQueryFetcher from './VueRelayQueryFetcher'
import { VUE_RELAY_PROPS } from './buildVueRelayContainer'

import areEqual from 'fbjs/lib/areEqual'

import {
  createOperationDescriptor,
  deepFreeze,
  getRequest
} from 'relay-runtime'

const requestCache = {}

const NETWORK_ONLY = 'NETWORK_ONLY'
const STORE_THEN_NETWORK = 'STORE_THEN_NETWORK'
const DataFromEnum = {
  NETWORK_ONLY,
  STORE_THEN_NETWORK
}

const VueRelayQueryRenderer = {
  name: 'relay-query-renderer',
  props: {
    cacheConfig: {
      type: Object
    },
    dataFrom: {
      type: String,
      validator (val) {
        return Object.values(DataFromEnum).indexOf(val) !== -1
      }
    },
    environment: {
      type: Object,
      required: true
    },
    query: {},
    variables: {
      type: Object,
      default: () => ({})
    }
  },
  data () {
    // Callbacks are attached to the current instance and shared with static
    // lifecyles by bundling with state. This is okay to do because the
    // callbacks don't change in reaction to props. However we should not
    // "leak" them before mounting (since we would be unable to clean up). For
    // that reason, we define them as null initially and fill them in after
    // mounting to avoid leaking memory.
    const retryCallbacks = {
      handleDataChange: null,
      handleRetryAfterError: null
    }

    let queryFetcher
    let requestCacheKey
    if (this.query) {
      const { query } = this

      const request = getRequest(query)
      requestCacheKey = getRequestCacheKey(request.params, this.variables)
      queryFetcher = requestCache[requestCacheKey]
        ? requestCache[requestCacheKey].queryFetcher
        : new VueRelayQueryFetcher()
    } else {
      queryFetcher = new VueRelayQueryFetcher()
    }

    this.state = {
      prevPropsEnvironment: this.environment,
      prevPropsVariables: this.variables,
      prevQuery: this.query,
      queryFetcher,
      retryCallbacks,
      ...fetchQueryAndComputeStateFromProps(
        this.$props,
        queryFetcher,
        retryCallbacks,
        requestCacheKey
      )
    }

    return {}
  },
  methods: {
    applyDerivedStateFromProps () {
      this.setState(this.getDerivedStateFromProps(this.$props, this.state))
    },
    setState (partialState) {
      if (typeof partialState === 'function') {
        partialState = partialState({ ...this.state })
      }
      if (partialState != null) {
        const nextState = {
          ...this.state,
          ...partialState
        }

        const forceUpdate = this.shouldComponentUpdate(this.$props, nextState)

        this.state = nextState

        if (forceUpdate) {
          this.$forceUpdate()
        }
      }
    },
    getDerivedStateFromProps (nextProps, prevState) {
      if (
        prevState.prevQuery !== nextProps.query ||
        prevState.prevPropsEnvironment !== nextProps.environment ||
        !areEqual(prevState.prevPropsVariables, nextProps.variables)
      ) {
        const { query } = nextProps
        const prevSelectionReferences = prevState.queryFetcher.getSelectionReferences()
        prevState.queryFetcher.disposeRequest()

        let queryFetcher
        if (query) {
          const request = getRequest(query)
          const requestCacheKey = getRequestCacheKey(
            request.params,
            nextProps.variables
          )
          queryFetcher = requestCache[requestCacheKey]
            ? requestCache[requestCacheKey].queryFetcher
            : new VueRelayQueryFetcher(prevSelectionReferences)
        } else {
          queryFetcher = new VueRelayQueryFetcher(prevSelectionReferences)
        }
        return {
          prevQuery: nextProps.query,
          prevPropsEnvironment: nextProps.environment,
          prevPropsVariables: nextProps.variables,
          queryFetcher: queryFetcher,
          ...fetchQueryAndComputeStateFromProps(
            nextProps,
            queryFetcher,
            prevState.retryCallbacks
            // passing no requestCacheKey will cause it to be recalculated internally
            // and we want the updated requestCacheKey, since variables may have changed
          )
        }
      }

      return null
    },
    shouldComponentUpdate (_, nextState) {
      return (
        nextState.renderProps !== this.state.renderProps
      )
    }
  },
  watch: {
    environment: 'applyDerivedStateFromProps',
    query: 'applyDerivedStateFromProps',
    variables: {
      handler: 'applyDerivedStateFromProps',
      deep: true
    }
  },
  render (h) {
    const { renderProps, relayContext } = this.state
    // Note that the root fragment results in `renderProps.props` is already
    // frozen by the store; this call is to freeze the renderProps object and
    // error property if set.
    if (process.env.NODE_ENV !== 'production') {
      deepFreeze(renderProps)
    }

    this[VUE_RELAY_PROPS].__relayContext = Object.freeze({
      ...relayContext
    })

    return h('keep-alive', {
      props: {
        include: []
      }
    }, this.$scopedSlots.default(renderProps))
  },
  mounted () {
    const { retryCallbacks, queryFetcher, requestCacheKey } = this.state
    if (requestCacheKey) {
      delete requestCache[requestCacheKey]
    }

    retryCallbacks.handleDataChange = (params) => {
      const error = params.error == null ? null : params.error
      const snapshot = params.snapshot == null ? null : params.snapshot

      this.setState(prevState => {
        const { requestCacheKey: prevRequestCacheKey } = prevState
        if (prevRequestCacheKey) {
          delete requestCache[prevRequestCacheKey]
        }

        // Don't update state if nothing has changed.
        if (snapshot === prevState.snapshot && error === prevState.error) {
          return null
        }
        return {
          renderProps: getRenderProps(
            error,
            snapshot,
            prevState.queryFetcher,
            prevState.retryCallbacks
          ),
          snapshot,
          requestCacheKey: null
        }
      })
    }

    retryCallbacks.handleRetryAfterError = (_) =>
      this.setState(prevState => {
        const { requestCacheKey: prevRequestCacheKey } = prevState
        if (prevRequestCacheKey) {
          delete requestCache[prevRequestCacheKey]
        }

        return {
          renderProps: getLoadingRenderProps(),
          requestCacheKey: null
        }
      })

    // Re-initialize the VueRelayQueryFetcher with callbacks.
    // If data has changed since constructions, this will re-render.
    if (this.$props.query) {
      queryFetcher.setOnDataChange(retryCallbacks.handleDataChange)
    }
  },
  updated () {
    // We don't need to cache the request after the component commits
    const { requestCacheKey } = this.state
    if (requestCacheKey) {
      delete requestCache[requestCacheKey]
      // HACK
      delete this.state.requestCacheKey
    }
  },
  beforeDestroy () {
    this.state.queryFetcher.dispose()
  },
  provide () {
    return {
      [VUE_RELAY_PROPS]: (this[VUE_RELAY_PROPS] = Vue.observable({
        __relayContext: Object.freeze({
          ...this.state.relayContext
        })
      }))
    }
  }
}

function getContext (
  environment,
  variables
) {
  return {
    environment,
    variables
  }
}
function getLoadingRenderProps () {
  return {
    error: null,
    props: null, // `props: null` indicates that the data is being fetched (i.e. loading)
    retry: null
  }
}

function getEmptyRenderProps () {
  return {
    error: null,
    props: {}, // `props: {}` indicates no data available
    retry: null
  }
}

function getRenderProps (
  error,
  snapshot,
  queryFetcher,
  retryCallbacks
) {
  return {
    error: error || null,
    props: snapshot ? snapshot.data : null,
    retry: () => {
      const syncSnapshot = queryFetcher.retry()
      if (
        syncSnapshot &&
        typeof retryCallbacks.handleDataChange === 'function'
      ) {
        retryCallbacks.handleDataChange({ snapshot: syncSnapshot })
      } else if (
        error &&
        typeof retryCallbacks.handleRetryAfterError === 'function'
      ) {
        // If retrying after an error and no synchronous result available,
        // reset the render props
        retryCallbacks.handleRetryAfterError(error)
      }
    }
  }
}

function getRequestCacheKey (
  request,
  variables
) {
  const requestID = request.id || request.text
  return JSON.stringify({
    id: String(requestID),
    variables
  })
}

function fetchQueryAndComputeStateFromProps (
  props,
  queryFetcher,
  retryCallbacks,
  requestCacheKey
) {
  const { environment, query, variables } = props
  const genericEnvironment = (environment)
  if (query) {
    const request = getRequest(query)
    const operation = createOperationDescriptor(request, variables)
    const relayContext = getContext(genericEnvironment, operation.variables)
    if (typeof requestCacheKey === 'string' && requestCache[requestCacheKey]) {
      // This same request is already in flight.

      const { snapshot } = requestCache[requestCacheKey]
      if (snapshot) {
        // Use the cached response
        return {
          error: null,
          relayContext,
          renderProps: getRenderProps(
            null,
            snapshot,
            queryFetcher,
            retryCallbacks
          ),
          snapshot,
          requestCacheKey
        }
      } else {
        // Render loading state
        return {
          error: null,
          relayContext,
          renderProps: getLoadingRenderProps(),
          snapshot: null,
          requestCacheKey
        }
      }
    }

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

      // cache the request to avoid duplicate requests
      requestCacheKey =
        requestCacheKey || getRequestCacheKey(request.params, props.variables)
      requestCache[requestCacheKey] = { queryFetcher, snapshot }

      if (!snapshot) {
        return {
          error: null,
          relayContext,
          renderProps: getLoadingRenderProps(),
          snapshot: null,
          requestCacheKey
        }
      }

      return {
        error: null,
        relayContext,

        renderProps: getRenderProps(
          null,
          snapshot,
          queryFetcher,
          retryCallbacks
        ),
        snapshot,
        requestCacheKey
      }
    } catch (error) {
      return {
        error,
        relayContext,
        renderProps: getRenderProps(error, null, queryFetcher, retryCallbacks),
        snapshot: null,
        requestCacheKey
      }
    }
  } else {
    queryFetcher.dispose()
    const relayContext = getContext(genericEnvironment, variables)
    return {
      error: null,
      relayContext,
      renderProps: getEmptyRenderProps(),
      requestCacheKey: null // if there is an error, don't cache request
    }
  }
}

export default VueRelayQueryRenderer
