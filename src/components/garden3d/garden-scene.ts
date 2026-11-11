import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { PlantRankTier } from '@/lib/garden'
import { getGardenSize, seededRandom, type Plant3D } from '@/lib/garden3d'
import { getSignedPhotoUrl } from '@/lib/photos'
import type { ResolvedTheme } from '@/lib/theme'

/**
 * Cảnh Vườn 3D dựng bằng three.js thuần (không React) — React chỉ gọi
 * `setPlants` / `setTheme` / `resetView` / `dispose`.
 *
 * Cây sinh thủ tục từ dữ liệu (xem `toPlants3D`): chậu theo hạng, lá monstera vẽ bằng canvas
 * (đốm cẩm thạch + lỗ xẻ), thẻ polaroid cắm chậu hiện ảnh mới nhất trong Nhật ký.
 */

export type HoverInfo = { id: string; x: number; y: number; pinned: boolean } | null

type SceneOptions = {
  onHover: (info: HoverInfo) => void
  onSelect: (id: string) => void
  reducedMotion: boolean
}

type PlantNode = { id: string; foliage: THREE.Group; ring: THREE.Mesh; phase: number }

const BED_HEIGHT = 0.18
const FRAME_HEIGHT = 2.2
const LAMP_HEIGHT = 1.5
const TAP_TOLERANCE_PX = 6
const FIREFLY_COUNT = 70

const PALETTES = {
  light: {
    background: '#dde6d2',
    ground: '#cbc3a6',
    bedWood: '#8b6a48',
    bedTop: '#6b5a44',
    frame: '#f3eee1',
    hemiSky: '#fbf6e6',
    hemiGround: '#6f7d5c',
    hemiIntensity: 1.5,
    sun: '#fff0d4',
    sunIntensity: 2.6,
    sunDirection: new THREE.Vector3(0.6, 1, 0.45),
    lanternIntensity: 0,
    bulb: '#d8d2c2',
    ring: '#2f5d3a',
    exposure: 1,
  },
  dark: {
    background: '#0b1711',
    ground: '#132219',
    bedWood: '#3d2d20',
    bedTop: '#231a13',
    frame: '#2f4a3b',
    hemiSky: '#3b5b7a',
    hemiGround: '#0a1510',
    hemiIntensity: 1.1,
    sun: '#a9c2ff',
    sunIntensity: 0.9,
    sunDirection: new THREE.Vector3(-0.5, 1, -0.35),
    lanternIntensity: 5,
    bulb: '#ffd59a',
    ring: '#cde59a',
    exposure: 1.15,
  },
} as const

const POT_STYLES: Record<PlantRankTier, { color: string; roughness: number; metalness: number }> = {
  // Top 1: chậu men kem · Top 2: đất nung · Top 3: xi măng
  top1: { color: '#efe5cf', roughness: 0.32, metalness: 0.05 },
  top2: { color: '#b5623a', roughness: 0.85, metalness: 0 },
  top3: { color: '#8e928a', roughness: 0.95, metalness: 0 },
}

// ---------------------------------------------------------------------------
// Lá: texture vẽ bằng canvas + mặt cong
// ---------------------------------------------------------------------------

