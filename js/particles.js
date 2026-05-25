import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createScatterTargets } from "./shapes.js";

const vertexShader = `
  attribute float aSize;
  attribute float aRole;
  varying vec3 vColor;
  varying float vRole;
  uniform float uTime;
  uniform float uPixelRatio;

  void main() {
    vColor = color;
    vRole = aRole;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float pulse = 1.0 + 0.18 * sin(uTime * 2.2 + position.x * 0.018 + position.y * 0.012);
    float flame = mix(1.0, 1.0 + 0.55 * sin(uTime * 18.0 + position.x * 0.1), step(0.5, aRole));
    gl_PointSize = aSize * pulse * flame * uPixelRatio * (560.0 / max(70.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vRole;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float distanceToCenter = length(uv);
    float core = smoothstep(0.5, 0.04, distanceToCenter);
    float halo = smoothstep(0.5, 0.0, distanceToCenter) * 0.42;
    vec3 flameBoost = mix(vec3(1.0), vec3(1.28, 0.92, 0.58), step(0.5, vRole));
    gl_FragColor = vec4(vColor * flameBoost, core + halo);
  }
`;

export class ParticleSystem {
  constructor(container, options = {}) {
    this.container = container;
    this.count = options.count ?? (window.innerWidth < 820 ? 6500 : 10000);
    this.mode = "初始化";
    this.motionMode = "none";
    this.clock = new THREE.Clock();

    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.sizes = new Float32Array(this.count);
    this.roles = new Float32Array(this.count);
    this.targetPositions = new Float32Array(this.count * 3);
    this.targetColors = new Float32Array(this.count * 3);
    this.targetSizes = new Float32Array(this.count);
    this.targetRoles = new Float32Array(this.count);
    this.velocities = new Float32Array(this.count * 3);
    this.seeds = new Float32Array(this.count);

    this.initRenderer();
    this.initParticles();
    this.initStars();
    this.bindResize();
  }

