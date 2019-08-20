import VueRelayQueryFetcher from './VueRelayQueryFetcher'
import buildVueRelayContainer from './buildVueRelayContainer'
import { assertRelayContext } from './RelayContext'
import { getContainerName } from './VueRelayContainerUtils'

import areEqual from 'fbjs/lib/areEqual'
import invariant from 'fbjs/lib/invariant'
import warning from 'fbjs/lib/warning'
import {
  Observable,
  createFragmentSpecResolver,
  createOperationDescriptor,
  getDataIDsFromObject,
  getFragmentOwners,
  getRequest,
  getVariablesFromObject,
  isScalarAndEqual
} from 'relay-runtime'

const createContainerWithFragments = function (component, fragments, taggedNode) {
  const containerName = getContainerName(component) + '-refetch-container'

  return {
    name: containerName,
    data () {
      const relayContext = assertRelayContext(this.props.__relayContext)
      this._refetchSubscription = null
      // Do not provide a subscription/callback here.
      // It is possible for this render to be interrupted or aborted,
      // In which case the subscription would cause a leak.
      // We will add the subscription in componentDidMount().
      const resolver = createFragmentSpecResolver(
        relayContext,
        containerName,
        fragments,
        this.$props
      )
      this.state = {
        data: resolver.resolve(),
        localVariables: null,
        prevProps: {
          ...this.$props,
          ...this.props
        },
        prevPropsContext: relayContext,
        contextForChildren: relayContext,
        relayProp: getRelayProp(relayContext.environment, this._refetch),
        resolver
      }
      this._isUnmounted = false

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

        let resolver = prevState.resolver

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
          // Do not provide a subscription/callback here.
          // It is possible for this render to be interrupted or aborted,
          // In which case the subscription would cause a leak.
          // We will add the subscription in componentDidUpdate().
          resolver = createFragmentSpecResolver(
            relayContext,
            containerName,
            fragments,
            nextProps
          )
          return {
            data: resolver.resolve(),
            localVariables: null,
            prevProps: nextProps,
            prevPropsContext: relayContext,
            contextForChildren: relayContext,
            relayProp: getRelayProp(
              relayContext.environment,
              prevState.relayProp.refetch
            ),
            resolver
          }
        } else if (!prevState.localVariables) {
          resolver.setProps(nextProps)
        }
        const data = resolver.resolve()
        if (data !== prevState.data) {
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
              this.state.prevPropsContext.environment !==
                nextState.prevPropsContext.environment ||
              this.state.prevPropsContext.variables !==
                nextState.prevPropsContext.variables
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
      componentDidUpdate (_, prevState) {
        // If the environment has changed or props point to new records then
        // previously fetched data and any pending fetches no longer apply:
        // - Existing references are on the old environment.
        // - Existing references are based on old variables.
        // - Pending fetches are for the previous records.
        if (this.state.resolver !== prevState.resolver) {
          prevState.resolver.dispose()
          this._queryFetcher && this._queryFetcher.dispose()
          this._refetchSubscription && this._refetchSubscription.unsubscribe()

          this._subscribeToNewResolver()
        }
      },
      _subscribeToNewResolver () {
        const { data, resolver } = this.state

        // Event listeners are only safe to add during the commit phase,
        // So they won't leak if render is interrupted or errors.
        resolver.setCallback(this._handleFragmentDataUpdate)

        // External values could change between render and commit.
        // Check for this case, even though it requires an extra store read.
        const maybeNewData = resolver.resolve()
        if (data !== maybeNewData) {
          this.setState({ data: maybeNewData })
        }
      },
      _handleFragmentDataUpdate () {
        const resolverFromThisUpdate = this.state.resolver
        this.setState(updatedState =>
          // If this event belongs to the current data source, update.
          // Otherwise we should ignore it.
          resolverFromThisUpdate === updatedState.resolver
            ? {
              data: updatedState.resolver.resolve()
            }
            : null
        )
      },
      _getFragmentVariables () {
        return getVariablesFromObject(
          // NOTE: We pass empty operationVariables because we want to prefer
          // the variables from the fragment owner
          {},
          fragments,
          this.$props,
          getFragmentOwners(fragments, this.$props)
        )
      },
      _getQueryFetcher () {
        if (!this._queryFetcher) {
          this._queryFetcher = new VueRelayQueryFetcher()
        }
        return this._queryFetcher
      },
      _refetch (
        refetchVariables,
        renderVariables,
        observerOrCallback,
        options
      ) {
        if (this._isUnmounted) {
          warning(
            false,
            'VueRelayRefetchContainer: Unexpected call of `refetch` ' +
              'on unmounted container `%s`. It looks like some instances ' +
              'of your container still trying to refetch the data but they already ' +
              'unmounted. Please make sure you clear all timers, intervals, async ' +
              'calls, etc that may trigger `refetch`.',
            containerName
          )
          return {
            dispose () {}
          }
        }

        const { environment, variables: rootVariables } = assertRelayContext(
          this.props.__relayContext
        )
        let fetchVariables =
          typeof refetchVariables === 'function'
            ? refetchVariables(this._getFragmentVariables())
            : refetchVariables
        fetchVariables = { ...rootVariables, ...fetchVariables }
        const fragmentVariables = renderVariables
          ? { ...fetchVariables, ...renderVariables }
          : fetchVariables

        const cacheConfig = options ? { force: !!options.force } : undefined

        const observer =
          typeof observerOrCallback === 'function'
            ? {
              // callback is not exectued on complete or unsubscribe
              // for backward compatibility
              next: observerOrCallback,
              error: observerOrCallback
            }
            : observerOrCallback || ({})

        const query = getRequest(taggedNode)
        const operation = createOperationDescriptor(query, fetchVariables)

        // TODO: T26288752 find a better way
        this.state.localVariables = fetchVariables

        // Cancel any previously running refetch.
        this._refetchSubscription && this._refetchSubscription.unsubscribe()

        // Declare refetchSubscription before assigning it in .start(), since
        // synchronous completion may call callbacks .subscribe() returns.
        let refetchSubscription

        if (options && options.fetchPolicy === 'store-or-network') {
          const storeSnapshot = this._getQueryFetcher().lookupInStore(
            environment,
            operation
          )
          if (storeSnapshot != null) {
            this.state.resolver.setVariables(fragmentVariables, operation.node)
            this.setState(
              latestState => ({
                data: latestState.resolver.resolve(),
                contextForChildren: {
                  environment: this.props.__relayContext.environment,
                  variables: fragmentVariables
                }
              }),
              () => {
                observer.next && observer.next()
                observer.complete && observer.complete()
              }
            )
            return {
              dispose () {}
            }
          }
        }

        this._getQueryFetcher()
          .execute({
            environment,
            operation,
            cacheConfig,
            // TODO (T26430099): Cleanup old references
            preservePreviousReferences: true
          })
          .mergeMap(_ => {
            this.state.resolver.setVariables(fragmentVariables, operation.node)
            return Observable.create(sink =>
              this.setState(
                latestState => ({
                  data: latestState.resolver.resolve(),
                  contextForChildren: {
                    environment: this.props.__relayContext.environment,
                    variables: fragmentVariables
                  }
                }),
                () => {
                  sink.next()
                  sink.complete()
                }
              )
            )
          })
          .finally(() => {
            // Finalizing a refetch should only clear this._refetchSubscription
            // if the finizing subscription is the most recent call.
            if (this._refetchSubscription === refetchSubscription) {
              this._refetchSubscription = null
            }
          })
          .subscribe({
            ...observer,
            start: subscription => {
              this._refetchSubscription = refetchSubscription = subscription
              observer.start && observer.start(subscription)
            }
          })

        return {
          dispose () {
            refetchSubscription && refetchSubscription.unsubscribe()
          }
        }
      }
    },
    mounted () {
      this._subscribeToNewResolver()
    },
    beforeDestroy () {
      this._isUnmounted = true
      this.state.resolver.dispose()
      this._queryFetcher && this._queryFetcher.dispose()
      this._refetchSubscription && this._refetchSubscription.unsubscribe()
    }
  }
}

function getRelayProp (environment, refetch) {
  return {
    environment,
    refetch
  }
}

const createRefetchContainer = function () {
  invariant(
    arguments.length === 2 || arguments.length === 3,
    'createRefetchContainer: Expected `arguments.length` to be 2 or 3, got `%s`.',
    arguments
  )
  if (arguments.length === 2) {
    [].unshift.call(arguments, null)
  }

  const [component, fragmentSpec, taggedNode] = arguments

  return buildVueRelayContainer(component, fragmentSpec, function (component, fragments) {
    return createContainerWithFragments(component, fragments, taggedNode)
  })
}

export {
  createRefetchContainer
}
