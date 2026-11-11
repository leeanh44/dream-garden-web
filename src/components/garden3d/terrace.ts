import * as THREE from 'three'
import { seededRandom } from '@/lib/garden3d'
import { LEDGE_Y, SHELF_Y } from '@/lib/terrace-layout'

/**
 * Cảnh nền sân thượng — dựng lại từ ảnh chụp vườn (xem toạ độ ở `terrace-layout.ts`).
 * Chỉ gồm đồ vật + cây trang trí (không bấm được); cây trong kho do `GardenScene` đặt vào các slot.
 */

export type Terrace = {
  group: THREE.Group
  /** Đèn bóng tròn — chỉ sáng ở chế độ tối */
  lamps: THREE.PointLight[]
  bulbMaterial: THREE.MeshBasicMaterial
  /** Lưới che nắng + mái tôn: mờ đi khi camera ở phía trên để nhìn thấy cây bên dưới */
  canopies: { material: THREE.Material & { opacity: number }; height: number; opacity: number; faded: number }[]
}

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

const standard = (color: string, roughness = 0.85, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

const solid = <T extends THREE.Object3D>(object: T, shadows = true): T => {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = shadows
      child.receiveShadow = true
    }
  })
  return object
}

const box = (width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  return solid(mesh)
}

/** Thanh / dây nối 2 điểm. */
export const makeBeam = (from: THREE.Vector3, to: THREE.Vector3, thickness: number, material: THREE.Material) => {
  const beam = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, from.distanceTo(to)), material)
  beam.position.copy(from).add(to).multiplyScalar(0.5)
  beam.lookAt(to)
  return beam
}

/** Vật tròn xoay (chậu, lu, xô) từ biên dạng [bán kính, độ cao]. */
const lathe = (profile: [number, number][], material: THREE.Material, x: number, z: number, y = 0) => {
  const mesh = new THREE.Mesh(
    new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 32),
    material,
  )
  mesh.position.set(x, y, z)
  return solid(mesh)
}

