import * as THREE from './vendor/three.module.js';
export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.setClearColor(0x09121c); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.FogExp2(0x09121c, .018); this.camera = new THREE.PerspectiveCamera(58, 1, .1, 180);
    this.scene.add(new THREE.HemisphereLight(0xc7ecff, 0x182332, 2.5)); const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(-8, 15, 5); this.scene.add(sun);
    this.group = new THREE.Group(); this.scene.add(this.group); this.geometry = new THREE.BoxGeometry(1, 1, 1); this.materials = [];
    this.player = new THREE.Group(); const body = this.mesh(.46, .65, .42, 0xccff40); body.position.y = .52; const head = this.mesh(.34, .3, .34, 0xedfff4); head.position.y = 1; const visor = this.mesh(.36, .1, .04, 0x162c32); visor.position.set(0, 1.02, -.18); this.player.add(body, head, visor); this.scene.add(this.player);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(.36, 20), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: .3, transparent: true, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2; this.scene.add(this.shadow);
    this.ghost = this.mesh(.48, 1.2, .44, 0xa19aff); this.ghost.material.transparent = true; this.ghost.material.opacity = .4; this.scene.add(this.ghost);
    const stars = []; for (let i = 0; i < 400; i++) stars.push(Math.sin(i * 127) * 75, Math.cos(i * 73) * 45 + 15, -i * .55); const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3)); this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x94c7da, size: .11 })));
    const grid = new THREE.GridHelper(220, 44, 0x18394b, 0x102332); grid.position.y = -12; this.scene.add(grid); this.grid = grid; this.run = null; this.platformMeshes = []; this.renderer.domElement.dataset.renderer = 'webgl-3d';
  }
  mesh(w, h, d, color, emissive = 0) { const material = new THREE.MeshStandardMaterial({ color, metalness: .35, roughness: .5, emissive, emissiveIntensity: .65 }); this.materials.push(material); const mesh = new THREE.Mesh(this.geometry, material); mesh.scale.set(w, h, d); return mesh; }
  build(run) {
    for (const child of [...this.group.children]) { child.traverse(obj => { if (obj.material) { obj.material.dispose(); const i = this.materials.indexOf(obj.material); if (i >= 0) this.materials.splice(i, 1); } }); this.group.remove(child); }
    this.run = run; this.platformMeshes = run.platforms.map(p => { const group = new THREE.Group(); const slab = this.mesh(p.width, .38, p.length, p.index === 0 ? 0x627b88 : 0x263b4b); slab.position.y = -.19; group.add(slab); const edge = this.mesh(p.width, .055, .12, 0xccff40, 0x8bbd14); edge.position.set(0, .025, p.length / 2); group.add(edge); const stripe = this.mesh(.055, .025, p.length * .7, 0xc7e5e9, 0x345e66); stripe.position.y = .02; group.add(stripe); const pillar = this.mesh(.16, 4 + p.index * .15, .16, 0x173343); pillar.position.set(-p.width / 2 + .1, -2.3 - p.index * .075, 0); group.add(pillar); let hazard = null; if (p.obstacle) { hazard = this.mesh(.65, .65, .65, 0xff5666, 0x6b1525); hazard.position.y = .4; group.add(hazard); } group.position.set(p.x, p.y, p.z); this.group.add(group); return { group, hazard }; });
    this.camera.position.set(0, 5.2, 10); this.lastZ = 0;
  }
  render(run, ghost, dt = .016, preview = false) {
    if (!run) return; if (this.run !== run) this.build(run);
    const rect = this.renderer.domElement.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height); if (this.width !== width || this.height !== height) { this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.width = width; this.height = height; }
    for (let i = 0; i < run.platforms.length; i++) { const p = run.platforms[i], m = this.platformMeshes[i]; m.group.position.x = run.platformX(p); m.group.visible = Math.abs(p.z - run.player.z) < 90; if (m.hazard) { m.hazard.position.x = Math.sin(run.elapsed * 2 + p.phase) * p.width * .23; m.hazard.rotation.y = run.elapsed; } }
    const p = run.player; this.player.position.set(p.x, p.y, p.z); this.player.rotation.z = -run.input * .12; this.shadow.position.set(p.x, run.platforms[run.checkpoint].y + .03, p.z); this.shadow.visible = p.grounded;
    const follow = 1 - Math.exp(-8 * dt); this.camera.position.lerp(new THREE.Vector3(p.x * .35 + (preview ? 4 : 0), p.y + 4.8, p.z + 9.3), follow); this.camera.lookAt(p.x * .35, p.y + .4, p.z - 8); this.grid.position.z = p.z - 40; this.grid.position.y = run.platforms[run.checkpoint].y - 12;
    const frames = ghost?.frames; this.ghost.visible = Boolean(frames?.length); if (frames?.length) { let i = frames.findIndex(f => f.time >= run.elapsed); if (i < 0) i = frames.length - 1; const b = frames[i], a = frames[Math.max(0, i - 1)]; const t = b.time === a.time ? 0 : Math.max(0, Math.min(1, (run.elapsed - a.time) / (b.time - a.time))); this.ghost.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + .6, a.z + (b.z - a.z) * t); }
    this.renderer.render(this.scene, this.camera);
  }
}