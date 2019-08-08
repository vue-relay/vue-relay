import VueRelayQueryFetcher from './VueRelayQueryFetcher'
import buildVueRelayContainer from './buildVueRelayContainer'

const areEqual = require('fbjs/lib/areEqual')
const invariant = require('fbjs/lib/invariant')

const {
  Observable
} = require('relay-runtime')

const createContainerWithFragments = function (fragments, taggedNode) {
  const relay = this.relay

  return {
    name: 'relay-refetch-container',
    data () {
      const { createFragmentSpecResolver } = relay.environment.unstable_internal
      // Do not provide a subscription/callback here.
      // It is possible for this render to be interrupted or aborted,
      // In which case the subscription would cause a leak.
      // We will add the subscription in componentDidMount().
      const resolver = createFragmentSpecResolver(
        relay,
        this.$options.name,
        fragments,
        this.$props,
      )

      return {
        // a.k.a this._relayContext in react-relay
        context: Object.freeze({
          relay: {
            environment: relay.environment,
            variables: relay.variables
          }
        }),
        prevState: Object.freeze({
          resolver
        }),
        state: Object.freeze({
          data: resolver.resolve(),
          prevProps: this.$props,
          relayEnvironment: relay.environment,
          relayVariables: relay.variables,
          relayProp: {
            environment: relay.environment,
            refetch: this._refetch
          },
          localVariables: null,
          refetchSubscription: null,
          resolver
        }),
        switch: true
      }
    },
    computed: {
      fragments () {
        Object.keys(fragments).forEach(key => this[key])
        return (this.switch = !this.switch)
      }
    },
    methods: {
      setState (state) {
        this.state = Object.freeze({
          ...this.state,
          ...state
        })
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
        if (this.state.resolver === this.prevState.resolver) {
          this.setState({
            data: this.state.resolver.resolve()
          })
        }
      },
      _getFragmentVariables () {
        const {
          getVariablesFromObject
        } = relay.environment.unstable_internal
        return getVariablesFromObject(
          relay.variables,
          fragments,
          this.$props
        )
      },
      _getQueryFetcher () {
        if (!this.state.queryFetcher) {
          this.setState({ queryFetcher: new VueRelayQueryFetcher() })
        }
        return this.state.queryFetcher
      },
      _refetch (refetchVariables, renderVariables, observerOrCallback, options) {
        const { environment, variables: rootVariables } = relay
        let fetchVariables =
          typeof refetchVariables === 'function'
            ? refetchVariables(this._getFragmentVariables())
            : refetchVariables
        fetchVariables = { ...rootVariables, ...fetchVariables }
        const fragmentVariables = renderVariables
          ? { ...rootVariables, ...renderVariables }
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

        const {
          createOperationDescriptor,
          getRequest
        } = relay.environment.unstable_internal
        const query = getRequest(taggedNode)
        const operation = createOperationDescriptor(query, fetchVariables)

        // TODO: T26288752 find a better way
        this.setState({ localVariables: fetchVariables })

        // Cancel any previously running refetch.
        this.state.refetchSubscription && this.state.refetchSubscription.unsubscribe()

        // Declare refetchSubscription before assigning it in .start(), since
        // synchronous completion may call callbacks .subscribe() returns.
        let refetchSubscription
        this._getQueryFetcher()
          .execute({
            environment,
            operation,
            cacheConfig,
            // TODO (T26430099): Cleanup old references
            preservePreviousReferences: true
          })
          .mergeMap(response => {
            // Child containers rely on context.relay being mutated (for gDSFP).
            // TODO: T26288752 find a better way
            this.context.relay.environment = relay.environment
            this.context.relay.variables = fragmentVariables
            this.state.resolver.setVariables(fragmentVariables)
            return Observable.create(sink => {
              this.setState({ data: this.state.resolver.resolve() })
              sink.next()
              sink.complete()
            })
          })
          .finally(() => {
            // Finalizing a refetch should only clear this._refetchSubscription
            // if the finizing subscription is the most recent call.
            if (this.state.refetchSubscription === refetchSubscription) {
              this.setState({
                refetchSubscription: null
              })
            }
          })
          .subscribe({
            ...observer,
            start: subscription => {
              refetchSubscription = subscription
              this.setState({
                refetchSubscription: subscription
              })
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
    watch: { fragments () {
      const {
        createFragmentSpecResolver,
        getDataIDsFromObject
      } = relay.environment.unstable_internal

      const prevIDs = getDataIDsFromObject(fragments, this.state.prevProps)
      const nextIDs = getDataIDsFromObject(fragments, this.$props)

      let resolver = this.state.resolver

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
        this.prevState = Object.freeze({ resolver })

        // Child containers rely on context.relay being mutated (for gDSFP).
        this.context.relay.environment = relay.environment
        this.context.relay.variables = relay.variables

        resolver = createFragmentSpecResolver(
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
          relayProp: {
            environment: relay.environment,
            refetch: this._refetch
          },
          localVariables: null,
          resolver
        })
      } else if (!this.state.localVariables) {
        resolver.setProps(this.$props)
      }
      const data = resolver.resolve()
      if (data !== this.state.data) {
        this.setState({ data })
      }
    } },
    mounted () {
      this._subscribeToNewResolver()
    },
    updated () {
      if (this.state.resolver !== this.prevState.resolver) {
        this.prevState.resolver.dispose()
        this.prevState = Object.freeze({ resolver: this.state.resolver })
        this.state.queryFetcher && this.state.queryFetcher.dispose()
        this.state.refetchSubscription && this.state.refetchSubscription.unsubscribe()

        this._subscribeToNewResolver()
      }
    },
    beforeDestroy () {
      this.state.resolver.dispose()
      this.state.queryFetcher && this.state.queryFetcher.dispose()
      this.state.refetchSubscription && this.state.refetchSubscription.unsubscribe()
    }
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

  return buildVueRelayContainer(component, fragmentSpec, function (fragments) {
    return createContainerWithFragments.call(this, fragments, taggedNode)
  })
}

export {
  createRefetchContainer
}
