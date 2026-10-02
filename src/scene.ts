import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BAYS, HERO_BAY, HERO_Y, MOTION, PEER_BAY, RACK, SWITCH_BAY, type Bay } from "./layout.ts";
import { frameShot } from "./shots.ts";
import type { Sample } from "./tour.ts";

const BLOOM = 1;

export type Anchor = {
  id: string;
  title: string;
  object: THREE.Object3D;
  chapters: readonly string[];
  side: "left" | "right";
  /** Feature that must pass `min` before the label appears. */
  gate?: "explode" | "die" | "tray";
  min?: number;
};

export type Orbit = { yaw: number; pitch: number };

export function anchorVisible(anchor: Anchor, sample: Sample): boolean {
  if (!anchor.chapters.includes(sample.chapter.id)) return false;
  if (anchor.id === "hbm" && sample.chapter.id === "path") return true;
  if (anchor.gate && anchor.min !== undefined && sample.features[anchor.gate] < anchor.min) return false;
  return true;
}

export type Experience = {
  anchors: Anchor[];
  update(sample: Sample, time: number, orbit: Orbit, reduced: boolean): void;
  render(): void;
  resize(): void;
  pick(clientX: number, clientY: number): number | null;
  project(object: THREE.Object3D, width: number, height: number): { x: number; y: number; behind: boolean };
  dispose(): void;
};

type Role = "tensor" | "cache" | "memory" | "nvlink" | "bridge";

const ROLE_BASE: Record<Role, THREE.Color> = {
  tensor: new THREE.Color("#24303c"),
  cache: new THREE.Color("#3a4656"),
  memory: new THREE.Color("#4a342c"),
  nvlink: new THREE.Color("#3a3054"),
  bridge: new THREE.Color("#5a4a28"),
};

const ROLE_HOT: Record<Role, THREE.Color> = {
  tensor: new THREE.Color("#f2c56a"),
  cache: new THREE.Color("#f4f7fb"),
  memory: new THREE.Color("#f0a15a"),
  nvlink: new THREE.Color("#d2c2ff"),
  bridge: new THREE.Color("#ffd78a"),
};