  initRenderer() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05070d, 0.00115);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 1, 2600);
    this.camera.position.set(0, 0, 760);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.container.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.64,
      0.42,
      0.14
    );
    this.composer.addPass(this.bloomPass);
  }

  initParticles() {
    const scatter = createScatterTargets(this.count);
    for (let i = 0; i < this.count; i += 1) {
      const p = scatter[i];
      const index = i * 3;
      this.positions[index] = p.x;
      this.positions[index + 1] = p.y;
      this.positions[index + 2] = p.z;
      this.targetPositions[index] = p.x;
      this.targetPositions[index + 1] = p.y;
      this.targetPositions[index + 2] = p.z;

      this.colors[index] = p.color[0];
      this.colors[index + 1] = p.color[1];
      this.colors[index + 2] = p.color[2];
      this.targetColors[index] = p.color[0];
      this.targetColors[index + 1] = p.color[1];
      this.targetColors[index + 2] = p.color[2];

      this.sizes[i] = p.size;
      this.targetSizes[i] = p.size;
      this.roles[i] = 0;
      this.targetRoles[i] = 0;
      this.seeds[i] = Math.random();
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute("aRole", new THREE.BufferAttribute(this.roles, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  initStars() {
    const starCount = 1300;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i += 1) {
      const index = i * 3;
      positions[index] = (Math.random() - 0.5) * 2200;
      positions[index + 1] = (Math.random() - 0.5) * 1300;
      positions[index + 2] = -400 - Math.random() * 1400;
      const warmth = Math.random();
      colors[index] = 0.45 + warmth * 0.55;
      colors[index + 1] = 0.65 + Math.random() * 0.35;
      colors[index + 2] = 0.9 + Math.random() * 0.1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 1.5,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });
    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
  }

  bindResize() {
    window.addEventListener("resize", () => {
      const { innerWidth, innerHeight } = window;
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
      this.bloomPass.setSize(innerWidth, innerHeight);
      this.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    });
  }

  setTarget(points, options = {}) {
    if (!points?.length) return;

    const jitter = options.jitter ?? 2.2;
    const force = options.force ?? 0.0;
    this.mode = options.label ?? options.mode ?? "粒子形态";
    this.motionMode = options.motion ?? "none";

    for (let i = 0; i < this.count; i += 1) {
      const sourceIndex = Math.floor((i * 1.61803398875 + Math.random() * points.length) % points.length);
      const point = points[sourceIndex];
      const index = i * 3;
      const seed = this.seeds[i];
      const wave = Math.sin(seed * Math.PI * 2);

      this.targetPositions[index] = point.x + (Math.random() - 0.5) * jitter;
      this.targetPositions[index + 1] = point.y + (Math.random() - 0.5) * jitter;
      this.targetPositions[index + 2] = point.z + wave * 8 + (Math.random() - 0.5) * jitter * 2;

      this.targetColors[index] = point.color?.[0] ?? 1;
      this.targetColors[index + 1] = point.color?.[1] ?? 0.82;
      this.targetColors[index + 2] = point.color?.[2] ?? 0.42;
      this.targetSizes[i] = point.size ?? 4.6;
      this.targetRoles[i] = point.role ?? 0;

      if (force > 0) {
        this.velocities[index] += (Math.random() - 0.5) * force;
        this.velocities[index + 1] += (Math.random() - 0.5) * force;
        this.velocities[index + 2] += (Math.random() - 0.5) * force;
      }
    }
  }

  scatter(options = {}) {
    const points = createScatterTargets(this.count);
    this.setTarget(points, {
      label: options.label ?? "自由漂浮",
      jitter: 10,
      force: options.burst ? 9 : 1.5
    });

    if (options.burst) {
      for (let i = 0; i < this.count; i += 1) {
        const index = i * 3;
        const length = Math.hypot(this.positions[index], this.positions[index + 1], this.positions[index + 2]) || 1;
        const power = 4 + Math.random() * 10;
        this.velocities[index] += this.positions[index] / length * power;
        this.velocities[index + 1] += this.positions[index + 1] / length * power;
        this.velocities[index + 2] += this.positions[index + 2] / length * power;
      }
    }
  }

  update(delta, elapsed) {
    const dt = Math.min(delta, 0.05) * 60;
    const spring = 0.0175 * dt;
    const drag = Math.pow(0.86, dt);
    const colorFollow = Math.min(1, 0.06 * dt);
    const sizeFollow = Math.min(1, 0.08 * dt);
    const roleFollow = Math.min(1, 0.12 * dt);

    this.material.uniforms.uTime.value = elapsed;

    for (let i = 0; i < this.count; i += 1) {
      const index = i * 3;
      const seed = this.seeds[i];
      const tx = this.targetPositions[index];
      const bounce = this.motionMode === "bounce"
        ? Math.sin(elapsed * 4.4) * 10 + Math.sin(elapsed * 8.8) * 2
        : 0;
      const ty = this.targetPositions[index + 1] + bounce;
      const tz = this.targetPositions[index + 2];

      const swirlX = Math.sin(elapsed * 0.75 + seed * 16.0) * 0.028 * dt;
      const swirlY = Math.cos(elapsed * 0.68 + seed * 12.0) * 0.028 * dt;

      this.velocities[index] += (tx - this.positions[index]) * spring + swirlX;
      this.velocities[index + 1] += (ty - this.positions[index + 1]) * spring + swirlY;
      this.velocities[index + 2] += (tz - this.positions[index + 2]) * spring * 0.92;

      this.velocities[index] *= drag;
      this.velocities[index + 1] *= drag;
      this.velocities[index + 2] *= drag;

      this.positions[index] += this.velocities[index] * dt;
      this.positions[index + 1] += this.velocities[index + 1] * dt;
      this.positions[index + 2] += this.velocities[index + 2] * dt;

      this.colors[index] += (this.targetColors[index] - this.colors[index]) * colorFollow;
      this.colors[index + 1] += (this.targetColors[index + 1] - this.colors[index + 1]) * colorFollow;
      this.colors[index + 2] += (this.targetColors[index + 2] - this.colors[index + 2]) * colorFollow;
      this.sizes[i] += (this.targetSizes[i] - this.sizes[i]) * sizeFollow;
      this.roles[i] += (this.targetRoles[i] - this.roles[i]) * roleFollow;
    }

    this.points.rotation.y = Math.sin(elapsed * 0.16) * 0.075;
    this.points.rotation.x = Math.sin(elapsed * 0.12) * 0.035;
    this.stars.rotation.y += delta * 0.018;
    this.stars.rotation.x = Math.sin(elapsed * 0.05) * 0.025;

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aRole.needsUpdate = true;
  }

  render() {
    this.composer.render();
  }
}
