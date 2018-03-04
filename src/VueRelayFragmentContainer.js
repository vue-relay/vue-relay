import buildVueRelayContainer from './buildVueRelayContainer'

const areEqual = require('fbjs/lib/areEqual')
const invariant = require('fbjs/lib/invariant')

const createContainerWithFragments = function (fragments) {
  const relay = this.relay

  return {
    name: 'relay-fragment-container',
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
        this.setState({
          data: this.state.resolver.resolve(),
          relayProp: {
            isLoading: this.state.resolver.isLoading(),
            environment: this.state.relayProp.environment
          }
        })
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

      if (
        this.state.relayEnvironment !== relay.environment ||
        this.state.relayVariables !== relay.variables ||
        !areEqual(prevIDs, nextIDs)
      ) {
        resolver.dispose()
        resolver = createFragmentSpecResolver(
          relay,
          this.$options.name,
          fragments,
          this.$props,
          this._handleFragmentDataUpdate
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
