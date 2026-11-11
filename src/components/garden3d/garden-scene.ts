import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildTerrace, makeBeam, type Terrace } from '@/components/garden3d/terrace'
import { seededRandom, type Plant3D } from '@/lib/garden3d'
import { getSignedPhotoUrl } from '@/lib/photos'
import type { PotKind } from '@/lib/terrace-layout'
import type { ResolvedTheme } from '@/lib/theme'

/**
 * Cảnh Vườn 3D dựng bằng three.js thuần (không React) — React chỉ gọi
 * `setPlants` / `setTheme` / `resetView` / `dispose`.
 *
 * Nền là sân thượng thật dựng lại từ ảnh (`terrace.ts`); mỗi cây trong kho được đặt vào một chỗ
 * (`terrace-layout.ts`). Cây sinh thủ tục từ dữ liệu: lá monstera vẽ bằng canvas
 * (đốm cẩm thạch + lỗ xẻ), thẻ polaroid cắm chậu hiện ảnh mới nhất trong Nhật ký.
 */

export type HoverInfo = { id: string; x: number; y: number; pinned: boolean } | null

type SceneOptions = {
  onHover: (info: HoverInfo) => void
  onSelect: (id: string) => void
  reducedMotion: boolean
}

type PlantNode = { id: string; foliage: THREE.Group; ring: THREE.Mesh; phase: number }

const TAP_TOLERANCE_PX = 6
const FIREFLY_COUNT = 45
/** Tâm nhìn: giữa góc chính và góc mái che */
const VIEW_TARGET = new THREE.Vector3(0.1, 0.9, -0.8)
/** Giới hạn góc xoay ngang — ra ngoài sẽ nhìn thấy mặt sau tường */
const AZIMUTH_LIMIT = 0.9

const PALETTES = {
  light: {
    background: '#cfdfe4',
    hemiSky: '#f4f7f2',
    hemiGround: '#7b7f70',
    hemiIntensity: 1.4,
    sun: '#fff0d4',
    sunIntensity: 2.8,
    sunDirection: new THREE.Vector3(0.45, 1, 0.8),
    lampIntensity: 0,
    bulb: '#d8d2c2',
    ring: '#2f5d3a',
    exposure: 1,
  },
  dark: {
    background: '#0b1520',
    hemiSky: '#3b5b7a',
    hemiGround: '#0a1510',
    hemiIntensity: 1.1,
    sun: '#a9c2ff',
    sunIntensity: 0.8,
    sunDirection: new THREE.Vector3(-0.4, 1, 0.5),
    lampIntensity: 4,
    bulb: '#ffd59a',
    ring: '#cde59a',
    exposure: 1.15,
  },
} as const

