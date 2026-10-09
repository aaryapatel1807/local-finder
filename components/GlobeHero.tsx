'use client'

import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * GlobeHero — 3D hero visual for the empty home state ("before first search").
 *
 * Fully procedural: one low-poly icosahedron globe (dark teal + wireframe
 * overlay), a single directional light + ambient light, and a map pin in the
 * app accent that drops in with a springy settle on mount, followed by a soft
 * pulsing ring at its base. No texture assets, no external geometry.
 *
 * prefers-reduced-motion: frameloop="never" renders a single static frame —
 * no rotation loop, pin placed at rest position, no ring pulse.
 */

const GLOBE_RADIUS = 1.35
const PIN_REST_Y = GLOBE_RADIUS + 0.62 // pin group origin sits above the pole
const PIN_START_Y = PIN_REST_Y + 1.7

const TEAL_DARK = '#0d3a44'
const TEAL_WIRE = '#2dd4bf'
const PIN_ACCENT = '#15B2CF' // app accent — replaces the trial's orange/purple

function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  return reduced
}

function Globe({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (reducedMotion || !group.current) return
    group.current.rotation.y += delta * 0.28 // gentle idle rotation only
  })

  return (
    <group ref={group} rotation={[0.35, 0.6, -0.12]}>
      {/* Dark teal low-poly body */}
      <mesh>
        <icosahedronGeometry args={[GLOBE_RADIUS, 1]} />
        <meshStandardMaterial color={TEAL_DARK} flatShading roughness={0.85} metalness={0.15} />
      </mesh>
      {/* Subtle teal wireframe overlay */}
      <mesh scale={1.002}>
        <icosahedronGeometry args={[GLOBE_RADIUS, 1]} />
        <meshBasicMaterial color={TEAL_WIRE} wireframe transparent opacity={0.32} />
      </mesh>
    </group>
  )
}

function Pin({ reducedMotion }: { reducedMotion: boolean }) {
  const pin = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(({ clock }) => {
    if (!pin.current) return
    const t = clock.getElapsedTime()

    if (reducedMotion) {
      pin.current.position.y = PIN_REST_Y
      if (ring.current) ring.current.visible = false
      return
    }

    // Springy drop: damped oscillation settling onto the rest position.
    const drop = PIN_START_Y - PIN_REST_Y
    const settle = Math.exp(-2.6 * t) * Math.cos(3.4 * Math.PI * t)
    pin.current.position.y = PIN_REST_Y + drop * settle

    // Soft pulsing ring at the pin base (starts once the pin has nearly landed).
    if (ring.current && ringMat.current) {
      const landed = Math.min(1, Math.max(0, (t - 0.45) / 0.6))
      const pulse = (Math.sin(t * 2.4) + 1) / 2
      const s = 1 + 0.45 * pulse
      ring.current.scale.set(s, s, 1)
      ringMat.current.opacity = landed * (0.25 + 0.45 * pulse)
    }
  })

  return (
    <>
      <group ref={pin} position={[0, reducedMotion ? PIN_REST_Y : PIN_START_Y, 0]}>
        {/* Cone pointing down — accent emissive tip */}
        <mesh position={[0, -0.21, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.17, 0.44, 24]} />
          <meshStandardMaterial
            color={PIN_ACCENT}
            emissive={PIN_ACCENT}
            emissiveIntensity={0.55}
            roughness={0.4}
          />
        </mesh>
        {/* Round head — accent emissive */}
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.16, 24, 24]} />
          <meshStandardMaterial
            color={PIN_ACCENT}
            emissive={PIN_ACCENT}
            emissiveIntensity={0.6}
            roughness={0.4}
          />
        </mesh>
      </group>
      {/* Pulse ring lying flat on the globe surface at the pin base */}
      <mesh ref={ring} position={[0, GLOBE_RADIUS + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.38, 48]} />
        <meshBasicMaterial ref={ringMat} color={PIN_ACCENT} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

export default function GlobeHero() {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none w-full select-none"
      style={{ height: 260 }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        camera={{ position: [0, 0.75, 4.6], fov: 42 }}
        frameloop={reducedMotion ? 'never' : 'always'}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 3, 5]} intensity={1.4} />
        <Globe reducedMotion={reducedMotion} />
        <Pin reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
