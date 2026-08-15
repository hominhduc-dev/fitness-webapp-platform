/**
 * SVG filter definitions for the liquid-glass material.
 *
 * The optical model is the one @ybouane/liquidglass implements in a WebGL
 * fragment shader — rim refraction, chromatic aberration, a soft edge falloff —
 * rebuilt out of SVG filter primitives so it can ride on `backdrop-filter`
 * instead of a canvas. Nothing is rasterized, so text stays selectable and the
 * DOM underneath keeps working normally.
 *
 * Only Chromium resolves `url(#id)` inside `backdrop-filter`; Safari parses it
 * and paints nothing, Firefox ignores it. The `data-liquid-glass` flag set by
 * the pre-paint probe in app/layout.tsx gates the CSS, so everyone else keeps
 * the plain blurred glass.
 */

/**
 * A displacement map is stretched onto its element with
 * `preserveAspectRatio="none"`, so the bevel band only stays an even thickness
 * if the map is authored at roughly the element's aspect ratio. One square map
 * shared by every surface would give the pill-shaped nav (~358x62) a 27px bevel
 * on its ends and 4.6px on its edges. Hence one geometry per surface shape —
 * the reference library gets the same result from `zRadius`, a bevel depth in
 * px that does not track panel size.
 */
type GlassGeometry = {
  /** Authoring size — only the ratio matters, the map is stretched to fit. */
  width: number
  height: number
  /**
   * Bevel depth in authoring px — the reference library's `zRadius`. Every
   * panel on its demo site sets `zRadius` equal to `cornerRadius`, so the bevel
   * band is as deep as the corner is round: a 90px-tall panel with a 40px
   * radius keeps only a 10px flat strip. Shallower than that and the glass
   * reads as a smudge on the rim rather than as a solid with thickness.
   */
  inset: number
  /** Corner radius of the flat interior, in authoring px. */
  radius: number
}

/**
 * One half of the displacement map. Each image paints a ramp in a single
 * channel — full intensity at one edge, 0 at the opposite one, crossing the
 * neutral 128 midpoint — then covers the middle with an inset rounded rect held
 * at that neutral value. Only the rim ends up carrying displacement, so the
 * centre of a panel stays optically flat the way real glass does.
 *
 * The two halves are summed inside the filter: R drives the x shift, G the y.
 */