const canvasTexture = (width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// ---------------------------------------------------------------------------
// Texture vẽ tay
// ---------------------------------------------------------------------------

/** Tường tôn sơn 2 màu (trên xanh nhạt, dưới xanh ngọc) + vệt gỉ chảy từ mép trên. */
const wallTexture = (seed: number) =>
  canvasTexture(1024, 384, (context) => {
    const random = seededRandom(seed)
    const split = 384 * 0.52
    context.fillStyle = '#b6d0d3'
    context.fillRect(0, 0, 1024, split)
    context.fillStyle = '#9ed2c0'
    context.fillRect(0, split, 1024, 384 - split)
    // Sóng tôn
    for (let x = 0; x < 1024; x += 12) {
      context.fillStyle = `rgba(40, 70, 70, ${x % 24 === 0 ? 0.05 : 0.025})`
      context.fillRect(x, 0, 5, 384)
    }
    // Vệt gỉ
    const streak = (x: number, top: number, length: number, width: number, alpha: number) => {
      const gradient = context.createLinearGradient(0, top, 0, top + length)
      gradient.addColorStop(0, `rgba(138, 76, 34, ${alpha})`)
      gradient.addColorStop(1, 'rgba(138, 76, 34, 0)')
      context.fillStyle = gradient
      context.fillRect(x, top, width, length)
    }
    for (let index = 0; index < 55; index++) {
      streak(random() * 1024, 0, 30 + random() * 170, 2 + random() * 7, 0.25 + random() * 0.45)
    }
    for (let index = 0; index < 25; index++) {
      streak(random() * 1024, split - 4, 20 + random() * 90, 2 + random() * 6, 0.3 + random() * 0.4)
    }
    context.fillStyle = 'rgba(90, 60, 40, 0.35)'
    context.fillRect(0, split - 3, 1024, 4)
    // Bụi bẩn chân tường
    const grime = context.createLinearGradient(0, 300, 0, 384)
    grime.addColorStop(0, 'rgba(60, 70, 60, 0)')
    grime.addColorStop(1, 'rgba(60, 70, 60, 0.35)')
    context.fillStyle = grime
    context.fillRect(0, 300, 1024, 84)
  })

/** Sàn xi măng ẩm: loang tối, rêu vàng, vệt phấn trắng (lặp 2×2 trên sàn). */
const concreteTexture = () => {
  const texture = canvasTexture(1024, 1024, (context) => {
    const random = seededRandom(7)
    context.fillStyle = '#8d8f88'
    context.fillRect(0, 0, 1024, 1024)
    // Hạt li ti
    for (let index = 0; index < 9000; index++) {
      context.fillStyle = random() < 0.5 ? 'rgba(60, 62, 58, 0.12)' : 'rgba(230, 230, 222, 0.1)'
      context.fillRect(random() * 1024, random() * 1024, 2, 2)
    }
    const blot = (color: string, count: number, min: number, max: number) => {
      for (let index = 0; index < count; index++) {
        const x = random() * 1024
        const y = random() * 1024
        const radius = min + random() * max
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
        context.fillStyle = gradient
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      }
    }
    blot('rgba(55, 60, 52, 0.35)', 60, 30, 110)
    blot('rgba(150, 140, 80, 0.3)', 50, 8, 34)
    blot('rgba(205, 205, 195, 0.2)', 30, 6, 20)
    context.strokeStyle = 'rgba(235, 235, 230, 0.5)'
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(80, 1024)
    context.quadraticCurveTo(220, 820, 520, 900)
    context.stroke()
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 1.6)
  return texture
}

/** Lưới B40: mắt cáo hình thoi, nền trong suốt. */
const chainLinkTexture = () => {
  const texture = canvasTexture(64, 64, (context) => {
    context.strokeStyle = '#a3a8a6'
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(0, 0)
    context.lineTo(64, 64)
    context.moveTo(64, 0)
    context.lineTo(0, 64)
    context.stroke()
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Lưới che nắng: sợi xanh đen lấm tấm + sọc xanh ngọc, nhiều lỗ thủng. */
const shadeNetTexture = () => {
  const texture = canvasTexture(128, 128, (context) => {
    const random = seededRandom(11)
    for (let y = 0; y < 128; y += 3) {
      for (let x = 0; x < 128; x += 3) {
        if (random() < 0.62) {
          const stripe = x % 42 < 5
          context.fillStyle = stripe ? '#2f8a6a' : random() < 0.2 ? '#3d5f52' : '#13261f'
          context.fillRect(x, y, 2.4, 2.4)
        }
      }
    }
  })
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

// ---------------------------------------------------------------------------
// Cây trang trí
// ---------------------------------------------------------------------------

/** Cây phất dụ cao ở góc lan can: vài thân mảnh, chùm lá dải ở ngọn. */
const buildDracaena = (x: number, z: number) => {
  const group = new THREE.Group()
  group.add(lathe([[0, 0], [0.2, 0], [0.26, 0.42], [0.24, 0.42]], standard('#1b1c1b', 0.6), x, z))
  const random = seededRandom(3)
  const trunkMaterial = standard('#7b6a4c')
  const crowns: THREE.Vector3[] = []
  for (let index = 0; index < 5; index++) {
    const top = new THREE.Vector3(x + (random() - 0.5) * 0.7, 1.9 + random() * 1.1, z + (random() - 0.3) * 0.6)
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x + (random() - 0.5) * 0.1, 0.38, z),
      new THREE.Vector3(x, top.y * 0.55, z),
      top,
    )
    group.add(solid(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.022, 5), trunkMaterial)))
    crowns.push(top, curve.getPoint(0.7))
  }
  const leafGeometry = new THREE.PlaneGeometry(0.04, 0.5).translate(0, 0.25, 0)
  const perCrown = 20
  const leaves = new THREE.InstancedMesh(
    leafGeometry,
    new THREE.MeshStandardMaterial({ color: '#4f8a3a', side: THREE.DoubleSide, roughness: 0.6 }),
    crowns.length * perCrown,
  )
  const dummy = new THREE.Object3D()
  let index = 0
  for (const crown of crowns) {
    for (let leaf = 0; leaf < perCrown; leaf++) {
      dummy.position.copy(crown)
      dummy.rotation.set(0, random() * Math.PI * 2, 0.5 + random() * 1.6, 'YXZ')
      dummy.scale.setScalar(0.7 + random() * 0.5)
      dummy.updateMatrix()
      leaves.setMatrixAt(index++, dummy.matrix)
    }
  }
  leaves.castShadow = true
  group.add(leaves)
  return group
}

/** Cây me lá li ti trong lu men xanh. */
const buildTamarind = (x: number, z: number) => {
  const group = new THREE.Group()
  const glaze = standard('#2c524c', 0.25, 0.1)
  group.add(lathe([[0, 0], [0.22, 0], [0.36, 0.2], [0.35, 0.42], [0.3, 0.46], [0.28, 0.44]], glaze, x, z))
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.37, 0.07, 32, 1, true), standard('#d8cca2', 0.4))
  band.position.set(x, 0.3, z)
  group.add(band)

  const random = seededRandom(5)
  const wood = standard('#5a4634')
  const tips: THREE.Vector3[] = []
  for (let index = 0; index < 6; index++) {
    const angle = random() * Math.PI * 2
    const tip = new THREE.Vector3(x + Math.cos(angle) * 0.5, 0.75 + random() * 0.55, z + Math.sin(angle) * 0.4 + 0.1)
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x, 0.42, z),
      new THREE.Vector3(x + (random() - 0.5) * 0.2, 0.75, z),
      tip,
    )
    group.add(solid(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.02, 5), wood)))
    tips.push(tip)
  }

  // Lá kép lông chim: mỗi cành ~ 8 tàu, mỗi tàu 2 hàng lá chét nằm ngang
  const leaflet = new THREE.PlaneGeometry(0.018, 0.05).rotateX(-Math.PI / 2).translate(0, 0, 0.025)
  const frondsPerTip = 8
  const perFrond = 26
  const leaves = new THREE.InstancedMesh(
    leaflet,
    new THREE.MeshStandardMaterial({ color: '#7fb04a', side: THREE.DoubleSide, roughness: 0.6 }),
    tips.length * frondsPerTip * perFrond,
  )
  const dummy = new THREE.Object3D()
  const direction = new THREE.Vector3()
  const sideways = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const look = new THREE.Vector3()
  let index = 0
  for (const tip of tips) {
    for (let frond = 0; frond < frondsPerTip; frond++) {
      const origin = tip.clone().add(new THREE.Vector3((random() - 0.5) * 0.35, (random() - 0.5) * 0.25, (random() - 0.5) * 0.35))
      const yaw = random() * Math.PI * 2
      const pitch = -0.15 - random() * 0.45
      direction.set(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch))
      sideways.crossVectors(direction, up).normalize()
      for (let leaf = 0; leaf < perFrond; leaf++) {
        const side = leaf % 2 === 0 ? 1 : -1
        dummy.position.copy(origin).addScaledVector(direction, (leaf >> 1) * 0.026)
        look.copy(dummy.position).addScaledVector(sideways, side).addScaledVector(direction, 0.4).addScaledVector(up, -0.15)
        dummy.lookAt(look)
        dummy.updateMatrix()
        leaves.setMatrixAt(index++, dummy.matrix)
      }
    }
  }
  leaves.castShadow = true
  group.add(leaves)
  return group
}

