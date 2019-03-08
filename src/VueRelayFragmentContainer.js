import buildVueRelayContainer from './buildVueRelayContainer'
import { assertRelayContext } from './RelayContext'
import { getContainerName } from './VueRelayContainerUtils'

import areEqual from 'fbjs/lib/areEqual'
import invariant from 'fbjs/lib/invariant'
import {
  createFragmentSpecResolver,
  getDataIDsFromObject,
  isScalarAndEqual
} from 'relay-runtime'

const createContainerWithFragments = function (component, fragments) {
  const containerName = getContainerName(component) + '-fragment-container'

  return {
    name: containerName,
    data () {
      const relayContext = assertRelayContext(this.props.__relayContext)
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
        prevProps: this.$props,
        prevPropsContext: relayContext,
        relayProp: getRelayProp(relayContext.environment),
        resolver
      }

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
            prevPropsContext: relayContext,
            prevProps: nextProps,
            relayProp: getRelayProp(relayContext.environment),
            resolver
          }
        } else {
          resolver.setProps(nextProps)

          const data = resolver.resolve()
          if (data !== prevState.data) {
            return {
              data,
              prevProps: nextProps,
              prevPropsContext: relayContext,
              relayProp: getRelayProp(relayContext.environment)
            }
          }
        }

        return null
      },
      shouldComponentUpdate (nextProps, nextState) {
        // Short-circuit if any Relay-related data has changed
        if (nextState.data !== this.state.data) {
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
      _handleFragmentDataUpdate () {
        const resolverFromThisUpdate = this.state.resolver
        this.setState(updatedState =>
          // If this event belongs to the current data source, update.
          // Otherwise we should ignore it.
          resolverFromThisUpdate === updatedState.resolver
            ? {
              data: updatedState.resolver.resolve(),
              relayProp: getRelayProp(updatedState.relayProp.environment)
            }
            : null
        )
      },
      _rerenderIfStoreHasChanged () {
        const { data, resolver } = this.state
        // External values could change between render and commit.
        // Check for this case, even though it requires an extra store read.
        const maybeNewData = resolver.resolve()
        if (data !== maybeNewData) {
          this.setState({ data: maybeNewData })
        }
      },
      _subscribeToNewResolver () {
        const { resolver } = this.state

        // Event listeners are only safe to add during the commit phase,
        // So they won't leak if render is interrupted or errors.
        resolver.setCallback(this._handleFragmentDataUpdate)
      }
    },
    mounted () {
      this._subscribeToNewResolver()
      this._rerenderIfStoreHasChanged()
    },
    updated () {
      if (this.state.resolver !== this.prevState.resolver) {
        this.prevState.resolver.dispose()

        this._subscribeToNewResolver()
      }
      this._rerenderIfStoreHasChanged()
    },
    beforeDestroy () {
      this.state.resolver.dispose()
    }
  }
}

function getRelayProp (environment) {
  return {
    environment
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