function rampImage(axis: "x" | "y", channel: "r" | "g", geometry: GlassGeometry) {
  const { width, height, inset, radius } = geometry
  const horizontal = axis === "x"
  const edge = channel === "r" ? "#ff0000" : "#00ff00"
  const neutral = channel === "r" ? "#800000" : "#008000"

  // inset 0 leaves the ramp running edge to edge with no flat interior — what
  // the dome needs, since its whole face curves rather than just its rim.
  const interior =
    inset > 0
      ? `<rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" rx="${radius}" fill="${neutral}"/>`
      : ""

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="${horizontal ? 1 : 0}" y2="${horizontal ? 0 : 1}">` +
    `<stop offset="0" stop-color="${edge}"/>` +
    `<stop offset="0.5" stop-color="${neutral}"/>` +
    `<stop offset="1" stop-color="#000000"/>` +
    `</linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#g)"/>` +
    interior +
    `</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * Radial falloff for the dome. Grey at the centre rising to white at the rim,
 * used as the blend weight between "no displacement" and "full linear ramp".
 * The centre sits well above 0 so the middle of the lens still magnifies —
 * a profile starting at 0 would leave a dead flat spot in the middle of what
 * is supposed to be a glass ball.
 */
function domeProfile() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
    `<defs><radialGradient id="p" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="#595959"/>` +
    `<stop offset="0.55" stop-color="#737373"/>` +
    `<stop offset="0.82" stop-color="#b3b3b3"/>` +
    `<stop offset="1" stop-color="#ffffff"/>` +
    `</radialGradient></defs>` +
    `<rect width="120" height="120" fill="url(#p)"/>` +
    `</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

type GlassFilterProps = {
  id: string
  geometry: GlassGeometry
  /** Displacement strength in px — the reference library's `refraction`. */
  scale: number
  /** How far apart the per-channel passes sit, as a fraction of `scale`. The
   *  reference default is 0.05; past ~0.15 it stops reading as glass and starts
   *  reading as a broken video codec. Omit for a single cheap pass. */
  aberration?: number
  /** Softening of the map itself, in element px. Widens the bevel falloff. */
  softness?: number
}

function GlassFilter({ id, geometry, scale, aberration, softness = 1.4 }: GlassFilterProps) {
  const mapX = rampImage("x", "r", geometry)
  const mapY = rampImage("y", "g", geometry)

  // Wavelength-dependent index of refraction: red bends least, blue most.
  const passes = aberration
    ? { r: scale * (1 - aberration), g: scale, b: scale * (1 + aberration) }
    : null

  return (
    <filter id={id} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feImage href={mapX} preserveAspectRatio="none" result="mapX" />
      <feImage href={mapY} preserveAspectRatio="none" result="mapY" />
      <feComposite in="mapX" in2="mapY" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="mapRaw" />
      <feGaussianBlur in="mapRaw" stdDeviation={softness} result="map" />

      {passes ? (
        <>
          <feDisplacementMap in="SourceGraphic" in2="map" scale={passes.r} xChannelSelector="R" yChannelSelector="G" result="passR" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={passes.g} xChannelSelector="R" yChannelSelector="G" result="passG" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={passes.b} xChannelSelector="R" yChannelSelector="G" result="passB" />

          <feColorMatrix in="passR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="onlyR" />
          <feColorMatrix in="passG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="onlyG" />
          <feColorMatrix in="passB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="onlyB" />

          <feComposite in="onlyR" in2="onlyG" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg" />
          <feComposite in="rg" in2="onlyB" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </>
      ) : (
        <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
      )}
    </filter>
  )
}

/**
 * The dome — the reference library's `bevelMode: 1`, used there for a 60x60
 * floating magnifier at `refraction: 1.2` with no blur at all.
 *
 * A flat panel only bends light in a band around its rim, so its map is a ramp
 * with a neutral plateau in the middle. A dome curves the whole way across, so
 * its map has no plateau: it is the full-frame ramp blended toward neutral by a
 * radial profile, which is what puts real curvature in the middle of the lens
 * and a hard squeeze at its edge.
 *
 * The blend is written as a lerp — `ramp * P + neutral * (1 - P)` — rather than
 * the more obvious `neutral + (ramp - neutral) * P`, because filter primitives
 * clamp negatives to zero and half of `ramp - neutral` is negative. Lerping
 * keeps every intermediate non-negative.
 */
function DomeFilter({ id, scale }: { id: string; scale: number }) {
  const geometry: GlassGeometry = { width: 120, height: 120, inset: 0, radius: 0 }

  return (
    <filter id={id} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feImage href={rampImage("x", "r", geometry)} preserveAspectRatio="none" result="rampX" />
      <feImage href={rampImage("y", "g", geometry)} preserveAspectRatio="none" result="rampY" />
      <feComposite in="rampX" in2="rampY" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="ramp" />

      <feImage href={domeProfile()} preserveAspectRatio="none" result="profile" />
      <feFlood floodColor="rgb(128,128,0)" result="neutral" />

      {/* ramp * P */}
      <feComposite in="ramp" in2="profile" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="curved" />
      {/* 1 - P */}
      <feColorMatrix
        in="profile"
        type="matrix"
        values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"
        result="inverse"
      />
      {/* neutral * (1 - P) */}
      <feComposite in="neutral" in2="inverse" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="flat" />
      {/* sum the two halves of the lerp */}
      <feComposite in="curved" in2="flat" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="mapRaw" />

      <feGaussianBlur in="mapRaw" stdDeviation="0.8" result="map" />
      <feDisplacementMap in="SourceGraphic" in2="map" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  )
}

export function LiquidGlassFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* Mobile floating nav — a wide pill, measured 343x58 with a fully
            round radius (~29). Small and permanently on screen, so it is the
            one surface where three displacement passes are worth the frame
            time. Inset 26/62 leaves only a thin flat strip down the middle,
            which is what a pill-shaped bevel should look like. */}
        <GlassFilter
          id="lg-pill"
          geometry={{ width: 358, height: 62, inset: 26, radius: 5 }}
          scale={20}
          aberration={0.06}
          softness={1}
        />

        {/* Desktop sidebar — narrow and full height (measured 256x836,
            radius 24). Map authored at the exact element size, so the 24px
            inset lands at 24px on both axes. */}
        <GlassFilter
          id="lg-panel"
          geometry={{ width: 256, height: 836, inset: 24, radius: 4 }}
          scale={18}
        />

        {/* Dialogs, drawers, the AI chat panel — broadly landscape sheets. */}
        <GlassFilter
          id="lg-sheet"
          geometry={{ width: 512, height: 400, inset: 22, radius: 4 }}
          scale={20}
        />

        {/* Round glass ball for small circular controls. */}
        <DomeFilter id="lg-dome" scale={30} />
      </defs>
    </svg>
  )
}
