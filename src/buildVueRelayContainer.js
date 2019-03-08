import Vue from 'vue'

import assertFragmentMap from './assertFragmentMap'
import {
  getComponentName
} from './VueRelayContainerUtils'

import mapObject from 'fbjs/lib/mapObject'
import { getFragment } from 'relay-runtime'

const VUE_RELAY_PROPS = 'vue-relay-props'

const buildVueRelayContainer = function (component, fragmentSpec, createContainerWithFragments) {
  // Sanity-check user-defined fragment input
  assertFragmentMap(getComponentName(component), fragmentSpec)

  const fragments = mapObject(fragmentSpec, getFragment)

  const props = Object.keys(fragments)

  return {
    extends: createContainerWithFragments(component, fragments),
    props,
    methods: {
      applyDerivedStateFromProps () {
        this.setState(this.getDerivedStateFromProps({
          ...this.$props,
          ...this.props
        }, this.state))
      },
      setState (partialState, callback) {
        if (typeof partialState === 'function') {
          partialState = partialState({ ...this.state })
        }
        if (partialState != null) {
          const nextState = {
            ...this.state,
            ...partialState
          }

          const forceUpdate = this.shouldComponentUpdate({
            ...this.$props,
            ...this.props
          }, nextState)

          this.prevState = { ...this.state }
          this.state = nextState

          if (typeof callback === 'function') {
            callback()
          }

          if (forceUpdate) {
            this.$forceUpdate()
          }
        }
      }
    },
    watch: {
      'props.__relayContext': 'applyDerivedStateFromProps',
      ...props.map(prop => ({ [prop]: 'applyDerivedStateFromProps' }))
    },
    render (h) {
      if (this.state.contextForChildren != null) {
        this[VUE_RELAY_PROPS].__relayContext = Object.freeze({
          ...this.state.contextForChildren
        })
      }

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
      }, this.$scopedSlots.default({
        ...this.state.data,
        relay: this.state.relayProp
      }))
    },
    beforeUpdate () {
      if (this.prevState == null) {
        this.prevState = { ...this.state }
      }
    },
    updated () {
      delete this.prevState
    },
    inject: {
      'props': { from: VUE_RELAY_PROPS }
    },
    provide () {
      return this.state.contextForChildren != null
        ? {
          [VUE_RELAY_PROPS]: (this[VUE_RELAY_PROPS] = Vue.observable({
            __relayContext: Object.freeze({
              ...this.state.contextForChildren
            })
          }))
        }
        : {}
    }
  }
}

export default buildVueRelayContainer
export { VUE_RELAY_PROPS }
