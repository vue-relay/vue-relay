import VueRelayQueryFetcher from './VueRelayQueryFetcher'
import buildVueRelayContainer from './buildVueRelayContainer'
import { assertRelayContext } from './RelayContext'
import {
  getComponentName,
  getContainerName
} from './VueRelayContainerUtils'

import areEqual from 'fbjs/lib/areEqual'
import forEachObject from 'fbjs/lib/forEachObject'
import invariant from 'fbjs/lib/invariant'
import warning from 'fbjs/lib/warning'
import {
  ConnectionInterface,
  Observable,
  createFragmentSpecResolver,
  createOperationDescriptor,
  getDataIDsFromObject,
  getFragmentOwners,
  getRequest,
  getVariablesFromObject,
  isScalarAndEqual
} from 'relay-runtime'

const FORWARD = 'forward'

function createGetConnectionFromProps (metadata) {
  const path = metadata.path
  invariant(
    path,
    'VueRelayPaginationContainer: Unable to synthesize a ' +
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

function createGetFragmentVariables (
  metadata
) {
  const countVariable = metadata.count
  invariant(
    countVariable,
    'VueRelayPaginationContainer: Unable to synthesize a ' +
      'getFragmentVariables function.'
  )
  return (prevVars, totalCount) => ({
    ...prevVars,
    [countVariable]: totalCount
  })
}

function findConnectionMetadata (fragments) {
  let foundConnectionMetadata = null
  let isRelayModern = false
  for (const fragmentName in fragments) {
    const fragment = fragments[fragmentName]
    const connectionMetadata = (fragment.metadata &&
      fragment.metadata.connection)
    // HACK: metadata is always set to `undefined` in classic. In modern, even
    // if empty, it is set to null (never undefined). We use that knowlege to
    // check if we're dealing with classic or modern
    if (fragment.metadata !== undefined) {
      isRelayModern = true
    }
    if (connectionMetadata) {
      invariant(
        connectionMetadata.length === 1,
        'VueRelayPaginationContainer: Only a single @connection is ' +
          'supported, `%s` has %s.',
        fragmentName,
        connectionMetadata.length
      )
      invariant(
        !foundConnectionMetadata,
        'VueRelayPaginationContainer: Only a single fragment with ' +
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
    'VueRelayPaginationContainer: A @connection directive must be present.'
  )
  return foundConnectionMetadata || ({})
}

function toObserver (observerOrCallback) {
  return typeof observerOrCallback === 'function'
    ? {
      error: observerOrCallback,
      complete: observerOrCallback,
      unsubscribe: _ => {
        typeof observerOrCallback === 'function' && observerOrCallback()
      }
    }
    : observerOrCallback || ({})
}

const createContainerWithFragments = function (component, fragments, connectionConfig) {
  const componentName = getComponentName(component)
  const containerName = getContainerName(component) + '-pagination-container'

  const metadata = findConnectionMetadata(fragments)

  const getConnectionFromProps =
    connectionConfig.getConnectionFromProps ||
    createGetConnectionFromProps(metadata)

  const direction = connectionConfig.direction || metadata.direction
  invariant(
    direction,
    'VueRelayPaginationContainer: Unable to infer direction of the ' +
      'connection, possibly because both first and last are provided.'
  )

  const getFragmentVariables =
    connectionConfig.getFragmentVariables ||
    createGetFragmentVariables(metadata)

  return {
    name: containerName,
    data () {
      const relayContext = assertRelayContext(this.props.__relayContext)
      this._isARequestInFlight = false
      this._refetchSubscription = null
      this._refetchVariables = null
      this._resolver = createFragmentSpecResolver(
        relayContext,
        containerName,
        fragments,
        this.$props,
        this._handleFragmentDataUpdate
      )
      this.state = {
        data: this._resolver.resolve(),
        prevProps: {
          ...this.$props,
          ...this.props
        },
        prevPropsContext: relayContext,
        contextForChildren: relayContext,
        relayProp: this._buildRelayProp(relayContext)
      }
      this._isUnmounted = false
      this._hasFetched = false

      return {}
    },
    methods: {
      getDerivedStateFromProps (nextProps, prevState) {
        // Any props change could impact the query, so we mirror props in state.
        // This is an unusual pattern, but necessary for this container usecase.
        const { prevProps } = prevState
        const relayContext = assertRelayContext(nextProps.__relayContext)
        const prevIDs = getDataIDsFromObject(fragments, prevProps)
        const nextIDs = getDataIDsFromObject(fragments, nextProps)

        // If the environment has changed or props point to new records then
        // previously fetched data and any pending fetches no longer apply:
        // - Existing references are on the old environment.
        // - Existing references are based on old variables.
        // - Pending fetches are for the previous records.
        if (
          prevState.prevPropsContext.environment !== relayContext.environment ||
          prevState.prevPropsContext.variables !== relayContext.variables ||
          !areEqual(prevIDs, nextIDs)
        ) {
          this._cleanup()
          // Child containers rely on context.relay being mutated (for gDSFP).
          this._resolver = createFragmentSpecResolver(
            relayContext,
            containerName,
            fragments,
            nextProps,
            this._handleFragmentDataUpdate
          )
          return {
            data: this._resolver.resolve(),
            prevProps: nextProps,
            prevPropsContext: relayContext,
            contextForChildren: relayContext,
            relayProp: this._buildRelayProp(relayContext)
          }
        } else if (!this._hasFetched) {
          this._resolver.setProps(nextProps)
        }
        const data = this._resolver.resolve()
        if (data !== this.state.data) {
          return {
            data,
            prevProps: nextProps
          }
        }
        return null
      },
      shouldComponentUpdate (nextProps, nextState) {
        // Short-circuit if any Relay-related data has changed
        if (
          nextState.data !== this.state.data ||
          nextState.relayProp !== this.state.relayProp
        ) {
          return true
        }
        // Otherwise, for convenience short-circuit if all non-Relay props
        // are scalar and equal
        const keys = Object.keys(nextProps)
        for (let ii = 0; ii < keys.length; ii++) {
          const key = keys[ii]
          if (key === '__relayContext') {
            if (
              nextState.prevPropsContext.environment !==
                this.state.prevPropsContext.environment ||
              nextState.prevPropsContext.variables !==
                this.state.prevPropsContext.variables
            ) {
              return true
            }
          } else {
            if (
              !fragments.hasOwnProperty(key) &&
              !isScalarAndEqual(nextProps[key], this.props[key])
            ) {
              return true
            }
          }
        }
        return false
      },
      componentDidUpdate () {},
      _buildRelayProp (relayContext) {
        return {
          hasMore: this._hasMore,
          isLoading: this._isLoading,
          loadMore: this._loadMore,
          refetchConnection: this._refetchConnection,
          environment: relayContext.environment
        }
      },
      _handleFragmentDataUpdate () {
        this.setState({ data: this._resolver.resolve() })
      },
      _getConnectionData () {
        // Extract connection data and verify there are more edges to fetch
        const restProps = this.$props
        const props = {
          ...restProps,
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
          'VueRelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' +
            'to return `null` or a plain object with %s and %s properties, got `%s`.',
          componentName,
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
          'VueRelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' +
            'to return an object with %s: Array, got `%s`.',
          componentName,
          EDGES,
          edges
        )
        invariant(
          typeof pageInfo === 'object',
          'VueRelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' +
            'to return an object with %s: Object, got `%s`.',
          componentName,
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
            'VueRelayPaginationContainer: Cannot paginate without %s fields in `%s`. ' +
              'Be sure to fetch %s (got `%s`) and %s (got `%s`).',
            PAGE_INFO,
            componentName,
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
        return !!this._refetchSubscription
      },
      _refetchConnection (
        totalCount,
        observerOrCallback,
        refetchVariables
      ) {
        if (!this._canFetchPage('refetchConnection')) {
          return {
            dispose () {}
          }
        }
        this._refetchVariables = refetchVariables
        const paginatingVariables = {
          count: totalCount,
          cursor: null,
          totalCount
        }
        const fetch = this._fetchPage(
          paginatingVariables,
          toObserver(observerOrCallback),
          { force: true }
        )

        return { dispose: fetch.unsubscribe }
      },
      _loadMore (
        pageSize,
        observerOrCallback,
        options
      ) {
        if (!this._canFetchPage('loadMore')) {
          return {
            dispose () {}
          }
        }

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
          'VueRelayPaginationContainer: Cannot `loadMore` without valid `%s` (got `%s`)',
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
        if (!this._queryFetcher) {
          this._queryFetcher = new VueRelayQueryFetcher()
        }
        return this._queryFetcher
      },
      _canFetchPage (method) {
        if (this._isUnmounted) {
          warning(
            false,
            'VueRelayPaginationContainer: Unexpected call of `%s` ' +
              'on unmounted container `%s`. It looks like some instances ' +
              'of your container still trying to fetch data but they already ' +
              'unmounted. Please make sure you clear all timers, intervals, async ' +
              'calls, etc that may trigger `%s` call.',
            method,
            containerName,
            method
          )
          return false
        }
        return true
      },
      _fetchPage (
        paginatingVariables,
        observer,
        options
      ) {
        const { environment } = assertRelayContext(this.props.__relayContext)
        const restProps = this.$props
        const props = {
          ...restProps,
          ...this.state.data
        }
        let rootVariables
        let fragmentVariables
        const fragmentOwners = getFragmentOwners(fragments, restProps)
        // NOTE: rootVariables are spread down below in a couple of places,
        // so we compute them here from the fragment owners.
        // For extra safety, we make sure the rootVariables include the
        // variables from all owners in this fragmentSpec, even though they
        // should all point to the same owner
        forEachObject(fragments, (__, key) => {
          const fragmentOwner = fragmentOwners[key]
          const fragmentOwnerVariables = Array.isArray(fragmentOwner)
            ? (fragmentOwner[0] && fragmentOwner[0].variables) ? fragmentOwner[0].variables : {}
            : (fragmentOwner && fragmentOwner.variables) ? fragmentOwner.variables : {}
          rootVariables = {
            ...rootVariables,
            ...fragmentOwnerVariables
          }
        })
        fragmentVariables = getVariablesFromObject(
          // NOTE: We pass empty operationVariables because we want to prefer
          // the variables from the fragment owner
          {},
          fragments,
          restProps,
          fragmentOwners
        )
        fragmentVariables = {
          ...rootVariables,
          ...fragmentVariables,
          ...this._refetchVariables
        }
        let fetchVariables = connectionConfig.getVariables(
          props,
          {
            count: paginatingVariables.count,
            cursor: paginatingVariables.cursor
          },
          fragmentVariables
        )
        invariant(
          typeof fetchVariables === 'object' && fetchVariables !== null,
          'VueRelayPaginationContainer: Expected `getVariables()` to ' +
            'return an object, got `%s` in `%s`.',
          fetchVariables,
          componentName
        )
        fetchVariables = {
          ...fetchVariables,
          ...this._refetchVariables
        }
        fragmentVariables = {
          ...fetchVariables,
          ...fragmentVariables
        }

        const cacheConfig = options
          ? { force: !!options.force }
          : undefined
        const request = getRequest(connectionConfig.query)
        const operation = createOperationDescriptor(request, fetchVariables)

        let refetchSubscription = null

        if (this._refetchSubscription) {
          this._refetchSubscription.unsubscribe()
        }
        this._hasFetched = true

        const onNext = (_, complete) => {
          const contextVariables = {
            ...this.props.__relayContext.variables,
            ...fragmentVariables
          }
          const prevData = this._resolver.resolve()
          this._resolver.setVariables(
            getFragmentVariables(
              fragmentVariables,
              paginatingVariables.totalCount
            ),
            operation.node
          )
          const nextData = this._resolver.resolve()

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
            this.setState(
              {
                data: nextData,
                contextForChildren: {
                  environment: this.props.__relayContext.environment,
                  variables: contextVariables
                }
              },
              complete
            )
          } else {
            complete()
          }
        }

        const cleanup = () => {
          if (this._refetchSubscription === refetchSubscription) {
            this._refetchSubscription = null
            this._isARequestInFlight = false
          }
          this.$forceUpdate() // https://github.com/facebook/relay/issues/1973#issuecomment-325441743
        }

        this._isARequestInFlight = true
        refetchSubscription = this._getQueryFetcher()
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

        this._refetchSubscription = this._isARequestInFlight
          ? refetchSubscription
          : null

        this.$forceUpdate() // https://github.com/facebook/relay/issues/1973#issuecomment-325441743

        return refetchSubscription
      },
      _cleanup () {
        this._resolver.dispose()
        this._refetchVariables = null
        this._hasFetched = false
        if (this._refetchSubscription) {
          this._refetchSubscription.unsubscribe()
          this._refetchSubscription = null
          this._isARequestInFlight = false
        }
        if (this._queryFetcher) {
          this._queryFetcher.dispose()
        }
      }
    },
    beforeDestroy () {
      this._isUnmounted = true
      this._cleanup()
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

  return buildVueRelayContainer(component, fragmentSpec, function (component, fragments) {
    return createContainerWithFragments(component, fragments, connectionConfig)
  })
}

export {
  createPaginationContainer
}