const makeLeafTexture = (seed: number, variegation: number, fenestrated: boolean) => {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const random = seededRandom(seed ^ 0x9e3779b9)

  // Lá hình tim: cuống ở dưới (128, 236), ngọn ở trên (128, 10)
  const outline = new Path2D()
  outline.moveTo(128, 236)
  outline.bezierCurveTo(96, 254, 6, 240, 10, 150)
  outline.bezierCurveTo(14, 70, 80, 18, 128, 10)
  outline.bezierCurveTo(176, 18, 242, 70, 246, 150)
  outline.bezierCurveTo(250, 240, 160, 254, 128, 236)
  outline.closePath()

  context.save()
  context.clip(outline)
  const base = context.createRadialGradient(128, 160, 10, 128, 140, 150)
  base.addColorStop(0, '#46944f')
  base.addColorStop(1, '#22583a')
  context.fillStyle = base
  context.fillRect(0, 0, size, size)

  // Đốm cẩm thạch (Albo / Thai…) — đôi khi nửa lá trắng ("half moon")
  if (variegation > 0.02) {
    if (random() < variegation * 0.5) {
      context.fillStyle = 'rgba(243, 238, 217, 0.95)'
      context.fillRect(random() < 0.5 ? 0 : 128, 0, 128, size)
    }
    const splashes = Math.round(4 + variegation * 34)
    for (let index = 0; index < splashes; index++) {
      context.fillStyle = random() < 0.6 ? 'rgba(243, 238, 217, 0.92)' : 'rgba(214, 230, 186, 0.85)'
      context.beginPath()
      context.ellipse(
        random() * size,
        random() * size,
        4 + random() * (8 + variegation * 50),
        2 + random() * (4 + variegation * 18),
        random() * Math.PI,
        0,
        Math.PI * 2,
      )
      context.fill()
    }
  }

  // Gân lá
  context.strokeStyle = 'rgba(214, 238, 196, 0.55)'
  context.lineWidth = 4
  context.beginPath()
  context.moveTo(128, 236)
  context.lineTo(128, 16)
  context.stroke()
  context.lineWidth = 2
  context.strokeStyle = 'rgba(214, 238, 196, 0.32)'
  for (let vein = 0; vein < 8; vein++) {
    const y = 210 - vein * 24
    for (const side of [-1, 1]) {
      context.beginPath()
      context.moveTo(128, y)
      context.quadraticCurveTo(128 + side * 50, y - 6, 128 + side * 124, y - 42)
      context.stroke()
    }
  }
  context.restore()

  context.strokeStyle = 'rgba(18, 52, 30, 0.55)'
  context.lineWidth = 3
  context.stroke(outline)

  // Lỗ xẻ của lá monstera trưởng thành — khoét trong suốt giữa các gân
  if (fenestrated) {
    context.globalCompositeOperation = 'destination-out'
    context.lineCap = 'round'
    context.lineWidth = 9
    for (let slit = 1; slit < 7; slit++) {
      const y = 210 - slit * 24 - 12
      for (const side of [-1, 1]) {
        context.beginPath()
        context.moveTo(128 + side * (58 + random() * 14), y)
        context.lineTo(128 + side * 136, y - 38)
        context.stroke()
      }
    }
    context.globalCompositeOperation = 'source-over'
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Mặt lá 1×1: cuống ở gốc toạ độ, ngọn hướng +X, mặt trên hướng +Y, hơi khum + cong ngọn. */
const makeLeafGeometry = (cup: number, curl: number) => {
  const geometry = new THREE.PlaneGeometry(1, 1, 8, 8)
  geometry.translate(0, 0.5, 0)
  const position = geometry.attributes.position
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const y = position.getY(index)
    position.setZ(index, -(cup * x * x + curl * y * y))
  }
  geometry.rotateX(-Math.PI / 2)
  geometry.rotateY(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

const makeFireflySprite = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')!
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(0.25, 'rgba(255,255,255,0.6)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = glow
  context.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Thanh gỗ / khung thép nối 2 điểm. */
const makeBeam = (from: THREE.Vector3, to: THREE.Vector3, thickness: number, material: THREE.Material) => {
  const beam = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, from.distanceTo(to)), material)
  beam.position.copy(from).add(to).multiplyScalar(0.5)
  beam.lookAt(to)
  return beam
}

/** Giải phóng geometry / material / texture của một nhánh cảnh, trừ material dùng chung. */
const disposeTree = (root: THREE.Object3D, keep: Set<THREE.Material>) => {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of materials) {
      if (keep.has(material)) continue
      ;(material as THREE.MeshStandardMaterial).map?.dispose()
      material.dispose()
    }
  })
}

// ---------------------------------------------------------------------------
// Cảnh
// ---------------------------------------------------------------------------

