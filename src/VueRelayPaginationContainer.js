import VueRelayQueryFetcher from './VueRelayQueryFetcher'
import buildVueRelayContainer from './buildVueRelayContainer'

const areEqual = require('fbjs/lib/areEqual')
const invariant = require('fbjs/lib/invariant')
const warning = require('fbjs/lib/warning')

const {
  ConnectionInterface,
  Observable
} = require('relay-runtime')

const FORWARD = 'forward'

const createGetConnectionFromProps = function (metadata) {
  const path = metadata.path
  invariant(
    path,
    'RelayPaginationContainer: Unable to synthesize a ' +
      'getConnectionFromProps function.'
  )
  return props => {
    let data = props[metadata.fragmentName]
    for (let i = 0; i < path.length; i++) {
      if (!data || typeof data !== 'object') {
        return null
      }
      data = data[path[i]]
    }
    return data
  }
}

const createGetFragmentVariables = function (metadata) {
  const countVariable = metadata.count
  invariant(
    countVariable,
    'RelayPaginationContainer: Unable to synthesize a ' +
      'getFragmentVariables function.'
  )
  return (prevVars, totalCount) => ({
    ...prevVars,
    [countVariable]: totalCount
  })
}

const findConnectionMetadata = function (fragments) {
  let foundConnectionMetadata = null
  let isRelayModern = false
  for (const fragmentName in fragments) {
    const fragment = fragments[fragmentName]
    const connectionMetadata = fragment.metadata && fragment.metadata.connection
    // HACK: metadata is always set to `undefined` in classic. In modern, even
    // if empty, it is set to null (never undefined). We use that knowlege to
    // check if we're dealing with classic or modern
    if (fragment.metadata !== undefined) {
      isRelayModern = true
    }
    if (connectionMetadata) {
      invariant(
        connectionMetadata.length === 1,
        'RelayPaginationContainer: Only a single @connection is ' +
          'supported, `%s` has %s.',
        fragmentName,
        connectionMetadata.length
      )
      invariant(
        !foundConnectionMetadata,
        'RelayPaginationContainer: Only a single fragment with ' +
          '@connection is supported.'
      )
      foundConnectionMetadata = {
        ...connectionMetadata[0],
        fragmentName
      }
    }
  }
  invariant(
    !isRelayModern || foundConnectionMetadata !== null,
    'RelayPaginationContainer: A @connection directive must be present.'
  )
  return foundConnectionMetadata || {}
}

const toObserver = function (observerOrCallback) {
  return typeof observerOrCallback === 'function'
    ? {
      error: observerOrCallback,
      complete: observerOrCallback,
      unsubscribe: subscription => {
        typeof observerOrCallback === 'function' && observerOrCallback()
      }
    }
    : observerOrCallback || {}
}

