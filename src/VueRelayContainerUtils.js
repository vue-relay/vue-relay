function getComponentName (component) {
  return component
    ? component.name || 'component'
    : 'template'
}

function getContainerName (component) {
  return 'relay-' + getComponentName(component)
}

export {
  getComponentName,
  getContainerName
}