export class GardenScene {
  private readonly container: HTMLElement
  private readonly options: SceneOptions
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
  private readonly controls: OrbitControls
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly resizeObserver: ResizeObserver
  private readonly textureLoader = new THREE.TextureLoader()

  private readonly hemiLight = new THREE.HemisphereLight()
  private readonly sun = new THREE.DirectionalLight()
  private readonly ground: THREE.Mesh

  // Material dùng chung — đổi màu theo giao diện, không huỷ khi dựng lại vườn
  private readonly groundMaterial = new THREE.MeshStandardMaterial({ roughness: 1 })
  private readonly bedWoodMaterial = new THREE.MeshStandardMaterial({ roughness: 0.85 })
  private readonly bedTopMaterial = new THREE.MeshStandardMaterial({ roughness: 1 })
  private readonly frameMaterial = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3 })
  private readonly bulbMaterial = new THREE.MeshBasicMaterial()
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 })
  private readonly hitMaterial = new THREE.MeshBasicMaterial({ visible: false })
  private readonly fireflyMaterial: THREE.PointsMaterial
  private readonly sharedMaterials: Set<THREE.Material>

  /** Luống + khung nhà kính + đèn — dựng lại khi kích thước vườn đổi. */
  private structure = new THREE.Group()
  private plantsGroup = new THREE.Group()
  private fireflies: THREE.Points | null = null
  private fireflyBase: Float32Array = new Float32Array()
  private lanterns: THREE.PointLight[] = []
  /** Thanh khung nhà kính + trung điểm — thanh nằm giữa camera và vườn sẽ ẩn để không che cây. */
  private frameBeams: { mesh: THREE.Mesh; mid: THREE.Vector3 }[] = []
  private readonly viewDirection = new THREE.Vector3()
  private nodes: PlantNode[] = []
  private hitMeshes: THREE.Mesh[] = []

  private theme: ResolvedTheme = 'light'
  private radius = 2
  private hoveredId: string | null = null
  private pointerDown: { x: number; y: number } | null = null
  /** Tăng mỗi lần dựng lại cây → ảnh tải về muộn của lượt cũ bị bỏ qua. */
  private generation = 0
  private disposed = false

  constructor(container: HTMLElement, options: SceneOptions) {
    this.container = container
    this.options = options

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    container.appendChild(this.renderer.domElement)

    this.textureLoader.setCrossOrigin('anonymous')

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = 1.42
    this.controls.minDistance = 1.5
    this.controls.autoRotate = !options.reducedMotion
    this.controls.autoRotateSpeed = 0.35
    // Người dùng tự xoay → thôi tự quay
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false
    })

    this.sun.castShadow = true
    this.sun.shadow.mapSize.setScalar(window.innerWidth < 768 ? 1024 : 2048)
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.hemiLight, this.sun, this.sun.target)

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48).rotateX(-Math.PI / 2), this.groundMaterial)
    this.ground.receiveShadow = true
    this.scene.add(this.ground, this.structure, this.plantsGroup)

    this.fireflyMaterial = new THREE.PointsMaterial({
      size: 0.09,
      map: makeFireflySprite(),
      color: '#e9ff9a',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.sharedMaterials = new Set<THREE.Material>([
      this.groundMaterial,
      this.bedWoodMaterial,
      this.bedTopMaterial,
      this.frameMaterial,
      this.bulbMaterial,
      this.ringMaterial,
      this.hitMaterial,
      this.fireflyMaterial,
    ])

    const canvas = this.renderer.domElement
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointerleave', this.handlePointerLeave)

    this.resizeObserver = new ResizeObserver(this.resize)
    this.resizeObserver.observe(container)
    this.resize()

    this.setTheme('light')
    this.renderer.setAnimationLoop(this.tick)
  }

  // -------------------------------------------------------------------------
  // API cho React
  // -------------------------------------------------------------------------

  setTheme(theme: ResolvedTheme) {
    this.theme = theme
    const palette = PALETTES[theme]
    this.scene.background = new THREE.Color(palette.background)
    this.scene.fog = new THREE.Fog(palette.background, this.radius * 3 + 6, this.radius * 7 + 18)
    this.renderer.toneMappingExposure = palette.exposure
    this.hemiLight.color.set(palette.hemiSky)
    this.hemiLight.groundColor.set(palette.hemiGround)
    this.hemiLight.intensity = palette.hemiIntensity
    this.sun.color.set(palette.sun)
    this.sun.intensity = palette.sunIntensity
    this.groundMaterial.color.set(palette.ground)
    this.bedWoodMaterial.color.set(palette.bedWood)
    this.bedTopMaterial.color.set(palette.bedTop)
    this.frameMaterial.color.set(palette.frame)
    this.bulbMaterial.color.set(palette.bulb)
    this.ringMaterial.color.set(palette.ring)
    for (const lantern of this.lanterns) {
      lantern.intensity = palette.lanternIntensity
    }
    if (this.fireflies) {
      this.fireflies.visible = theme === 'dark'
    }
    this.placeSun()
  }

  setPlants(plants: Plant3D[]) {
    this.generation++
    this.setHovered(null)
    this.options.onHover(null)

    disposeTree(this.plantsGroup, this.sharedMaterials)
    this.plantsGroup.clear()
    this.nodes = []
    this.hitMeshes = []

    const { width, depth } = getGardenSize(plants)
    this.radius = Math.hypot(width, depth) / 2
    this.buildStructure(width, depth)

    for (const plant of plants) {
      this.buildPlant(plant)
    }

    this.setTheme(this.theme)
    this.resetView()
  }

  resetView() {
    const distance = this.radius * 1.7 + 3.2
    this.camera.position.set(0, distance * 0.62, distance * 0.82)
    this.controls.target.set(0, 0.75, 0)
    this.controls.maxDistance = distance * 2.2
    this.controls.update()
  }

  dispose() {
    this.disposed = true
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointerdown', this.handlePointerDown)
    canvas.removeEventListener('pointerup', this.handlePointerUp)
    canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    this.controls.dispose()
    disposeTree(this.scene, new Set())
    this.fireflyMaterial.map?.dispose()
    this.renderer.dispose()
    canvas.remove()
  }

  // -------------------------------------------------------------------------
  // Dựng cảnh
  // -------------------------------------------------------------------------

  private buildStructure(width: number, depth: number) {
    disposeTree(this.structure, this.sharedMaterials)
    this.structure.clear()
    this.lanterns = []

    // Luống gỗ + mặt đất trồng
    const bed = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, BED_HEIGHT, depth + 1.2), this.bedWoodMaterial)
    bed.position.y = BED_HEIGHT / 2
    bed.receiveShadow = true
    bed.castShadow = true
    const bedTop = new THREE.Mesh(new THREE.BoxGeometry(width + 1, 0.02, depth + 1), this.bedTopMaterial)
    bedTop.position.y = BED_HEIGHT + 0.005
    bedTop.receiveShadow = true
    this.structure.add(bed, bedTop)

    // Khung nhà kính: cột + viền trên (không mái — mái cắt ngang tầm nhìn)
    this.frameBeams = []
    const halfWidth = width / 2 + 1.2
    const halfDepth = depth / 2 + 1.2
    const addBeam = (from: THREE.Vector3, to: THREE.Vector3) => {
      const mesh = makeBeam(from, to, 0.06, this.frameMaterial)
      this.frameBeams.push({ mesh, mid: mesh.position.clone() })
      this.structure.add(mesh)
    }
    const baysX = Math.max(1, Math.round((halfWidth * 2) / 2.6))
    const baysZ = Math.max(1, Math.round((halfDepth * 2) / 2.6))
    const corners: [number, number][] = [
      [-halfWidth, -halfDepth],
      [halfWidth, -halfDepth],
      [halfWidth, halfDepth],
      [-halfWidth, halfDepth],
    ]
    corners.forEach(([x1, z1], index) => {
      const [x2, z2] = corners[(index + 1) % 4]
      const bays = x1 === x2 ? baysZ : baysX
      for (let bay = 0; bay < bays; bay++) {
        const x = x1 + ((x2 - x1) * bay) / bays
        const z = z1 + ((z2 - z1) * bay) / bays
        addBeam(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, FRAME_HEIGHT, z))
      }
      addBeam(new THREE.Vector3(x1, FRAME_HEIGHT, z1), new THREE.Vector3(x2, FRAME_HEIGHT, z2))
    })

    // Cột đèn vườn ở 4 góc luống — chỉ sáng ở chế độ tối
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      const x = sx * (width / 2 + 0.45)
      const z = sz * (depth / 2 + 0.45)
      const pole = makeBeam(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, LAMP_HEIGHT, z), 0.04, this.frameMaterial)
      pole.castShadow = true
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), this.bulbMaterial)
      bulb.position.set(x, LAMP_HEIGHT + 0.06, z)
      const light = new THREE.PointLight('#ffc27a', 0, 0, 2)
      light.position.set(x, LAMP_HEIGHT + 0.06, z)
      this.lanterns.push(light)
      this.structure.add(pole, bulb, light)
    }

    // Đom đóm
    const positions = new Float32Array(FIREFLY_COUNT * 3)
    const random = seededRandom(42)
    for (let index = 0; index < FIREFLY_COUNT; index++) {
      positions[index * 3] = (random() - 0.5) * (width + 2.5)
      positions[index * 3 + 1] = 0.4 + random() * 2
      positions[index * 3 + 2] = (random() - 0.5) * (depth + 2.5)
    }
    this.fireflyBase = positions.slice()
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.fireflies = new THREE.Points(geometry, this.fireflyMaterial)
    this.structure.add(this.fireflies)
  }

  private buildPlant(plant: Plant3D) {
    const random = seededRandom(plant.seed)
    const rank = plant.rankScore
    const root = new THREE.Group()
    root.position.set(plant.x, BED_HEIGHT, plant.z)

    // Chậu (tiện tròn)
    const potScale = 0.85 + rank * 0.025
    const potHeight = 0.42 * potScale
    const potRadius = 0.3 * potScale
    const profile = [
      [0, 0],
      [0.22, 0],
      [0.25, 0.03],
      [0.29, 0.37],
      [0.32, 0.38],
      [0.32, 0.44],
      [0.29, 0.44],
      [0.28, 0.4],
    ].map(([x, y]) => new THREE.Vector2(x * potScale, y * potScale))
    const potStyle = POT_STYLES[plant.tier]
    const pot = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 32),
      new THREE.MeshStandardMaterial({ ...potStyle, side: THREE.DoubleSide }),
    )
    pot.castShadow = true
    pot.receiveShadow = true
    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(0.28 * potScale, 24).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#3a2a1d', roughness: 1 }),
    )
    soil.position.y = potHeight * 0.9
    soil.receiveShadow = true
    root.add(pot, soil)

    // Tán lá: lá cũ thấp & xoè rộng, lá mới cao ở giữa (xoay theo góc vàng)
    const foliage = new THREE.Group()
    foliage.position.y = potHeight * 0.9
    foliage.rotation.y = random() * Math.PI * 2
    const height = 0.35 + rank * 0.11
    const leafSize = 0.3 + rank * 0.03
    const droop = plant.isStale ? 0.6 : 0
    const leafMaterial = new THREE.MeshStandardMaterial({
      map: makeLeafTexture(plant.seed, plant.variegation, rank >= 5),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.55,
    })
    const leafGeometry = makeLeafGeometry(0.5, 0.3)
    const stemMaterial = new THREE.MeshStandardMaterial({ color: plant.isStale ? '#7a8a4a' : '#4f7f45', roughness: 0.7 })
    const count = plant.leafCount

    for (let index = 0; index < count; index++) {
      const t = count > 1 ? index / (count - 1) : 1
      const pivot = new THREE.Group()
      pivot.rotation.y = index * 2.39996
      const tipY = height * (0.25 + 0.75 * t) * (1 - droop * 0.3)
      const reach = leafSize * (0.15 + 0.45 * (1 - t)) + 0.05
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(reach * 0.1, tipY * 0.7, 0),
        new THREE.Vector3(reach, tipY, 0),
      )
      const petiole = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.012 * potScale, 5), stemMaterial)
      petiole.castShadow = true

      const leaf = new THREE.Mesh(leafGeometry, leafMaterial)
      leaf.position.set(reach, tipY, 0)
      const tilt = 0.15 + 0.55 * t - droop * (1 - t * 0.5) + (random() - 0.5) * 0.2
      leaf.rotation.set((random() - 0.5) * 0.4, 0, tilt)
      leaf.scale.setScalar(leafSize * (0.75 + 0.3 * t) * (0.9 + random() * 0.2))
      leaf.castShadow = true
      leaf.receiveShadow = true

      pivot.add(petiole, leaf)
      foliage.add(pivot)
    }
    root.add(foliage)

    // Thẻ polaroid cắm chậu — ảnh mới nhất trong Nhật ký
    if (plant.coverPath) {
      root.add(this.buildPhotoTag(plant.coverPath, potHeight, potRadius, random))
    }

    // Vòng sáng khi rê chuột + khối vô hình để bắt chuột
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(potRadius + 0.1, potRadius + 0.17, 48).rotateX(-Math.PI / 2),
      this.ringMaterial,
    )
    ring.position.y = 0.025
    ring.visible = false
    const totalHeight = potHeight + height + leafSize
    const hitRadius = Math.max(potRadius + 0.12, leafSize * 0.85)
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(hitRadius, hitRadius, totalHeight, 12), this.hitMaterial)
    hit.position.y = totalHeight / 2
    hit.userData.plantId = plant.id
    root.add(ring, hit)

    this.plantsGroup.add(root)
    this.hitMeshes.push(hit)
    this.nodes.push({ id: plant.id, foliage, ring, phase: random() * Math.PI * 2 })
  }

  private buildPhotoTag(path: string, potHeight: number, potRadius: number, random: () => number) {
    const tag = new THREE.Group()
    tag.position.set((random() - 0.5) * 0.12, potHeight * 0.9, potRadius * 0.72)
    tag.rotation.set(-0.22, (random() - 0.5) * 0.4, 0)

    const stakeMaterial = new THREE.MeshStandardMaterial({ color: '#b08a5a', roughness: 0.9 })
    const stake = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.3, 0.016), stakeMaterial)
    stake.position.y = 0.15
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.24, 0.008),
      new THREE.MeshStandardMaterial({ color: '#faf7ef', roughness: 0.7 }),
    )
    card.position.y = 0.36
    card.castShadow = true
    const photoMaterial = new THREE.MeshStandardMaterial({ color: '#cfdcb8', roughness: 0.6 })
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), photoMaterial)
    photo.position.set(0, 0.375, 0.0045)
    tag.add(stake, card, photo)

    const generation = this.generation
    getSignedPhotoUrl(path)
      .then((url) => this.textureLoader.loadAsync(url))
      .then((texture) => {
        if (this.disposed || generation !== this.generation) {
          texture.dispose()
          return
        }
        // Cắt giữa ảnh thành hình vuông (giống object-fit: cover)
        const image = texture.image as { width: number; height: number }
        const aspect = image.width / image.height
        if (aspect > 1) {
          texture.repeat.set(1 / aspect, 1)
          texture.offset.set((1 - 1 / aspect) / 2, 0)
        } else {
          texture.repeat.set(1, aspect)
          texture.offset.set(0, (1 - aspect) / 2)
        }
        texture.colorSpace = THREE.SRGBColorSpace
        photoMaterial.map = texture
        photoMaterial.color.set('#ffffff')
        photoMaterial.needsUpdate = true
      })
      .catch(() => {
        // Không tải được ảnh → giữ thẻ màu lá
      })
    return tag
  }

  private placeSun() {
    const reach = this.radius + 3
    this.sun.position.copy(PALETTES[this.theme].sunDirection).normalize().multiplyScalar(reach * 2.5)
    this.sun.target.position.set(0, 0, 0)
    const shadow = this.sun.shadow.camera
    shadow.left = -reach
    shadow.right = reach
    shadow.top = reach
    shadow.bottom = -reach
    shadow.near = 0.5
    shadow.far = reach * 5
    shadow.updateProjectionMatrix()
  }

  // -------------------------------------------------------------------------
  // Vòng lặp + tương tác
  // -------------------------------------------------------------------------

  private tick = (time: number) => {
    const seconds = time / 1000
    if (!this.options.reducedMotion) {
      // Lá đung đưa nhẹ
      for (const node of this.nodes) {
        node.foliage.rotation.z = Math.sin(seconds * 0.9 + node.phase) * 0.025
        node.foliage.rotation.x = Math.sin(seconds * 0.7 + node.phase * 1.3) * 0.02
      }
      if (this.fireflies?.visible) {
        const positions = this.fireflies.geometry.attributes.position as THREE.BufferAttribute
        const base = this.fireflyBase
        for (let index = 0; index < positions.count; index++) {
          const phase = index * 1.7
          positions.setXYZ(
            index,
            base[index * 3] + Math.sin(seconds * 0.4 + phase) * 0.35,
            base[index * 3 + 1] + Math.sin(seconds * 0.6 + phase * 2) * 0.25,
            base[index * 3 + 2] + Math.cos(seconds * 0.35 + phase) * 0.35,
          )
        }
        positions.needsUpdate = true
        this.fireflyMaterial.opacity = 0.65 + Math.sin(seconds * 2.2) * 0.3
      }
    }
    this.controls.update()
    this.hideFrontBeams()
    this.renderer.render(this.scene, this.camera)
  }

  private hideFrontBeams() {
    this.viewDirection.subVectors(this.camera.position, this.controls.target).setY(0).normalize()
    const limit = this.radius * 0.35
    for (const { mesh, mid } of this.frameBeams) {
      mesh.visible = mid.x * this.viewDirection.x + mid.z * this.viewDirection.z < limit
    }
  }

  private resize = () => {
    const width = Math.max(1, this.container.clientWidth)
    const height = Math.max(1, this.container.clientHeight)
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private pick(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.raycaster.intersectObjects(this.hitMeshes, false)[0]
    return {
      id: (hit?.object.userData.plantId as string | undefined) ?? null,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  private setHovered(id: string | null) {
    if (id === this.hoveredId) return
    this.hoveredId = id
    for (const node of this.nodes) {
      node.ring.visible = node.id === id
    }
    this.renderer.domElement.style.cursor = id ? 'pointer' : ''
  }

  private handlePointerMove = (event: PointerEvent) => {
    // Cảm ứng: chỉ chạm (tap) mới chọn cây, kéo là xoay camera
    if (event.pointerType !== 'mouse' || event.buttons !== 0) return
    const { id, x, y } = this.pick(event)
    this.setHovered(id)
    this.options.onHover(id ? { id, x, y, pinned: false } : null)
  }

  private handlePointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY }
  }

  private handlePointerUp = (event: PointerEvent) => {
    const down = this.pointerDown
    this.pointerDown = null
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_TOLERANCE_PX) return
    const { id, x, y } = this.pick(event)
    if (event.pointerType === 'mouse') {
      if (id) this.options.onSelect(id)
      return
    }
    // Chạm: hiện thẻ cây (có nút mở), chạm chỗ trống để ẩn
    this.setHovered(id)
    this.options.onHover(id ? { id, x, y, pinned: true } : null)
  }

  private handlePointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    this.setHovered(null)
    this.options.onHover(null)
  }
}