const createContainerWithFragments = function (fragments, connectionConfig) {
  const relay = this.relay

  const metadata = findConnectionMetadata(fragments)

  const getConnectionFromProps =
    connectionConfig.getConnectionFromProps ||
    createGetConnectionFromProps(metadata)

  const direction = connectionConfig.direction || metadata.direction
  invariant(
    direction,
    'RelayPaginationContainer: Unable to infer direction of the ' +
      'connection, possibly because both first and last are provided.'
  )

  const getFragmentVariables =
    connectionConfig.getFragmentVariables ||
    createGetFragmentVariables(metadata)

  return {
    name: 'relay-pagination-container',
    data () {
      const { createFragmentSpecResolver } = relay.environment.unstable_internal
      const resolver = createFragmentSpecResolver(
        relay,
        this.$options.name,
        fragments,
        this.$props,
        this._handleFragmentDataUpdate
      )

      return {
        // a.k.a this._relayContext in react-relay
        context: Object.freeze({
          relay: {
            environment: relay.environment,
            variables: relay.variables
          }
        }),
        state: Object.freeze({
          data: resolver.resolve(),
          prevProps: this.$props,
          relayEnvironment: relay.environment,
          relayVariables: relay.variables,
          relayProp: this._buildRelayProp(relay),
          isARequestInFlight: false,
          localVariables: null,
          refetchSubscription: null,
          resolver
        })
      }
    },
    methods: {
      setState (state) {
        this.state = Object.freeze({
          ...this.state,
          ...state
        })
      },
      _buildRelayProp (relay) {
        return {
          hasMore: this._hasMore,
          isLoading: this._isLoading,
          loadMore: this._loadMore,
          refetchConnection: this._refetchConnection,
          environment: relay.environment
        }
      },
      _handleFragmentDataUpdate () {
        this.setState({
          data: this.state.resolver.resolve()
        })
      },
      _getConnectionData () {
        // Extract connection data and verify there are more edges to fetch
        const props = {
          ...this.$props,
          ...this.state.data
        }
        const connectionData = getConnectionFromProps(props)
        if (connectionData == null) {
          return null
        }
        const {
          EDGES,
          PAGE_INFO,
          HAS_NEXT_PAGE,
          HAS_PREV_PAGE,
          END_CURSOR,
          START_CURSOR
        } = ConnectionInterface.get()

        invariant(
          typeof connectionData === 'object',
          'RelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' +
            'to return `null` or a plain object with %s and %s properties, got `%s`.',
          this.$options.name,
          EDGES,
          PAGE_INFO,
          connectionData
        )
        const edges = connectionData[EDGES]
        const pageInfo = connectionData[PAGE_INFO]
        if (edges == null || pageInfo == null) {
          return null
        }
        invariant(
          Array.isArray(edges),
          'RelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' +
            'to return an object with %s: Array, got `%s`.',
          this.$options.name,
          EDGES,
          edges
        )
        invariant(
          typeof pageInfo === 'object',
          'RelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' +
            'to return an object with %s: Object, got `%s`.',
          this.$options.name,
          PAGE_INFO,
          pageInfo
        )
        const hasMore =
          direction === FORWARD
            ? pageInfo[HAS_NEXT_PAGE]
            : pageInfo[HAS_PREV_PAGE]
        const cursor =
          direction === FORWARD ? pageInfo[END_CURSOR] : pageInfo[START_CURSOR]
        if (
          typeof hasMore !== 'boolean' ||
          (edges.length !== 0 && typeof cursor === 'undefined')
        ) {
          warning(
            false,
            'RelayPaginationContainer: Cannot paginate without %s fields in `%s`. ' +
              'Be sure to fetch %s (got `%s`) and %s (got `%s`).',
            PAGE_INFO,
            this.$options.name,
            direction === FORWARD ? HAS_NEXT_PAGE : HAS_PREV_PAGE,
            hasMore,
            direction === FORWARD ? END_CURSOR : START_CURSOR,
            cursor
          )
          return null
        }
        return {
          cursor,
          edgeCount: edges.length,
          hasMore
        }
      },
      _hasMore () {
        const connectionData = this._getConnectionData()
        return !!(
          connectionData &&
          connectionData.hasMore &&
          connectionData.cursor
        )
      },
      _isLoading () {
        return !!this.state.refetchSubscription
      },
      _refetchConnection (totalCount, observerOrCallback, refetchVariables) {
        const paginatingVariables = {
          count: totalCount,
          cursor: null,
          totalCount
        }
        const fetch = this._fetchPage(
          paginatingVariables,
          toObserver(observerOrCallback),
          { force: true },
          refetchVariables
        )

        return { dispose: fetch.unsubscribe }
      },
      _loadMore (pageSize, observerOrCallback, options) {
        const observer = toObserver(observerOrCallback)
        const connectionData = this._getConnectionData()
        if (!connectionData) {
          Observable.create(sink => sink.complete()).subscribe(observer)
          return null
        }
        const totalCount = connectionData.edgeCount + pageSize
        if (options && options.force) {
          return this._refetchConnection(totalCount, observerOrCallback)
        }
        const { END_CURSOR, START_CURSOR } = ConnectionInterface.get()
        const cursor = connectionData.cursor
        warning(
          cursor,
          'RelayPaginationContainer: Cannot `loadMore` without valid `%s` (got `%s`)',
          direction === FORWARD ? END_CURSOR : START_CURSOR,
          cursor
        )
        const paginatingVariables = {
          count: pageSize,
          cursor: cursor,
          totalCount
        }
        const fetch = this._fetchPage(paginatingVariables, observer, options)
        return { dispose: fetch.unsubscribe }
      },
      _getQueryFetcher () {
        if (!this.state.queryFetcher) {
          this.setState({ queryFetcher: new VueRelayQueryFetcher() })
        }
        return this.state.queryFetcher
      },
      _fetchPage (paginatingVariables, observer, options, refetchVariables) {
        const { environment } = relay
        const {
          createOperationSelector,
          getRequest,
          getVariablesFromObject
        } = environment.unstable_internal
        const props = {
          ...this.$props,
          ...this.state.data
        }
        let fragmentVariables = getVariablesFromObject(
          this.context.relay.variables,
          fragments,
          this.$props
        )
        fragmentVariables = { ...fragmentVariables, ...refetchVariables }
        let fetchVariables = connectionConfig.getVariables(
          props,
          {
            count: paginatingVariables.count,
            cursor: paginatingVariables.cursor
          },
          // Pass the variables used to fetch the fragments initially
          fragmentVariables
        )
        invariant(
          typeof fetchVariables === 'object' && fetchVariables !== null,
          'RelayPaginationContainer: Expected `getVariables()` to ' +
            'return an object, got `%s` in `%s`.',
          fetchVariables,
          this.$options.name
        )
        fetchVariables = {
          ...fetchVariables,
          ...refetchVariables
        }
        this.setState({ localVariables: fetchVariables })

        const cacheConfig = options ? { force: !!options.force } : void 0
        if (cacheConfig && options && options.rerunParamExperimental) {
          cacheConfig.rerunParamExperimental = options.rerunParamExperimental
        }
        const request = getRequest(connectionConfig.query)
        const operation = createOperationSelector(request, fetchVariables)

        // Cancel any previously running refetch.
        if (this.state.refetchSubscription) {
          this.state.refetchSubscription.unsubscribe()
        }

        const onNext = (payload, complete) => {
          this.context.relay.environment = relay.environment
          this.context.relay.variables = {
            ...relay.variables,
            ...fragmentVariables
          }

          const prevData = this.state.resolver.resolve()
          this.state.resolver.setVariables(
            getFragmentVariables(
              fragmentVariables,
              paginatingVariables.totalCount
            )
          )
          const nextData = this.state.resolver.resolve()

          // Workaround slightly different handling for connection in different
          // core implementations:
          // - Classic core requires the count to be explicitly incremented
          // - Modern core automatically appends new items, updating the count
          //   isn't required to see new data.
          //
          // `setState` is only required if changing the variables would change the
          // resolved data.
          // TODO #14894725: remove PaginationContainer equal check
          if (!areEqual(prevData, nextData)) {
            this.setState({ data: nextData })
          }
          complete()
        }

        const cleanup = () => {
          if (this.state.refetchSubscription === refetchSubscription) {
            this.state.refetchSubscription.unsubscribe()
            this.setState({
              refetchSubscription: null,
              isARequestInFlight: false
            })
          }
        }

        this.setState({ isARequestInFlight: true })
        const refetchSubscription = this._getQueryFetcher()
          .execute({
            environment,
            operation,
            cacheConfig,
            preservePreviousReferences: true
          })
          .mergeMap(payload =>
            Observable.create(sink => {
              onNext(payload, () => {
                sink.next() // pass void to public observer's `next`
                sink.complete()
              })
            })
          )
          // use do instead of finally so that observer's `complete` fires after cleanup
          .do({
            error: cleanup,
            complete: cleanup,
            unsubscribe: cleanup
          })
          .subscribe(observer || {})

        this.setState({ refetchSubscription: this.state.isARequestInFlight
          ? refetchSubscription
          : null
        })

        return refetchSubscription
      },
      _release () {
        this.state.resolver.dispose()
        if (this.state.refetchSubscription) {
          this.state.refetchSubscription.unsubscribe()
          this.setState({
            refetchSubscription: null,
            isARequestInFlight: false
          })
        }
        if (this.state.queryFetcher) {
          this.state.queryFetcher.dispose()
        }
      }
    },
    watch: Object.assign(...Object.keys(fragments).map((key) => ({ [key]: function () {
      const {
        createFragmentSpecResolver,
        getDataIDsFromObject
      } = relay.environment.unstable_internal

      const prevIDs = getDataIDsFromObject(fragments, this.state.prevProps)
      const nextIDs = getDataIDsFromObject(fragments, this.$props)

      // If the environment has changed or props point to new records then
      // previously fetched data and any pending fetches no longer apply:
      // - Existing references are on the old environment.
      // - Existing references are based on old variables.
      // - Pending fetches are for the previous records.
      if (
        this.state.relayEnvironment !== relay.environment ||
        this.state.relayVariables !== relay.variables ||
        !areEqual(prevIDs, nextIDs)
      ) {
        this._release()

        this.context.relay.environment = relay.environment
        this.context.relay.variables = relay.variables

        const resolver = createFragmentSpecResolver(
          relay,
          this.$options.name,
          fragments,
          this.$props,
          this._handleFragmentDataUpdate
        )

        this.setState({
          prevProps: this.$props,
          relayEnvironment: relay.environment,
          relayVariables: relay.variables,
          relayProp: this._buildRelayProp(relay),
          localVariables: null,
          resolver
        })
      } else if (!this.state.localVariables) {
        this.state.resolver.setProps(this.$props)
      }
      const data = this.state.resolver.resolve()
      if (data !== this.state.data) {
        this.setState({ data })
      }
    } }))),
    beforeDestroy () {
      this._release()
    }
  }
}

const createPaginationContainer = function () {
  invariant(
    arguments.length === 2 || arguments.length === 3,
    'createPaginationContainer: Expected `arguments.length` to be 2 or 3, got `%s`.',
    arguments
  )
  if (arguments.length === 2) {
    [].unshift.call(arguments, null)
  }

  const [component, fragmentSpec, connectionConfig] = arguments

  return buildVueRelayContainer(component, fragmentSpec, function (fragments) {
    return createContainerWithFragments.call(this, fragments, connectionConfig)
  })
}

export {
  createPaginationContainer
}
