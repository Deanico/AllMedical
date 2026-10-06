const PRODUCTION_HOSTS = new Set([
  'insulinpumpsupply.com',
  'www.insulinpumpsupply.com'
])

export const getPortalRedirectUrl = () => {
  const hostname = window.location.hostname.toLowerCase()
  const origin = PRODUCTION_HOSTS.has(hostname)
    ? 'https://www.insulinpumpsupply.com'
    : window.location.origin

  return `${origin}/portal`
}
