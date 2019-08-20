function getComponentName (component) {
  return component
    ? component.name || 'component'
    : 'slot'
}

function getContainerName (component) {
  return 'relay-' + getComponentName(component)
}

export {
  getComponentName,
  getContainerName
}