export function createExperience(canvas: HTMLCanvasElement, mobile: boolean): Experience {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.7);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x08090c, 1);
  renderer.shadowMap.enabled = !mobile;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08090c);
  scene.fog = new THREE.FogExp2(0x08090c, 0.085);
  scene.environmentIntensity = 0.42;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const anchors: Anchor[] = [];
  const dummy = new THREE.Object3D();

  const geo = (geometry: THREE.BufferGeometry) => {
    geometries.push(geometry);
    return geometry;
  };
  const mat = <T extends THREE.Material>(material: T) => {
    materials.push(material);
    return material;
  };

  const metal = mat(new THREE.MeshStandardMaterial({
    color: 0x2c333c,
    metalness: 0.88,
    roughness: 0.38,
    envMapIntensity: 0.55,
  }));
  const metalDark = mat(new THREE.MeshStandardMaterial({
    color: 0x171b21,
    metalness: 0.8,
    roughness: 0.46,
    envMapIntensity: 0.4,
  }));
  const copper = mat(new THREE.MeshStandardMaterial({
    color: 0xb8734a,
    metalness: 1,
    roughness: 0.28,
    envMapIntensity: 0.9,
  }));
  const board = mat(new THREE.MeshStandardMaterial({
    color: 0x3a342c,
    metalness: 0.35,
    roughness: 0.62,
    envMapIntensity: 0.3,
  }));
  const silicon = mat(new THREE.MeshStandardMaterial({
    color: 0x141b24,
    metalness: 0.62,
    roughness: 0.28,
    envMapIntensity: 0.5,
  }));
  const interposerMat = mat(new THREE.MeshStandardMaterial({
    color: 0x9aa3ad,
    metalness: 0.75,
    roughness: 0.22,
    envMapIntensity: 0.7,
  }));
  const gold = mat(new THREE.MeshStandardMaterial({
    color: 0xd7b15a,
    metalness: 1,
    roughness: 0.25,
    emissive: 0xffc56a,
    emissiveIntensity: 0.2,
    envMapIntensity: 0.8,
  }));
  const bridgeMat = mat(gold.clone());
  const cpuMat = mat(new THREE.MeshStandardMaterial({
    color: 0x232a32,
    metalness: 0.7,
    roughness: 0.32,
    emissive: 0x7ec8d4,
    emissiveIntensity: 0.08,
  }));
  const hbmMat = mat(new THREE.MeshStandardMaterial({
    color: 0x6b4a32,
    metalness: 0.55,
    roughness: 0.35,
    emissive: 0x8a3e1c,
    emissiveIntensity: 0.12,
  }));
  const hbmLogic = mat(new THREE.MeshStandardMaterial({
    color: 0x243044,
    metalness: 0.5,
    roughness: 0.4,
  }));
  const glass = mat(new THREE.MeshStandardMaterial({
    color: 0x9eb0be,
    transparent: true,
    opacity: mobile ? 0.08 : 0.12,
    roughness: 0.06,
    metalness: 0.15,
    depthWrite: false,
    envMapIntensity: 0.4,
  }));
  const slotMat = mat(new THREE.MeshBasicMaterial({
    color: 0x9adbe6,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const dieMat = mat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const markerMat = mat(new THREE.MeshBasicMaterial({
    color: 0xf2c56a,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  const coolantMat = mat(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float band = 0.65 + 0.35 * sin(vUv.y * 22.0 - uTime * 1.7);
        vec3 col = vec3(0.35, 0.85, 1.0) * (0.45 + 0.4 * band);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }));

  const add = (object: THREE.Object3D, parent: THREE.Object3D, chapter?: number) => {
    parent.add(object);
    if (chapter !== undefined) object.userData.chapter = chapter;
    return object;
  };
  const bloom = (object: THREE.Object3D) => {
    object.layers.enable(BLOOM);
    return object;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    parent: THREE.Object3D,
    chapter?: number,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), material);
    mesh.castShadow = !mobile;
    mesh.receiveShadow = true;
    add(mesh, parent, chapter);
    return mesh;
  };
  const anchor = (
    id: string,
    title: string,
    parent: THREE.Object3D,
    position: THREE.Vector3Tuple,
    chapters: readonly string[],
    side: "left" | "right",
    gate?: Anchor["gate"],
    min?: number,
  ) => {
    const object = new THREE.Object3D();
    object.position.set(position[0], position[1], position[2]);
    parent.add(object);
    anchors.push({ id, title, object, chapters, side, gate, min });
    return object;
  };

  RectAreaLightUniformsLib.init();
  scene.add(new THREE.HemisphereLight(0xc5d2de, 0x22180f, 0.72));
  const key = new THREE.DirectionalLight(0xfff1dd, 3.4);
  key.position.set(2.6, 4.6, 2.4);
  key.castShadow = !mobile;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.00035;
  scene.add(key);
  scene.add(key.target);
  const rim = new THREE.DirectionalLight(0x9fd4ff, 1.45);
  rim.position.set(-2.8, 2.1, -2.2);
  scene.add(rim);
  const rect = new THREE.RectAreaLight(0xffe2c4, 12, 1.6, 0.45);
  rect.position.set(0.15, 2.55, 1.55);
  rect.lookAt(0, 1.05, 0);
  scene.add(rect);
  const interior = new THREE.PointLight(0xd5e4f2, 2, 3.2, 2);
  interior.position.set(0, HERO_Y, 0.15);
  scene.add(interior);
  const heroSpot = new THREE.SpotLight(0xfff4e4, 0, 5.5, Math.PI / 6, 0.55, 1);
  scene.add(heroSpot);
  scene.add(heroSpot.target);

  const floor = new THREE.Mesh(
    geo(new THREE.CircleGeometry(9, 48)),
    mat(new THREE.MeshStandardMaterial({ color: 0x0c0d11, metalness: 0.55, roughness: 0.42, envMapIntensity: 0.35 })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.Mesh(
    geo(new THREE.CircleGeometry(8, 40)),
    mat(new THREE.MeshBasicMaterial({ map: gridTexture(), transparent: true, opacity: 0.35, depthWrite: false })),
  );
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = 0.002;
  scene.add(grid);

  for (const light of [
    [-1.1, 2.45, 0.4],
    [1.1, 2.45, 0.2],
    [0, 2.45, -1.4],
  ] as const) {
    const fixture = box(0.7, 0.015, 0.08, mat(new THREE.MeshBasicMaterial({ color: 0x8a8174 })), scene);
    fixture.position.set(light[0], light[1], light[2]);
    bloom(fixture);
  }

  buildNeighbor(scene, box, -1.7, -0.35, 0.85);
  buildNeighbor(scene, box, 1.85, 0.15, 0.75);
  buildNeighbor(scene, box, -2.55, 0.4, 0.6);

  const door = new THREE.Group();
  door.position.set(-RACK.w / 2, RACK.h / 2, RACK.d / 2 + 0.01);
  scene.add(door);
  const doorFrame = mat(metal.clone());
  box(0.025, RACK.h - 0.12, 0.03, doorFrame, door, 1).position.set(0.02, 0, 0);
  box(0.025, RACK.h - 0.12, 0.03, doorFrame, door, 1).position.set(RACK.w - 0.02, 0, 0);
  box(RACK.w, 0.04, 0.03, doorFrame, door, 1).position.set(RACK.w / 2, RACK.h / 2 - 0.08, 0);
  box(RACK.w, 0.04, 0.03, doorFrame, door, 1).position.set(RACK.w / 2, -RACK.h / 2 + 0.08, 0);
  const pane = box(RACK.w - 0.08, RACK.h - 0.28, 0.012, glass, door, 1);
  pane.position.set(RACK.w / 2, 0, 0);
  pane.castShadow = false;
  const handle = box(0.02, 0.28, 0.03, copper, door, 1);
  handle.position.set(RACK.w - 0.08, 0, 0.02);

  box(RACK.w + 0.08, 0.1, RACK.d + 0.08, metalDark, scene, 0).position.set(0, 0.05, 0);
  box(0.045, RACK.h - 0.12, 0.045, metal, scene, 0).position.set(-RACK.w / 2, RACK.h / 2, RACK.d / 2 - 0.04);
  box(0.045, RACK.h - 0.12, 0.045, metal, scene, 0).position.set(RACK.w / 2, RACK.h / 2, RACK.d / 2 - 0.04);
  box(0.045, RACK.h - 0.12, 0.045, metal, scene, 0).position.set(-RACK.w / 2, RACK.h / 2, -RACK.d / 2 + 0.04);
  box(0.045, RACK.h - 0.12, 0.045, metal, scene, 0).position.set(RACK.w / 2, RACK.h / 2, -RACK.d / 2 + 0.04);
  box(RACK.w, 0.06, RACK.d, metalDark, scene, 0).position.set(0, RACK.h - 0.03, 0);
  box(RACK.w - 0.08, RACK.h - 0.2, 0.03, metalDark, scene, 0).position.set(0, RACK.h / 2, -RACK.d / 2);
  box(0.02, RACK.h - 0.24, RACK.d - 0.16, metalDark, scene, 0).position.set(-RACK.w / 2 + 0.02, RACK.h / 2, 0);

  const manifold = new THREE.Mesh(
    geo(new THREE.CylinderGeometry(0.028, 0.028, RACK.h - 0.28, 16)),
    coolantMat,
  );
  manifold.position.set(RACK.w / 2 + 0.07, RACK.h / 2, 0.12);
  bloom(manifold);
  scene.add(manifold);
  const returnPipe = new THREE.Mesh(geo(new THREE.TorusGeometry(0.16, 0.02, 10, 20, Math.PI)), coolantMat);
  returnPipe.position.set(RACK.w / 2 + 0.02, RACK.h - 0.16, 0.12);
  returnPipe.rotation.z = Math.PI;
  returnPipe.rotation.y = Math.PI / 2;
  bloom(returnPipe);
  scene.add(returnPipe);
  anchor("coolant", "Coolant manifold", scene, [RACK.w / 2 + 0.07, HERO_Y + 0.35, 0.12], ["rack", "open", "scale"], "right");

  const slot = new THREE.Mesh(geo(new THREE.BoxGeometry(0.7, HERO_BAY.h * 0.7, 0.02)), slotMat);
  slot.position.set(0, HERO_Y, 0.5);
  bloom(slot);
  scene.add(slot);

  const faceTextures = {
    compute: bezelTexture("COMPUTE", "#8fd7e4"),
    switch: bezelTexture("FABRIC", "#cbb6ff"),
    power: bezelTexture("POWER", "#e7a15a"),
  };
  const faceMaterials = {
    compute: mat(new THREE.MeshBasicMaterial({ map: faceTextures.compute })),
    switch: mat(new THREE.MeshBasicMaterial({ map: faceTextures.switch })),
    power: mat(new THREE.MeshBasicMaterial({ map: faceTextures.power })),
  };

  const ledGeo = geo(new THREE.SphereGeometry(0.0045, 8, 8));
  const ledMats = {
    compute: mat(new THREE.MeshBasicMaterial({ color: 0xb7f3ff })),
    switch: mat(new THREE.MeshBasicMaterial({ color: 0xddc8ff })),
    power: mat(new THREE.MeshBasicMaterial({ color: 0xffc27a })),
  };
  const ledFields: { mesh: THREE.InstancedMesh; heights: Float32Array; origins: Float32Array }[] = [];
  const makeLedField = (kind: Bay["kind"], count: number) => {
    const mesh = new THREE.InstancedMesh(ledGeo, ledMats[kind], count);
    mesh.count = 0;
    bloom(mesh);
    scene.add(mesh);
    const field = { mesh, heights: new Float32Array(count), origins: new Float32Array(count * 3) };
    ledFields.push(field);
    return field;
  };
  const ledBudget = { compute: 18 * 4, switch: 9 * 5, power: 2 * 6 };
  const fields = {
    compute: makeLedField("compute", ledBudget.compute),
    switch: makeLedField("switch", ledBudget.switch),
    power: makeLedField("power", ledBudget.power),
  };

  const pushLed = (kind: Bay["kind"], x: number, y: number, z: number) => {
    const field = fields[kind];
    const i = field.mesh.count;
    if (i >= field.heights.length) return;
    field.origins[i * 3] = x;
    field.origins[i * 3 + 1] = y;
    field.origins[i * 3 + 2] = z;
    field.heights[i] = y / RACK.h;
    field.mesh.count += 1;
  };

  let heroTray: THREE.Group | null = null;
  let labeledPower = false;

  const trayBody = mat(new THREE.MeshStandardMaterial({ color: 0x232830, metalness: 0.72, roughness: 0.4, envMapIntensity: 0.4 }));
  const switchBody = mat(new THREE.MeshStandardMaterial({ color: 0x1c1a28, metalness: 0.7, roughness: 0.42, envMapIntensity: 0.4 }));
  const powerBody = mat(new THREE.MeshStandardMaterial({ color: 0x2a241c, metalness: 0.65, roughness: 0.45, envMapIntensity: 0.35 }));

  for (const bay of BAYS) {
    const tray = new THREE.Group();
    tray.position.set(0, bay.y, 0);
    const chapter = bay.kind === "switch" ? 1 : bay.kind === "power" ? 0 : bay === HERO_BAY ? 2 : 0;
    add(tray, scene, chapter);
    const bodyMat = bay.kind === "compute" ? trayBody : bay.kind === "switch" ? switchBody : powerBody;
    const shell = box(0.74, bay.h * 0.9, 0.98, bodyMat, tray, chapter);
    shell.position.z = -0.02;
    const lip = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.28, bay.h * 0.55)), faceMaterials[bay.kind]);
    lip.position.set(-0.16, 0, 0.47);
    tray.add(lip);
    const edge = box(0.7, 0.004, 0.012, metal, tray, chapter);
    edge.position.set(0, bay.h * 0.42, 0.47);
    edge.castShadow = false;
    if (bay.kind === "compute") {
      pushLed("compute", 0.28, bay.y, 0.5);
      pushLed("compute", 0.31, bay.y, 0.5);
      if (bay === HERO_BAY) {
        anchor("compute", "Compute trays", tray, [-0.32, bay.h * 0.8, 0.52], ["rack", "open", "scale"], "left");
      }
    } else if (bay.kind === "switch") {
      pushLed("switch", 0.26, bay.y, 0.5);
      pushLed("switch", 0.29, bay.y, 0.5);
      if (bay === SWITCH_BAY) {
        anchor("fabric", "Switch trays", tray, [0.24, 0, 0.52], ["rack", "open", "path", "scale"], "right");
      }
    } else {
      pushLed("power", 0.22, bay.y, 0.5);
      pushLed("power", 0.26, bay.y, 0.5);
      if (!labeledPower && bay.y > 1.5) {
        anchor("power", "Power shelves", tray, [0.05, 0, 0.52], ["rack", "open"], "right");
        labeledPower = true;
      }
    }
    if (bay === HERO_BAY) heroTray = tray;
    if (bay === SWITCH_BAY) {
      const target = new THREE.Object3D();
      target.position.set(0, 0, 0.42);
      target.name = "switch-target";
      tray.add(target);
    }
    if (bay === PEER_BAY) {
      const peer = new THREE.Object3D();
      peer.position.set(0, 0, 0.3);
      tray.add(peer);
      peer.name = "peer";
    }
  }

  if (!heroTray) throw new Error("Hero tray missing");
  const tray = heroTray;
  buildHeroContents(tray);

  const cables: THREE.Mesh[] = [];
  for (const x of [-0.22, -0.08, 0.08, 0.22]) {
    const cable = box(0.012, 0.012, 1, metalDark, tray, 2);
    cable.position.x = x;
    cable.castShadow = false;
    cables.push(cable);
  }

  const pkg = buildPackage(tray);

  anchor("cpu", "Grace-class CPU", tray, [-0.22, 0.08, 0.2], ["tray", "path"], "left", "tray", 0.35);
  anchor("connector", "Backplane link", tray, [0, 0.04, -0.42], ["tray"], "left", "tray", 0.4);

  const inlet = new THREE.Object3D();
  inlet.position.set(-0.1, 0.42, RACK.d / 2 + 0.15);
  scene.add(inlet);
  const cpuAnchorObj = anchors.find((item) => item.id === "cpu")?.object ?? tray;
  const hbmAnchorObj = anchors.find((item) => item.id === "hbm")?.object ?? pkg.group;
  const switchAnchorObj = scene.getObjectByName("switch-target") ?? tray;
  const peerAnchorObj = scene.getObjectByName("peer") ?? tray;

  const streams = [
    makeStream(0xb7f3ff, 16, 0.18),
    makeStream(0xf0a15a, 14, 0.28),
    makeStream(0xf2c56a, 12, 0.55),
    makeStream(0xd2c2ff, 18, 0.16),
  ];

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), mobile ? 0.16 : 0.24, 0.18, 0.42);
  const bloomRender = new RenderPass(scene, camera);
  bloomRender.clearColor = new THREE.Color(0x000000);
  bloomRender.clearAlpha = 1;
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(bloomRender);
  bloomComposer.addPass(bloomPass);

  const mixPass = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
      }
    `,
  }), "baseTexture");
  materials.push(mixPass.material);
  const finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));
  finalComposer.addPass(mixPass);
  finalComposer.addPass(new OutputPass());
  bloomComposer.setPixelRatio(dpr * (mobile ? 0.55 : 0.72));
  finalComposer.setPixelRatio(dpr);

  const color = new THREE.Color();
  const spherical = new THREE.Spherical();
  const look = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const aPoint = new THREE.Vector3();
  const midPoint = new THREE.Vector3();
  const particle = new THREE.Vector3();
  const spotOffset = new THREE.Vector3(0.25, 0.38, 0.42);
  const streamPoints = {
    request: [new THREE.Vector3(), new THREE.Vector3()],
    weights: [new THREE.Vector3(), new THREE.Vector3()],
    fabric: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
  };

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    bloomComposer.setSize(width, height);
    finalComposer.setSize(width, height);
  }

  function update(sample: Sample, time: number, orbit: Orbit, reduced: boolean) {
    const features = sample.features;
    const highlight = sample.beat?.highlight ?? "";
    (coolantMat.uniforms.uTime as THREE.IUniform<number>).value = reduced ? 0 : time;
    door.rotation.y = -1.18 * features.door;
    tray.position.z = MOTION.trayPull * features.tray;
    interior.intensity = 1.5 + features.door * 16;
    slotMat.opacity = 0.22 * features.tray;

    const pull = features.gpu;
    pkg.group.position.set(
      THREE.MathUtils.lerp(MOTION.gpuHome.x, MOTION.gpuPull.x, pull),
      THREE.MathUtils.lerp(MOTION.gpuHome.y, MOTION.gpuPull.y, pull),
      THREE.MathUtils.lerp(MOTION.gpuHome.z, MOTION.gpuPull.z, pull),
    );
    pkg.group.rotation.x = -0.4 * pull;
    pkg.group.rotation.z = 0.06 * pull;
    pkg.setExplode(features.explode);
    pkg.setDie(features.die, highlight, reduced ? 0 : time);

    const cableLength = 0.18 + features.tray * MOTION.trayPull;
    for (const cable of cables) {
      cable.scale.z = cableLength;
      cable.position.y = 0.01;
      cable.position.z = -0.5 - cableLength / 2;
    }

    hbmMat.emissiveIntensity = highlight === "hbm" ? 0.85 : 0.12;
    cpuMat.emissiveIntensity = highlight === "cpu" ? 0.55 : 0.08;
    bridgeMat.emissiveIntensity = highlight === "bridge" || highlight === "nvlink" ? 1.45 : 0.35;

    for (const field of ledFields) {
      for (let i = 0; i < field.mesh.count; i += 1) {
        const lit = field.heights[i] <= features.sweep ? 1 : 0.28;
        const pulse = reduced ? 1 : 0.92 + 0.08 * Math.sin(time * 2.2 + i);
        dummy.position.set(field.origins[i * 3], field.origins[i * 3 + 1], field.origins[i * 3 + 2]);
        dummy.scale.setScalar(lit * pulse);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        field.mesh.setMatrixAt(i, dummy.matrix);
      }
      field.mesh.instanceMatrix.needsUpdate = true;
    }

    const shot = frameShot(sample);
    camPos.set(shot.cam[0], shot.cam[1], shot.cam[2]);
    look.set(shot.look[0], shot.look[1], shot.look[2]);
    if (!reduced) look.y += Math.sin(time * 0.45) * 0.006;
    offset.copy(camPos).sub(look);
    spherical.setFromVector3(offset);
    spherical.theta += orbit.yaw;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + orbit.pitch, 0.18, Math.PI - 0.18);
    offset.setFromSpherical(spherical);
    camera.position.copy(look).add(offset);
    camera.lookAt(look);
    if (Math.abs(camera.fov - shot.fov) > 0.01) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }

    pkg.group.getWorldPosition(heroSpot.target.position);
    heroSpot.position.copy(heroSpot.target.position).add(spotOffset);
    heroSpot.intensity = 6 + features.gpu * 22;
    key.target.position.set(0, HERO_Y, 0.2);

    const flow = features.flow;
    streams.forEach((stream, index) => {
      stream.mesh.visible = flow > 0.04;
      const ids = ["cpu", "hbm", "gpu", "fabric"];
      const emphasized = !highlight || highlight === ids[index];
      (stream.mesh.material as THREE.MeshBasicMaterial).opacity = flow * (emphasized ? 1 : 0.18);
    });
    if (flow > 0.04) {
      inlet.getWorldPosition(streamPoints.request[0]);
      cpuAnchorObj.getWorldPosition(streamPoints.request[1]);
      placeStream(streams[0], streamPoints.request, time, reduced);
      hbmAnchorObj.getWorldPosition(streamPoints.weights[0]);
      pkg.group.getWorldPosition(streamPoints.weights[1]);
      streamPoints.weights[1].y += 0.04;
      placeStream(streams[1], streamPoints.weights, time, reduced);
      pkg.group.getWorldPosition(aPoint);
      placeOrbit(streams[2], aPoint, time, reduced);
      pkg.group.getWorldPosition(streamPoints.fabric[0]);
      switchAnchorObj.getWorldPosition(streamPoints.fabric[1]);
      peerAnchorObj.getWorldPosition(streamPoints.fabric[2]);
      midPoint.copy(streamPoints.fabric[0]).lerp(streamPoints.fabric[1], 0.5);
      midPoint.y += 0.12;
      streamPoints.fabric[1].copy(midPoint);
      placeStream(streams[3], streamPoints.fabric, time, reduced);
    }
  }

  function render() {
    const previous = scene.background;
    scene.background = null;
    camera.layers.set(BLOOM);
    bloomComposer.render();
    scene.background = previous;
    camera.layers.set(0);
    finalComposer.render();
  }

  function pick(clientX: number, clientY: number): number | null {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        if (typeof object.userData.chapter === "number") return object.userData.chapter;
        object = object.parent;
      }
    }
    return null;
  }

  function project(object: THREE.Object3D, width: number, height: number) {
    object.getWorldPosition(projected);
    projected.project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
      behind: projected.z > 1,
    };
  }

  function dispose() {
    bloomComposer.dispose();
    finalComposer.dispose();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    faceTextures.compute.dispose();
    faceTextures.switch.dispose();
    faceTextures.power.dispose();
    renderer.dispose();
  }

  resize();

  return { anchors, update, render, resize, pick, project, dispose };

  function buildHeroContents(parent: THREE.Group) {
    const y = 0.036;
    const cpu = box(0.07, 0.016, 0.07, cpuMat, parent, 2);
    cpu.position.set(-0.22, y, 0.2);
    for (const [dx, dz] of [[-0.05, 0], [0.05, 0], [0, -0.05], [0, 0.05]] as const) {
      const chip = box(0.02, 0.006, 0.016, board, parent, 2);
      chip.position.set(-0.22 + dx, y, 0.2 + dz);
    }
    const cpuB = box(0.07, 0.016, 0.07, cpuMat, parent, 2);
    cpuB.position.set(0.24, y, 0.18);
    const staticGpus: THREE.Vector3Tuple[] = [
      [-0.22, y, -0.08],
      [-0.05, y, -0.08],
      [0.28, y, -0.06],
    ];
    for (const position of staticGpus) {
      const plate = box(0.11, 0.018, 0.08, copper, parent, 2);
      plate.position.set(position[0], position[1], position[2]);
    }
    const fingers = box(0.5, 0.012, 0.03, gold, parent, 2);
    fingers.position.set(0, 0.02, -0.46);
  }

  function buildPackage(parent: THREE.Group) {
    const group = new THREE.Group();
    group.position.set(MOTION.gpuHome.x, MOTION.gpuHome.y, MOTION.gpuHome.z);
    add(group, parent, 3);
    const substrate = box(0.15, 0.008, 0.105, board, group, 4);
    const interposer = box(0.128, 0.0035, 0.088, interposerMat, group, 4);
    interposer.position.y = 0.006;
    const dieA = new THREE.Group();
    const dieB = new THREE.Group();
    group.add(dieA, dieB);
    box(0.056, 0.007, 0.052, silicon, dieA, 5);
    box(0.056, 0.007, 0.052, silicon, dieB, 3);
    const bridge = new THREE.Group();
    group.add(bridge);
    for (let i = 0; i < 6; i += 1) {
      box(0.012, 0.004, 0.006, bridgeMat, bridge, 4).position.set(0, 0, -0.018 + i * 0.007);
    }
    const lid = box(0.132, 0.006, 0.09, metalDark, group, 3);
    const cold = box(0.14, 0.012, 0.098, copper, group, 3);
    for (let i = 0; i < 7; i += 1) {
      const channel = box(0.11, 0.002, 0.004, metalDark, cold, 3);
      channel.position.set(0, 0.007, -0.036 + i * 0.012);
      channel.castShadow = false;
    }
    const stacks: THREE.Object3D[] = [];
    const hbmXs = [-0.058, 0.058];
    for (const x of hbmXs) {
      for (let i = 0; i < 4; i += 1) {
        const stack = new THREE.Group();
        stack.position.set(x, 0.012, -0.034 + i * 0.022);
        group.add(stack);
        stacks.push(stack);
        for (let layer = 0; layer < 8; layer += 1) {
          const layerMesh = box(0.016, 0.0022, 0.018, layer === 0 ? hbmLogic : hbmMat, stack, 4);
          layerMesh.position.y = layer * 0.0024;
          layerMesh.castShadow = false;
        }
      }
    }
    const capGeo = geo(new THREE.CylinderGeometry(0.0022, 0.0022, 0.004, 6));
    const caps = new THREE.InstancedMesh(capGeo, metal, 36);
    group.add(caps);
    const capBase: THREE.Vector3[] = [];
    let capIndex = 0;
    for (let i = 0; i < 36; i += 1) {
      const side = i % 4;
      const along = (i / 4) / 9;
      const x = side < 2 ? -0.07 + along * 0.14 : side === 2 ? -0.07 : 0.07;
      const z = side < 2 ? (side === 0 ? -0.05 : 0.05) : -0.05 + along * 0.1;
      capBase.push(new THREE.Vector3(x, 0.008, z));
      dummy.position.set(x, 0.008, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      caps.setMatrixAt(capIndex, dummy.matrix);
      capIndex += 1;
    }

    const grid = buildDieGrid(dieA);
    anchor("coldplate", "Cold plate", cold, [0, 0.02, 0], ["gpu", "package"], "right");
    anchor("dies", "Compute dies", dieA, [0, 0.02, 0], ["package"], "left", "explode", 0.28);
    anchor("bridge", "Die-to-die link", bridge, [0, 0.02, 0], ["package", "die"], "right", "explode", 0.4);
    anchor("hbm", "HBM3e", stacks[0], [0, 0.03, 0], ["package", "path"], "left", "explode", 0.5);
    anchor("interposer", "Interposer", interposer, [0, 0.02, 0], ["package"], "right", "explode", 0.55);
    anchor("substrate", "Substrate", substrate, [0, -0.01, 0], ["package"], "left", "explode", 0.6);
    anchor("tensor", "Tensor cores", grid.anchors.tensor, [0, 0.01, 0], ["die"], "left", "die", 0.2);
    anchor("cache", "L2 cache", grid.anchors.cache, [0, 0.01, 0], ["die"], "right", "die", 0.2);
    anchor("memory", "Memory controllers", grid.anchors.memory, [0, 0.01, 0], ["die"], "left", "die", 0.2);
    anchor("nvlink", "NVLink blocks", grid.anchors.nvlink, [0, 0.01, 0], ["die"], "right", "die", 0.2);
    anchor("gpu", "Dual-die GPU", group, [0, 0.05, 0], ["tray", "gpu", "path"], "right");

    const restX = { dieA: -0.03, dieB: 0.03 };

    return {
      group,
      setExplode(amount: number) {
        substrate.position.y = 0;
        interposer.position.y = 0.006 + amount * 0.028;
        dieA.position.set(restX.dieA - amount * 0.02, 0.016 + amount * 0.09, 0);
        dieB.position.set(restX.dieB + amount * 0.02, 0.016 + amount * 0.09, 0);
        bridge.position.y = 0.02 + amount * 0.11;
        lid.position.y = 0.034 + amount * 0.15;
        cold.position.y = 0.048 + amount * 0.21;
        stacks.forEach((stack) => {
          const dir = Math.sign(stack.position.x) || 1;
          const baseX = Math.abs(stack.position.x) > 0.05 ? dir * 0.058 : stack.position.x;
          stack.position.x = baseX + dir * amount * 0.028;
          stack.position.y = 0.012 + amount * 0.055;
        });
        capBase.forEach((base, index) => {
          dummy.position.set(base.x, base.y + amount * 0.02, base.z);
          dummy.scale.setScalar(1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          caps.setMatrixAt(index, dummy.matrix);
        });
        caps.instanceMatrix.needsUpdate = true;
      },
      setDie(amount: number, highlight: string, time: number) {
        const show = amount > 0.12 || featuresVisible(amount);
        grid.mesh.visible = show;
        grid.marker.visible = show && Boolean(grid.bounds[highlight as Role]);
        const pulse = 0.78 + 0.22 * Math.sin(time * 3.1);
        for (let i = 0; i < grid.roles.length; i += 1) {
          const role = grid.roles[i];
          const hot = highlight === role;
          color.copy(hot ? ROLE_HOT[role] : ROLE_BASE[role]);
          if (hot) color.multiplyScalar(pulse);
          else if (!highlight) color.lerp(ROLE_HOT[role], 0.18);
          grid.mesh.setColorAt(i, color);
        }
        if (grid.mesh.instanceColor) grid.mesh.instanceColor.needsUpdate = true;
        const bounds = grid.bounds[highlight as Role];
        if (bounds && grid.marker.visible) {
          grid.marker.position.set((bounds.minX + bounds.maxX) / 2, 0.012, (bounds.minZ + bounds.maxZ) / 2);
          grid.marker.scale.set(Math.max(0.008, bounds.maxX - bounds.minX), 1, Math.max(0.008, bounds.maxZ - bounds.minZ));
          markerMat.color.copy(ROLE_HOT[highlight as Role]);
          markerMat.opacity = 0.28 + 0.2 * pulse;
        }
      },
    };

    function featuresVisible(amount: number) {
      return amount > 0.45;
    }
  }

  function buildDieGrid(parent: THREE.Object3D) {
    const cols = 10;
    const rows = 8;
    const cell = geo(new THREE.BoxGeometry(0.0044, 0.0016, 0.0046));
    const mesh = new THREE.InstancedMesh(cell, dieMat, cols * rows);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cols * rows * 3), 3);
    parent.add(mesh);
    const roles: Role[] = [];
    const bounds: Partial<Record<Role, { minX: number; maxX: number; minZ: number; maxZ: number }>> = {};
    const centers: Partial<Record<Role, THREE.Object3D>> = {};
    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const role: Role = col === cols - 1
          ? "bridge"
          : row === 0
            ? "memory"
            : row === rows - 1
              ? "nvlink"
              : row === 3 || row === 4
                ? "cache"
                : "tensor";
        const x = -0.022 + col * 0.0048;
        const z = -0.018 + row * 0.005;
        dummy.position.set(x, 0.005, z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        roles.push(role);
        const span = 0.0024;
        const boxBounds = bounds[role] ?? { minX: x - span, maxX: x + span, minZ: z - span, maxZ: z + span };
        boxBounds.minX = Math.min(boxBounds.minX, x - span);
        boxBounds.maxX = Math.max(boxBounds.maxX, x + span);
        boxBounds.minZ = Math.min(boxBounds.minZ, z - span);
        boxBounds.maxZ = Math.max(boxBounds.maxZ, z + span);
        bounds[role] = boxBounds;
        index += 1;
      }
    }
    const marker = new THREE.Mesh(geo(new THREE.BoxGeometry(1, 0.002, 1)), markerMat);
    marker.position.y = 0.012;
    bloom(marker);
    parent.add(marker);
    (Object.keys(bounds) as Role[]).forEach((role) => {
      const object = new THREE.Object3D();
      const bound = bounds[role];
      if (!bound) return;
      object.position.set((bound.minX + bound.maxX) / 2, 0.01, (bound.minZ + bound.maxZ) / 2);
      parent.add(object);
      centers[role] = object;
    });
    mesh.visible = false;
    marker.visible = false;
    return {
      mesh,
      marker,
      roles,
      bounds,
      anchors: {
        tensor: centers.tensor ?? mesh,
        cache: centers.cache ?? mesh,
        memory: centers.memory ?? mesh,
        nvlink: centers.nvlink ?? mesh,
      },
    };
  }

  function makeStream(colorHex: number, count: number, speed: number) {
    const mesh = new THREE.InstancedMesh(
      geo(new THREE.SphereGeometry(0.011, 8, 8)),
      mat(new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0, depthWrite: false })),
      count,
    );
    bloom(mesh);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, count, speed };
  }

  function placeStream(
    stream: { mesh: THREE.InstancedMesh; count: number; speed: number },
    points: THREE.Vector3[],
    time: number,
    reduced: boolean,
  ) {
    for (let i = 0; i < stream.count; i += 1) {
      const t = reduced ? i / stream.count : (time * stream.speed + i / stream.count) % 1;
      pointOn(points, t, particle);
      dummy.position.copy(particle);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      stream.mesh.setMatrixAt(i, dummy.matrix);
    }
    stream.mesh.instanceMatrix.needsUpdate = true;
  }

  function placeOrbit(
    stream: { mesh: THREE.InstancedMesh; count: number; speed: number },
    center: THREE.Vector3,
    time: number,
    reduced: boolean,
  ) {
    for (let i = 0; i < stream.count; i += 1) {
      const t = reduced ? i / stream.count : (time * stream.speed + i / stream.count) % 1;
      const angle = t * Math.PI * 2;
      dummy.position.set(
        center.x + Math.cos(angle) * 0.14,
        center.y + 0.05 + Math.sin(angle * 2) * 0.02,
        center.z + Math.sin(angle) * 0.1,
      );
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      stream.mesh.setMatrixAt(i, dummy.matrix);
    }
    stream.mesh.instanceMatrix.needsUpdate = true;
  }
}

function pointOn(points: THREE.Vector3[], t: number, target: THREE.Vector3) {
  if (points.length < 3) {
    target.lerpVectors(points[0], points[1], t);
    return;
  }
  const u = 1 - t;
  target.set(0, 0, 0);
  target.addScaledVector(points[0], u * u);
  target.addScaledVector(points[1], 2 * u * t);
  target.addScaledVector(points[2], t * t);
}

function buildNeighbor(
  scene: THREE.Scene,
  box: (w: number, h: number, d: number, material: THREE.Material, parent: THREE.Object3D) => THREE.Mesh,
  x: number,
  z: number,
  scale: number,
) {
  const material = new THREE.MeshStandardMaterial({ color: 0x12141a, metalness: 0.7, roughness: 0.55 });
  const rack = box(0.7 * scale, 2 * scale, 1 * scale, material, scene);
  rack.position.set(x, scale, z);
  rack.castShadow = false;
}

function gridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);
  context.fillStyle = "#0c0d11";
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = "rgba(190, 198, 208, 0.28)";
  context.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    const p = (i / 8) * 512;
    context.beginPath();
    context.moveTo(p, 0);
    context.lineTo(p, 512);
    context.stroke();
    context.beginPath();
    context.moveTo(0, p);
    context.lineTo(512, p);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

function bezelTexture(label: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (!context) return texture;
  context.fillStyle = "#12151b";
  context.fillRect(0, 0, 512, 128);
  context.fillStyle = accent;
  context.fillRect(0, 0, 10, 128);
  context.font = "600 56px sans-serif";
  context.fillStyle = "#ebe6dc";
  context.fillText(label, 32, 82);
  if (label === "FABRIC") {
    for (let i = 0; i < 8; i += 1) {
      context.fillStyle = accent;
      context.fillRect(300 + i * 24, 36, 14, 56);
    }
  }
  return texture;
}
