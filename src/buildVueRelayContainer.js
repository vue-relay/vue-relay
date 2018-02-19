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

const buildVueRelayContainer = function (fragmentSpec, createContainerWithFragments) {
  return {
    name: 'relay-context-consumer',
    inject: ['relay'],
    render (h) {
      const relay = assertRelayContext(this.relay)
      const { getFragment: getFragmentFromTag } = relay.environment.unstable_internal
      const fragments = mapObject(fragmentSpec, getFragmentFromTag)

      const context = this

      return h({
        extends: createContainerWithFragments.call(this, fragments),
        props: Object.keys(fragments),
        render (h) {
          const render = (h) => {
            return h('keep-alive', {
              props: {
                include: []
              }
            }, [
              context.$scopedSlots.default(Object.assign({ relay: this.state.relayProp }, this.state.data))
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
      }, {
        props: this.$attrs
      })
    }
  }
}

export default buildVueRelayContainer