const POT_STYLES: Record<PotKind, { color: string; roughness: number; metalness: number }> = {
  nursery: { color: '#1c1d1c', roughness: 0.55, metalness: 0 },
  white: { color: '#ecebe5', roughness: 0.45, metalness: 0 },
  terracotta: { color: '#a8552f', roughness: 0.85, metalness: 0 },
  glazed: { color: '#2c524c', roughness: 0.25, metalness: 0.1 },
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
  private readonly terrace: Terrace

  // Material dùng chung — không huỷ khi dựng lại cây
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 })
  private readonly hitMaterial = new THREE.MeshBasicMaterial({ visible: false })
  private readonly wireMaterial = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6 })
  private readonly holderMaterial = new THREE.MeshStandardMaterial({ color: '#a8552f', roughness: 0.85 })
  private readonly fireflyMaterial: THREE.PointsMaterial
  private readonly sharedMaterials: Set<THREE.Material>

  private plantsGroup = new THREE.Group()
  private fireflies: THREE.Points
  private fireflyBase: Float32Array
  private nodes: PlantNode[] = []
  private hitMeshes: THREE.Mesh[] = []

  private theme: ResolvedTheme = 'light'
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
    this.controls.maxPolarAngle = 1.38
    this.controls.minDistance = 1.2
    this.controls.maxDistance = 9
    this.controls.minAzimuthAngle = -AZIMUTH_LIMIT
    this.controls.maxAzimuthAngle = AZIMUTH_LIMIT
    this.controls.autoRotate = !options.reducedMotion
    this.controls.autoRotateSpeed = 0.3
    // Người dùng tự xoay → thôi tự quay
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false
    })

    this.sun.castShadow = true
    this.sun.shadow.mapSize.setScalar(window.innerWidth < 768 ? 1024 : 2048)
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.02
    const shadow = this.sun.shadow.camera
    shadow.left = -5.5
    shadow.right = 5.5
    shadow.top = 5.5
    shadow.bottom = -5.5
    shadow.near = 0.5
    shadow.far = 30
    shadow.updateProjectionMatrix()
    this.scene.add(this.hemiLight, this.sun, this.sun.target)

    this.terrace = buildTerrace()
    this.scene.add(this.terrace.group, this.plantsGroup)

    // Đom đóm trên sân (chỉ hiện ở chế độ tối)
    this.fireflyMaterial = new THREE.PointsMaterial({
      size: 0.07,
      map: makeFireflySprite(),
      color: '#e9ff9a',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const positions = new Float32Array(FIREFLY_COUNT * 3)
    const random = seededRandom(42)
    for (let index = 0; index < FIREFLY_COUNT; index++) {
      positions[index * 3] = -2.6 + random() * 6.2
      positions[index * 3 + 1] = 0.4 + random() * 1.8
      positions[index * 3 + 2] = -1.7 + random() * 4.5
    }
    this.fireflyBase = positions.slice()
    const fireflyGeometry = new THREE.BufferGeometry()
    fireflyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.fireflies = new THREE.Points(fireflyGeometry, this.fireflyMaterial)
    this.scene.add(this.fireflies)

    this.sharedMaterials = new Set<THREE.Material>([
      this.ringMaterial,
      this.hitMaterial,
      this.wireMaterial,
      this.holderMaterial,
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
    this.resetView()
    this.renderer.setAnimationLoop(this.tick)
  }

  // -------------------------------------------------------------------------
  // API cho React
  // -------------------------------------------------------------------------

  setTheme(theme: ResolvedTheme) {
    this.theme = theme
    const palette = PALETTES[theme]
    this.scene.background = new THREE.Color(palette.background)
    this.scene.fog = new THREE.Fog(palette.background, 12, 30)
    this.renderer.toneMappingExposure = palette.exposure
    this.hemiLight.color.set(palette.hemiSky)
    this.hemiLight.groundColor.set(palette.hemiGround)
    this.hemiLight.intensity = palette.hemiIntensity
    this.sun.color.set(palette.sun)
    this.sun.intensity = palette.sunIntensity
    this.sun.position.copy(palette.sunDirection).normalize().multiplyScalar(14)
    this.sun.target.position.set(0.5, 0, 0)
    this.terrace.bulbMaterial.color.set(palette.bulb)
    this.ringMaterial.color.set(palette.ring)
    for (const lamp of this.terrace.lamps) {
      lamp.intensity = palette.lampIntensity
    }
    this.fireflies.visible = theme === 'dark'
  }

  setPlants(plants: Plant3D[]) {
    this.generation++
    this.setHovered(null)
    this.options.onHover(null)

    disposeTree(this.plantsGroup, this.sharedMaterials)
    this.plantsGroup.clear()
    this.nodes = []
    this.hitMeshes = []

    for (const plant of plants) {
      this.buildPlant(plant)
    }
  }

  resetView() {
    this.camera.position.set(2.4, 3.2, 4.6)
    this.controls.target.copy(VIEW_TARGET)
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
    this.renderer.dispose()
    canvas.remove()
  }

  // -------------------------------------------------------------------------
  // Dựng cây
  // -------------------------------------------------------------------------

  private buildPlant(plant: Plant3D) {
    const random = seededRandom(plant.seed)
    const rank = plant.rankScore
    const { slot } = plant
    const root = new THREE.Group()
    root.position.set(slot.x, slot.y, slot.z)
    root.scale.setScalar(slot.scale)

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
    const pot = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 32),
      new THREE.MeshStandardMaterial({ ...POT_STYLES[slot.pot], side: THREE.DoubleSide }),
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

    // Chậu treo: vòng đỡ đất nung + 3 dây lên móc
    if (slot.hanging) {
      const holder = new THREE.Mesh(new THREE.TorusGeometry(potRadius + 0.02, 0.025, 8, 32).rotateX(Math.PI / 2), this.holderMaterial)
      holder.position.y = potHeight * 0.75
      const hook = new THREE.Vector3(0, potHeight + 0.75, 0)
      root.add(holder)
      for (let index = 0; index < 3; index++) {
        const angle = (index / 3) * Math.PI * 2
        const rim = new THREE.Vector3(Math.cos(angle) * potRadius, potHeight * 0.75, Math.sin(angle) * potRadius)
        root.add(makeBeam(rim, hook, 0.008, this.wireMaterial))
      }
    }

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

    // Thẻ polaroid cắm chậu — ảnh mới nhất trong Nhật ký (bỏ qua chậu nhỏ / chậu treo cho đỡ rối)
    if (plant.coverPath && !slot.hanging && slot.scale >= 0.6) {
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
      if (this.fireflies.visible) {
        const positions = this.fireflies.geometry.attributes.position as THREE.BufferAttribute
        const base = this.fireflyBase
        for (let index = 0; index < positions.count; index++) {
          const phase = index * 1.7
          positions.setXYZ(
            index,
            base[index * 3] + Math.sin(seconds * 0.4 + phase) * 0.3,
            base[index * 3 + 1] + Math.sin(seconds * 0.6 + phase * 2) * 0.2,
            base[index * 3 + 2] + Math.cos(seconds * 0.35 + phase) * 0.3,
          )
        }
        positions.needsUpdate = true
        this.fireflyMaterial.opacity = 0.65 + Math.sin(seconds * 2.2) * 0.3
      }
    }

    // Tự quay qua lại trong giới hạn góc nhìn
    if (this.controls.autoRotate && Math.abs(this.controls.getAzimuthalAngle()) > AZIMUTH_LIMIT - 0.02) {
      this.controls.autoRotateSpeed = -Math.sign(this.controls.getAzimuthalAngle()) * Math.abs(this.controls.autoRotateSpeed)
    }
    this.controls.update()

    // Camera ở trên lưới / mái → làm mờ để nhìn xuyên xuống cây
    for (const canopy of this.terrace.canopies) {
      const target = this.camera.position.y > canopy.height + 0.15 ? canopy.faded : canopy.opacity
      canopy.material.opacity += (target - canopy.material.opacity) * 0.12
      canopy.material.visible = canopy.material.opacity > 0.03
    }

    this.renderer.render(this.scene, this.camera)
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