/** Ổ rau bò (staghorn) gắn ván trên tường. */
const buildStaghorn = (x: number, y: number, z: number) => {
  const group = new THREE.Group()
  group.add(box(0.34, 0.42, 0.03, standard('#3a2c22'), x, y, z))
  const nest = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), standard('#6d5139', 1))
  nest.scale.set(1.1, 0.8, 0.6)
  nest.position.set(x, y + 0.04, z + 0.07)
  group.add(solid(nest))
  const frond = standard('#5f9447', 0.6)
  frond.side = THREE.DoubleSide
  for (let index = 0; index < 5; index++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.32).translate(0, 0.16, 0), frond)
    leaf.position.set(x, y - 0.02, z + 0.1)
    leaf.rotation.set(0.35, 0, Math.PI - 1.1 + index * 0.55)
    group.add(solid(leaf))
  }
  return group
}

// ---------------------------------------------------------------------------
// Sân thượng
// ---------------------------------------------------------------------------

export const buildTerrace = (): Terrace => {
  const group = new THREE.Group()
  const canopies: Terrace['canopies'] = []

  // Sàn, tường sau, tường phải
  const floor = box(7.3, 0.2, 5.6, new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.75 }), 0.55, -0.1, 0.65)
  floor.castShadow = false
  const backWall = box(7.25, 2.6, 0.1, new THREE.MeshStandardMaterial({ map: wallTexture(21), roughness: 0.7, metalness: 0.15 }), 0.55, 1.3, -2.1)
  const sideWall = box(0.1, 2.6, 4.3, new THREE.MeshStandardMaterial({ map: wallTexture(33), roughness: 0.7, metalness: 0.15 }), 4.15, 1.3, 0)
  group.add(floor, backWall, sideWall)

  // Cửa sổ lá sách + kệ dụng cụ + túi treo trên tường phải
  const louver = standard('#55635e', 0.5, 0.3)
  group.add(box(0.04, 1.0, 1.15, standard('#3b4743', 0.6), 4.09, 1.85, 0.75))
  for (let slat = 0; slat < 8; slat++) {
    const mesh = box(0.12, 0.018, 1.05, louver, 4.04, 1.42 + slat * 0.12, 0.75)
    mesh.rotation.z = 0.55
    group.add(mesh)
  }
  group.add(box(0.36, 0.03, 1.0, standard('#9b8f7a'), 3.92, 1.78, -1.3))
  const bottleColors = ['#e4e2dc', '#2f63c4', '#d8d4c4', '#c2342b', '#f2c94c', '#ffffff']
  bottleColors.forEach((color, index) => {
    const height = 0.14 + (index % 3) * 0.06
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, height, 12), standard(color, 0.4))
    bottle.position.set(3.9, 1.795 + height / 2, -1.15 + index * 0.09)
    group.add(solid(bottle))
  })
  const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 20), standard('#b9bcbd', 0.3, 0.8))
  canister.position.set(3.88, 1.945, -1.6)
  group.add(solid(canister))
  group.add(lathe([[0, 0], [0.1, 0], [0.13, 0.2], [0.12, 0.2]], standard('#1b1c1b', 0.6), 3.9, -0.85, 1.795))
  group.add(box(0.05, 0.42, 0.32, standard('#8b6c4c', 0.9), 4.07, 1.35, -0.55))

  // Tường lửng trái + ván đặt chậu + lưới B40 + cột gỗ
  group.add(box(0.16, 0.95, 5.6, standard('#7a7d76', 0.95), -3.08, 0.475, 0.65))
  group.add(box(0.42, 0.04, 3.7, standard('#3a2f28', 0.8), -2.8, LEDGE_Y - 0.02, 0.55))
  for (const z of [-1.2, 0.55, 2.3]) {
    group.add(box(0.03, LEDGE_Y - 0.04, 0.03, standard('#5d5d58', 0.5, 0.5), -2.62, (LEDGE_Y - 0.04) / 2, z))
  }
  const linkTexture = chainLinkTexture()
  linkTexture.repeat.set(5.6 / 0.08, 1.65 / 0.08)
  const fence = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 1.65),
    new THREE.MeshStandardMaterial({ map: linkTexture, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 }),
  )
  fence.rotation.y = Math.PI / 2
  fence.position.set(-3.06, 0.95 + 0.825, 0.65)
  group.add(fence)
  const post = standard('#5a4632')
  for (const z of [-2.05, 0.3, 2.3, 3.4]) {
    group.add(box(0.08, 2.65, 0.08, post, -3.06, 1.325, z))
  }

  // Kệ sắt trắng + 2 bể kính chồng nhau
  const whiteMetal = standard('#e9e7e0', 0.5, 0.25)
  const [standX, standZ] = [-1.9, -0.2]
  for (const [dx, dz] of [[-0.25, -0.2], [0.25, -0.2], [0.25, 0.2], [-0.25, 0.2]]) {
    group.add(box(0.03, 1.0, 0.03, whiteMetal, standX + dx, 0.5, standZ + dz))
  }
  for (const y of [0.04, 0.985]) {
    group.add(box(0.53, 0.03, 0.03, whiteMetal, standX, y, standZ - 0.2), box(0.53, 0.03, 0.03, whiteMetal, standX, y, standZ + 0.2))
    group.add(box(0.03, 0.03, 0.43, whiteMetal, standX - 0.25, y, standZ), box(0.03, 0.03, 0.43, whiteMetal, standX + 0.25, y, standZ))
  }
  const glass = new THREE.MeshStandardMaterial({ color: '#d4ecea', transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false })
  const water = new THREE.MeshStandardMaterial({ color: '#4f7d5c', transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false })
  group.add(box(0.58, 0.07, 0.44, standard('#151515', 0.4), standX, 1.035, standZ))
  group.add(box(0.56, 0.18, 0.42, glass, standX, 1.16, standZ), box(0.53, 0.12, 0.39, water, standX, 1.13, standZ))
  group.add(box(0.5, 0.24, 0.38, glass, standX, 1.37, standZ), box(0.47, 0.1, 0.35, water, standX, 1.3, standZ))

  // Kệ treo tường bằng xích + khay nhựa đen
  group.add(box(1.85, 0.03, 0.4, standard('#d7d5cd', 0.5, 0.3), -1.25, SHELF_Y - 0.015, -1.85))
  group.add(box(0.75, 0.16, 0.26, standard('#242624', 0.6), -1.32, SHELF_Y + 0.08, -1.84))
  const chain = standard('#3a2b22', 0.6, 0.5)
  group.add(makeBeam(new THREE.Vector3(-0.25, 2.35, -2.05), new THREE.Vector3(-0.35, SHELF_Y, -1.66), 0.025, chain))

  // Cột gỗ đỡ lưới, ổ rau bò, cây me, chậu hồng, đôn chậu đen, lu sứ, xô
  group.add(box(0.08, 2.5, 0.08, standard('#6b5640'), 0.15, 1.25, -1.95))
  group.add(buildStaghorn(0.5, 1.75, -2.03))
  group.add(buildTamarind(0.55, -1.45))
  group.add(buildDracaena(-2.55, -1.6))
  group.add(lathe([[0, 0], [0.24, 0], [0.42, 0.16], [0.44, 0.2], [0.4, 0.2]], standard('#c99a94', 0.7), -0.62, -1.0))
  const basinSoil = new THREE.Mesh(new THREE.CircleGeometry(0.39, 24).rotateX(-Math.PI / 2), standard('#3a2a1d', 1))
  basinSoil.position.set(-0.62, 0.17, -1.0)
  group.add(solid(basinSoil, false))
  group.add(lathe([[0, 0.45], [0.2, 0.45], [0.26, 0], [0.24, 0]], standard('#121312', 0.35), -1.55, -1.55))
  group.add(lathe([[0, 0], [0.15, 0], [0.24, 0.2], [0.18, 0.48], [0.14, 0.5]], standard('#eceeea', 0.3), -2.35, -1.0))
  const bucket = standard('#efeee9', 0.5)
  group.add(lathe([[0, 0], [0.18, 0], [0.23, 0.42], [0.21, 0.42]], bucket, 1.35, -0.75))
  group.add(lathe([[0, 0], [0.18, 0], [0.23, 0.42], [0.21, 0.42]], bucket, 2.35, 0.35))
  group.add(lathe([[0, 0], [0.13, 0], [0.15, 0.26], [0.14, 0.26]], bucket, 0.95, -1.15))
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.08, 20, 1, true), standard('#c43b30', 0.5))
  label.position.set(0.95, 0.14, -1.15)
  group.add(label)

  // Góc mái che: két đen + cột rêu, thùng xốp trắng / vàng, đôn sứ trắng xanh
  group.add(box(0.65, 0.32, 0.42, standard('#1d1e1d', 0.6), 2.7, 0.16, -1.75))
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 8), standard('#6b5238', 1))
  pole.position.set(2.75, 0.32 + 0.95, -1.88)
  group.add(solid(pole))
  group.add(box(0.5, 0.45, 0.42, standard('#f2f1ec', 0.95), 3.0, 0.225, -0.75))
  group.add(box(0.42, 0.5, 0.45, standard('#e8c43a', 0.9), 3.6, 0.25, -1.15))
  group.add(box(0.43, 0.07, 0.46, standard('#c8402e', 0.9), 3.6, 0.2, -1.15))
  group.add(lathe([[0, 0], [0.17, 0], [0.22, 0.25], [0.18, 0.52], [0.16, 0.55], [0, 0.55]], standard('#eef0ee', 0.3), 3.42, -0.25))
  const blueBand = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.22, 0.06, 24, 1, true), standard('#2d4e8c', 0.3))
  blueBand.position.set(3.42, 0.08, -0.25)
  group.add(blueBand)

  // Nhà hàng xóm phía sau (mờ trong sương)
  for (const [width, height, depth, x, z, color] of [
    [3.2, 5.5, 4, -6.2, -1.5, '#e9e7e0'],
    [4.5, 4.2, 3, -5.8, 3.6, '#d5dcd9'],
    [6, 3.6, 3, 0.5, -4.6, '#c9d2cf'],
    [3.5, 6.5, 3, 5.4, -4.4, '#ecebe6'],
  ] as const) {
    group.add(box(width, height, depth, standard(color, 0.9), x, height / 2 - 3, z))
  }
  const neighbourRoof = box(6.2, 0.06, 3.2, standard('#8fc4c0', 0.5, 0.4), 0.5, 0.65, -4.6)
  neighbourRoof.rotation.x = 0.18
  group.add(neighbourRoof)

  // Dây điện chạy ngang trời
  const wire = standard('#151515', 0.6)
  group.add(
    makeBeam(new THREE.Vector3(-3, 2.5, -1.3), new THREE.Vector3(4.1, 2.62, -0.3), 0.012, wire),
    makeBeam(new THREE.Vector3(-3, 2.42, 0.6), new THREE.Vector3(4.1, 2.58, 1.2), 0.012, wire),
  )

  // Lưới che nắng (mặt võng xuống) + tấm buông bên trái
  const netTexture = shadeNetTexture()
  netTexture.repeat.set(9, 7)
  const netMaterial = new THREE.MeshStandardMaterial({
    map: netTexture,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.9,
  })
  const netGeometry = new THREE.PlaneGeometry(4.7, 3.45, 24, 16)
  const netPositions = netGeometry.attributes.position
  for (let index = 0; index < netPositions.count; index++) {
    const u = netPositions.getX(index) / 4.7 + 0.5
    const v = netPositions.getY(index) / 3.45 + 0.5
    netPositions.setZ(index, -0.18 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v))
  }
  netGeometry.rotateX(-Math.PI / 2)
  const canopy = new THREE.Mesh(netGeometry, netMaterial)
  canopy.position.set(-0.68, 2.4, -0.35)
  const drapeGeometry = new THREE.PlaneGeometry(0.6, 2.2, 4, 12)
  const drapePositions = drapeGeometry.attributes.position
  for (let index = 0; index < drapePositions.count; index++) {
    drapePositions.setZ(index, Math.sin(drapePositions.getY(index) * 5 + drapePositions.getX(index) * 4) * 0.05)
  }
  const drapeMaterial = netMaterial.clone()
  drapeMaterial.opacity = 0.95
  const drape = new THREE.Mesh(drapeGeometry, drapeMaterial)
  drape.position.set(-2.6, 1.3, 1.3)
  group.add(canopy, drape)
  canopies.push({ material: netMaterial, height: 2.4, opacity: 0.92, faded: 0.2 })

  // Mái tôn bên phải
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: '#7d8884',
    roughness: 0.5,
    metalness: 0.45,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  })
  const roofGeometry = new THREE.PlaneGeometry(2.9, 5.8, 58, 1)
  const roofPositions = roofGeometry.attributes.position
  for (let index = 0; index < roofPositions.count; index++) {
    roofPositions.setZ(index, Math.sin(roofPositions.getX(index) * 40) * 0.015)
  }
  roofGeometry.rotateX(-Math.PI / 2)
  const roof = new THREE.Mesh(roofGeometry, roofMaterial)
  roof.position.set(2.85, 2.82, 0.65)
  roof.rotation.z = 0.08
  roof.castShadow = true
  group.add(roof)
  // Xà đỡ mái dùng chung material mái → ẩn cùng mái khi nhìn từ trên
  roof.add(box(0.06, 0.08, 5.8, roofMaterial, -1.43, -0.06, 0))
  canopies.push({ material: roofMaterial, height: 2.82, opacity: 1, faded: 0 })

  // Bóng đèn treo: dưới lưới + dưới mái
  const bulbMaterial = new THREE.MeshBasicMaterial({ color: '#d8d2c2' })
  const lamps: THREE.PointLight[] = []
  for (const [x, y, z, top] of [[-0.9, 2.05, -0.55, 2.38], [2.85, 2.35, -0.45, 2.8]]) {
    group.add(makeBeam(new THREE.Vector3(x, top, z), new THREE.Vector3(x, y, z), 0.01, wire))
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), bulbMaterial)
    bulb.position.set(x, y - 0.05, z)
    const light = new THREE.PointLight('#ffc27a', 0, 0, 2)
    light.position.set(x, y - 0.12, z)
    lamps.push(light)
    group.add(bulb, light)
  }

  return { group, lamps, bulbMaterial, canopies }
}
