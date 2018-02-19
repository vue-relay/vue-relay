import buildVueRelayContainer from './buildVueRelayContainer'

const areEqual = require('fbjs/lib/areEqual')

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
        })
      }
    },
    beforeUpdate () {
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
    },
    beforeDestroy () {
      this.state.resolver.dispose()
    },
    methods: {
      setState (state) {
        this.state = Object.freeze(Object.assign({}, this.state, state))
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
    }
  }
}

const createFragmentContainer = function (fragmentSpec) {
  return buildVueRelayContainer(fragmentSpec, createContainerWithFragments)
}

export {
  createFragmentContainer
}
