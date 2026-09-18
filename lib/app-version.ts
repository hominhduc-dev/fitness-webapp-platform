/**
 * The build stamp shown on the splash screen.
 *
 * `next.config.mjs` injects the two halves: the package version, and the commit
 * the build came from when the platform exposes one. Formatting lives here
 * rather than in the config so it stays typed and testable.
 */

const BUILD_REF_LENGTH = 7

export function formatAppVersion(version: string | undefined, buildRef: string | undefined) {
  const trimmedVersion = version?.trim()
  // A build that injected nothing shows nothing — an empty line under the logo
  // reads as a rendering bug.
  if (!trimmedVersion) return null

  const trimmedRef = buildRef?.trim().slice(0, BUILD_REF_LENGTH)
  return trimmedRef ? `${trimmedVersion} (${trimmedRef})` : trimmedVersion
}

export const APP_VERSION = formatAppVersion(
  process.env.NEXT_PUBLIC_APP_VERSION,
  process.env.NEXT_PUBLIC_BUILD_REF,
)
