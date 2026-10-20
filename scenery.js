import * as THREE from './vendor/three.module.js';
import { World as Base } from './world.js';

// Procedural models keep the single HTML independent of asset downloads.
export class World extends Base {
  constructor(canvas) {
    super(canvas);
    this.renderer.setClearColor(0x91bbc6);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.grid.visible = false;
    this.scene.fog = new THREE.Fog(0x91bbc6, 22, 85);
    this.scene.children.filter(o => o.isPoints || o.isGridHelper).forEach(o => { o.visible = false; });
    this.scene.add(new THREE.HemisphereLight(0xffefd7, 0x86b6ba, 1.8));
    this.palette = new Map(); this.ball = new THREE.SphereGeometry(1, 16, 12); this.crystal = new THREE.OctahedronGeometry(1); this.ring = new THREE.TorusGeometry(1, .035, 6, 36);
    this.player.clear();
    this.part(this.player, .56, .65, .46, 0xfff0d8, 0, .59, 0, true);
    this.part(this.player, .72, .58, .6, 0xfff8eb, 0, 1.14, 0, true);
    this.part(this.player, .55, .32, .18, 0x174b60, 0, 1.16, -.25, true);
    this.part(this.player, .34, .035, .02, 0x81eedc, 0, 1.2, -.34);
    this.part(this.player, .4, .46, .23, 0xdfa763, 0, .64, .28, true);
    this.limbs = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(side * .35, .8, 0); this.part(arm, .18, .4, .2, 0xffedcf, 0, -.12, 0, true); this.part(arm, .2, .15, .23, 0x279f98, 0, -.32, 0, true); this.player.add(arm);
      const leg = new THREE.Group(); leg.position.set(side * .16, .32, 0); this.part(leg, .2, .3, .22, 0xffedcf, 0, -.07, 0, true); this.part(leg, .24, .14, .33, 0x28586a, 0, -.25, -.04, true); this.player.add(leg); this.limbs.push({ arm, leg, side });
    }
    this.aura = new THREE.Mesh(this.ring, this.mat(0x38e6c6)); this.aura.scale.setScalar(.86); this.aura.rotation.x = Math.PI / 2; this.aura.position.y = .6; this.player.add(this.aura);
    this.clouds = new THREE.Group(); this.scene.add(this.clouds);
    for (let i = 0; i < 22; i++) { const g = new THREE.Group(); for (let j = 0; j < 3; j++) this.part(g, 9, 3 + j, 6, i % 2 ? 0xc8dfe0 : 0xbdd6db, (j - 1) * 4, j * .2, 0, true); g.position.set((i % 2 ? -1 : 1) * (14 + i % 4 * 5), -7 - i % 3 * 2, -i * 6); this.clouds.add(g); }
  }
  mat(color) { if (!this.palette.has(color)) this.palette.set(color, new THREE.MeshStandardMaterial({ color, roughness: .65, metalness: .08 })); return this.palette.get(color); }
  part(g, w, h, d, color, x = 0, y = 0, z = 0, round = false) { const m = new THREE.Mesh(round ? this.ball : this.geometry, this.mat(color)); const k = round ? 2 : 1; m.scale.set(w / k, h / k, d / k); m.position.set(x, y, z); g.add(m); return m; }
  build(run) {
    this.group.clear(); this.run = run;
    this.platformMeshes = run.platforms.map(p => {
      const group = new THREE.Group();
      this.part(group, p.width, .3, p.length, 0xeddfc7, 0, -.16);
      this.part(group, p.width - .12, .1, p.length - .12, 0xfff3df, 0, .04);
      this.part(group, p.width * .93, .2, p.length * .94, 0x4f9999, 0, -.4);
      const rock = new THREE.Mesh(this.crystal, this.mat(0x78a0a0)); rock.scale.set(p.width * .6, 1.2, p.length * .5); rock.position.y = -1; group.add(rock);
      for (const side of [-1, 1]) {
        this.part(group, .055, .03, p.length - .25, 0x39b7a6, side * (p.width / 2 - .12), .105);
        const mark = this.part(group, .07, .03, .4, 0x318e88, side * .13, .105, -p.length / 2 + 1.25); mark.rotation.y = side * .6;
        this.part(group, .14, .35, .14, 0x527d82, side * (p.width / 2 - .18), .2, p.length / 2 - .2);
        this.part(group, .21, .12, .21, 0xa8f5d9, side * (p.width / 2 - .18), .42, p.length / 2 - .2, true);
      }
      this.part(group, p.width - .25, .025, .24, 0xe9b46d, 0, .105, -p.length / 2 + .65);
      if (p.motion) this.part(group, p.width * .7, .025, .13, 0x71a8d4, 0, .105, .8);
      let hazard = null;
      if (p.obstacle) { hazard = new THREE.Group(); this.part(hazard, .7, .15, .7, 0x994957, 0, .09); const core = new THREE.Mesh(this.crystal, this.mat(0xf17870)); core.scale.set(.42, .48, .42); core.position.y = .43; hazard.add(core); group.add(hazard); }
      const gem = new THREE.Mesh(this.crystal, this.mat(0x21cbb1)); gem.scale.set(.23, .37, .23); gem.position.set(p.gemOffset || 0, 1, 0); group.add(gem);
      if (p.index === run.total) { for (const side of [-1, 1]) this.part(group, .16, 2.8, .2, 0xe3bc72, side * (p.width / 2 - .18), 1.4, -.5); this.part(group, p.width, .18, .2, 0xe3bc72, 0, 2.8, -.5); }
      group.position.set(p.x, p.y, p.z); this.group.add(group); return { group, hazard, gem };
    });
    this.camera.position.set(0, 5.3, 9);
  }
  render(run, ghost, dt = .016) {
    // Base renderer supplies resize, moving-platform positions and ghost interpolation.
    // Render once with the upgraded animation and stable camera below.
    const render = this.renderer.render; this.renderer.render = () => {};
    try { super.render(run, ghost, dt); } finally { this.renderer.render = render; }
    if (!run) return;
    const p = run.player, floor = run.platforms[run.checkpoint].y;
    this.player.position.y = p.y + (p.grounded ? Math.sin(run.elapsed * 18) * .025 : 0);
    for (const { arm, leg, side } of this.limbs) { const stride = p.grounded ? Math.sin(run.elapsed * 16) * .6 * side : side * .3; leg.rotation.x = stride; arm.rotation.x = -stride; arm.rotation.z = p.grounded ? side * .1 : side * .8; }
    this.aura.visible = run.shield;
    for (let i = 0; i < this.platformMeshes.length; i++) { const m = this.platformMeshes[i]; m.gem.visible = Boolean(run.platforms[i].gem); m.gem.rotation.y = run.elapsed * 2; m.gem.position.y = 1 + Math.sin(run.elapsed * 3 + i) * .12; }
    this.camera.fov = this.width < this.height ? 63 : 55; this.camera.updateProjectionMatrix();
    this.camera.position.y = floor + 5.3; this.camera.lookAt(p.x * .3, floor + .45, p.z - 7);
    this.clouds.position.set(0, floor, p.z); this.shadow.position.y = floor + .11;
    this.renderer.render(this.scene, this.camera);
  }
}