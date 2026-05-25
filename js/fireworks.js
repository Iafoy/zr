import * as THREE from "three";

const vertexShader = `
  attribute float aAlpha;
  attribute float aSize;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uPixelRatio;

  void main() {
    vColor = color;
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (660.0 / max(80.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float distanceToCenter = length(uv);
    float alpha = smoothstep(0.5, 0.02, distanceToCenter) * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const COLORS = [
  [1.0, 0.76, 0.24],
  [1.0, 0.94, 0.58],
  [1.0, 0.18, 0.28],
  [0.2, 0.82, 1.0],
  [0.58, 0.38, 1.0],
  [1.0, 0.32, 0.74],
  [0.48, 1.0, 0.68]
];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function mixColor(a, b, amount) {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount
  ];
}

export class FireworkSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.maxParticles = options.maxParticles ?? 6200;
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.alphas = new Float32Array(this.maxParticles);
    this.sizes = new Float32Array(this.maxParticles);
    this.velocities = new Float32Array(this.maxParticles * 3);
    this.life = new Float32Array(this.maxParticles);
    this.nextIndex = 0;
    this.rockets = [];
    this.elapsed = 0;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute("aAlpha", new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(this.sizes, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
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

    window.addEventListener("resize", () => {
      this.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    });
  }

  launchShow(now = this.elapsed) {
    if (now > this.elapsed + 10) {
      now = this.elapsed;
    }

    const rocketCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < rocketCount; i += 1) {
      this.rockets.push({
        delay: now + i * 0.11,
        x: -360 + Math.random() * 720,
        y: -470 - Math.random() * 70,
        z: -140 + Math.random() * 220,
        vx: -1.3 + Math.random() * 2.6,
        vy: 13.0 + Math.random() * 3.8,
        fuse: 1.0 + Math.random() * 0.36,
        color: randomColor(),
        accent: randomColor(),
        spin: Math.random() * Math.PI * 2
      });
    }
  }

  spawnParticle(x, y, z, vx, vy, vz, color, life, size) {
    const i = this.nextIndex;
    const index = i * 3;
    this.nextIndex = (this.nextIndex + 1) % this.maxParticles;

    this.positions[index] = x;
    this.positions[index + 1] = y;
    this.positions[index + 2] = z;
    this.velocities[index] = vx;
    this.velocities[index + 1] = vy;
    this.velocities[index + 2] = vz;
    this.colors[index] = color[0];
    this.colors[index + 1] = color[1];
    this.colors[index + 2] = color[2];
    this.life[i] = life;
    this.alphas[i] = 1;
    this.sizes[i] = size;
  }

  explode(rocket) {
    const color = rocket.color;
    const accent = rocket.accent ?? randomColor();
    const particles = 230 + Math.floor(Math.random() * 130);
    for (let i = 0; i < particles; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 2.8 + Math.random() * 7.4;
      this.spawnParticle(
        rocket.x,
        rocket.y,
        rocket.z,
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed,
        Math.random() > 0.34 ? mixColor(color, accent, Math.random() * 0.55) : randomColor(),
        1.0 + Math.random() * 1.1,
        4.8 + Math.random() * 5.8
      );
    }

    const ringCount = 92 + Math.floor(Math.random() * 54);
    for (let i = 0; i < ringCount; i += 1) {
      const theta = (i / ringCount) * Math.PI * 2 + rocket.spin;
      const wobble = Math.sin(theta * 3 + rocket.spin) * 0.28;
      const speed = 5.0 + Math.random() * 2.5;
      this.spawnParticle(
        rocket.x,
        rocket.y,
        rocket.z,
        Math.cos(theta) * speed,
        Math.sin(theta) * speed * 0.82 + wobble,
        Math.sin(theta * 2.0 + rocket.spin) * 1.45,
        mixColor(accent, [1, 0.9, 0.42], Math.random() * 0.42),
        1.2 + Math.random() * 0.8,
        5.5 + Math.random() * 4.8
      );
    }

    const starRays = 9 + Math.floor(Math.random() * 5);
    for (let ray = 0; ray < starRays; ray += 1) {
      const theta = (ray / starRays) * Math.PI * 2 + rocket.spin;
      for (let j = 0; j < 12; j += 1) {
        const speed = 3.2 + j * 0.46 + Math.random() * 0.55;
        this.spawnParticle(
          rocket.x,
          rocket.y,
          rocket.z,
          Math.cos(theta) * speed + (Math.random() - 0.5) * 0.42,
          Math.sin(theta) * speed + (Math.random() - 0.5) * 0.42,
          (Math.random() - 0.5) * 1.8,
          j % 2 ? color : accent,
          0.85 + Math.random() * 0.9,
          3.8 + Math.random() * 3.2
        );
      }
    }

    const glitterCount = 95 + Math.floor(Math.random() * 70);
    for (let i = 0; i < glitterCount; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 3.2;
      this.spawnParticle(
        rocket.x + (Math.random() - 0.5) * 28,
        rocket.y + (Math.random() - 0.5) * 28,
        rocket.z + (Math.random() - 0.5) * 28,
        Math.cos(theta) * speed,
        Math.sin(theta) * speed - Math.random() * 1.2,
        (Math.random() - 0.5) * 2.2,
        Math.random() > 0.5 ? [1.0, 0.88, 0.48] : randomColor(),
        1.45 + Math.random() * 1.25,
        2.0 + Math.random() * 2.8
      );
    }
  }

  update(delta, elapsed) {
    this.elapsed = elapsed;
    const dt = Math.min(delta, 0.05) * 60;

    for (let r = this.rockets.length - 1; r >= 0; r -= 1) {
      const rocket = this.rockets[r];
      if (elapsed < rocket.delay) continue;

      rocket.x += rocket.vx * dt;
      rocket.y += rocket.vy * dt;
      rocket.z += Math.sin(elapsed * 4 + r) * 0.32 * dt;
      rocket.vy -= 0.09 * dt;
      rocket.fuse -= delta;

      for (let trail = 0; trail < 3; trail += 1) {
        this.spawnParticle(
          rocket.x + (Math.random() - 0.5) * 9,
          rocket.y + (Math.random() - 0.5) * 9,
          rocket.z + (Math.random() - 0.5) * 9,
          (Math.random() - 0.5) * 1.15,
          -2.2 - Math.random() * 1.65,
          (Math.random() - 0.5) * 1.15,
          trail === 0 ? rocket.color : mixColor(rocket.color, [1, 0.92, 0.55], Math.random() * 0.65),
          0.42 + Math.random() * 0.2,
          3.0 + Math.random() * 3.2
        );
      }

      if (rocket.fuse <= 0 || rocket.vy <= 0.4) {
        this.explode(rocket);
        this.rockets.splice(r, 1);
      }
    }

    for (let i = 0; i < this.maxParticles; i += 1) {
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        continue;
      }

      const index = i * 3;
      this.velocities[index] *= Math.pow(0.988, dt);
      this.velocities[index + 1] = this.velocities[index + 1] * Math.pow(0.988, dt) - 0.052 * dt;
      this.velocities[index + 2] *= Math.pow(0.988, dt);

      this.positions[index] += this.velocities[index] * dt;
      this.positions[index + 1] += this.velocities[index + 1] * dt;
      this.positions[index + 2] += this.velocities[index + 2] * dt;

      this.life[i] -= delta;
      const twinkle = 0.68 + Math.sin(elapsed * 18 + i * 0.37) * 0.22 + Math.random() * 0.08;
      this.alphas[i] = Math.max(0, Math.min(1, this.life[i] * twinkle));
      this.sizes[i] *= Math.pow(0.989, dt);
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
  }
}
