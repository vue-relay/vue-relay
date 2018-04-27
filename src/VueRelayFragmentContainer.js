import buildVueRelayContainer from './buildVueRelayContainer'

const areEqual = require('fbjs/lib/areEqual')
const invariant = require('fbjs/lib/invariant')

const createContainerWithFragments = function (fragments) {
  const relay = this.relay

  return {
    name: 'relay-fragment-container',
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
        this.$props
      )

      return {
        prevState: Object.freeze({
          resolver
        }),
        state: Object.freeze({
          data: resolver.resolve(),
          prevProps: this.$props,
          relayEnvironment: relay.environment,
          relayVariables: relay.variables,
          relayProp: {
            isLoading: resolver.isLoading(),
            environment: relay.environment
          },
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
      _handleFragmentDataUpdate () {
        // If this event belongs to the current data source, update.
        // Otherwise we should ignore it.
        if (this.state.resolver === this.prevState.resolver) {
          this.setState({
            data: this.state.resolver.resolve(),
            relayProp: {
              isLoading: this.state.resolver.isLoading(),
              environment: this.state.relayProp.environment
            }
          })
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

        // Do not provide a subscription/callback here.
        // It is possible for this render to be interrupted or aborted,
        // In which case the subscription would cause a leak.
        // We will add the subscription in componentDidUpdate().
        resolver = createFragmentSpecResolver(
          relay,
          this.$options.name,
          fragments,
          this.$props
        )

        this.setState({
          data: resolver.resolve(),
          prevProps: this.$props,
          relayEnvironment: relay.environment,
          relayVariables: relay.variables,
          relayProp: {
            isLoading: resolver.isLoading(),
            environment: relay.environment
          },
          resolver
        })
      } else {
        resolver.setProps(this.$props)

        const data = resolver.resolve()
        if (data !== this.state.data) {
          this.setState({
            data,
            prevProps: this.$props,
            relayEnvironment: relay.environment,
            relayVariables: relay.variables,
            relayProp: {
              isLoading: resolver.isLoading(),
              environment: relay.environment
            }
          })
        }
      }
    } },
    mounted () {
      this._subscribeToNewResolver()
    },
    updated () {
      if (this.state.resolver !== this.prevState.resolver) {
        this.prevState.resolver.dispose()
        this.prevState = Object.freeze({ resolver: this.state.resolver })

        this._subscribeToNewResolver()
      }
    },
    beforeDestroy () {
      this.state.resolver.dispose()
    }
  }
}

const createFragmentContainer = function () {
  invariant(
    arguments.length === 1 || arguments.length === 2,
    'createFragmentContainer: Expected `arguments.length` to be 1 or 2, got `%s`.',
    arguments
  )
  if (arguments.length === 1) {
    [].unshift.call(arguments, null)
  }

  const [component, fragmentSpec] = arguments

  return buildVueRelayContainer(component, fragmentSpec, createContainerWithFragments)
}

export {
  createFragmentContainer
}
