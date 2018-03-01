import isRelayContext from './isRelayContext'

const invariant = require('fbjs/lib/invariant')
const mapObject = require('fbjs/lib/mapObject')

const assertRelayContext = function (relay) {
  invariant(
    isRelayContext(relay),
    'RelayContextConsumer: Expected `relayContext` to be an object ' +
      'conforming to the `RelayContext` interface, got `%s`.',
    relay
  )
  return (relay)
}

const buildVueRelayContainer = function (component, fragmentSpec, createContainerWithFragments) {
  return {
    name: 'relay-context-consumer',
    inject: ['relay'],
    created () {
      const relay = assertRelayContext(this.relay)
      const { getFragment: getFragmentFromTag } = relay.environment.unstable_internal
      const fragments = mapObject(fragmentSpec, getFragmentFromTag)

      const context = this

      this.component = {
        extends: createContainerWithFragments.call(this, fragments),
        props: Object.keys(fragments),
        render (h) {
          const render = (h) => {
            if (component != null) {
              return h(component, {
                props: {
                  ...this.$attrs,
                  ...this.state.data,
                  relay: this.state.relayProp
                }
              })
            }
            return h('keep-alive', {
              props: {
                include: []
              }
            }, [
              context.$scopedSlots.default({
                ...this.state.data,
                relay: this.state.relayProp
              })
            ])
          }
          if (this.context) {
            return h({
              name: 'relay-context-provider',
              provide: {
                relay: this.context.relay
              },
              render
            })
          }
          return render(h)
        }
      }
    },
    render (h) {
      return h(this.component, {
        props: this.$attrs
      })
    }
  }
}

export default buildVueRelayContainer
