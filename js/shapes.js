const TWO_PI = Math.PI * 2;

export const PHOTO_PATHS = [
  "assets/photos/photo1.jpg",
  "assets/photos/photo2.jpg",
  "assets/photos/photo3.jpg",
  "assets/photos/photo4.jpg",
  "assets/photos/photo5.jpg"
];

const palettes = {
  birthday: [
    [1.0, 0.78, 0.24],
    [1.0, 0.28, 0.74],
    [0.18, 0.86, 1.0],
    [0.56, 0.42, 1.0]
  ],
  warm: [
    [1.0, 0.56, 0.18],
    [1.0, 0.86, 0.42],
    [1.0, 0.26, 0.35],
    [0.95, 0.42, 0.78]
  ]
};

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function mixColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function randomFromPalette(palette, t = Math.random()) {
  const scaled = t * (palette.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(palette.length - 1, index + 1);
  return mixColor(palette[index], palette[next], scaled - index);
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function normalizeColor(r, g, b, boost = 1.12) {
  return [
    Math.min(1, r / 255 * boost + 0.035),
    Math.min(1, g / 255 * boost + 0.035),
    Math.min(1, b / 255 * boost + 0.035)
  ];
}

function sampleCanvas(canvas, maxPoints, options = {}) {
  const {
    scale = 620,
    zRange = 34,
    alphaThreshold = 34,
    colorMode = "pixel",
    palette = palettes.birthday,
    roleMapper = null,
    density = 0.82,
    sizeMin = 3.2,
    sizeMax = 6.0,
    pointJitter = 1.6,
    brightnessBoost = 1.18
  } = options;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const step = Math.max(2, Math.floor(Math.sqrt((width * height) / maxPoints) * density));
  const points = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const offsetX = Math.min(width - 1, x + Math.floor(Math.random() * step));
      const offsetY = Math.min(height - 1, y + Math.floor(Math.random() * step));
      const index = (offsetY * width + offsetX) * 4;
      const alpha = data[index + 3];

      if (alpha <= alphaThreshold) continue;

      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
      const color = colorMode === "palette"
        ? randomFromPalette(palette, offsetX / width)
        : normalizeColor(r, g, b, brightnessBoost);

      points.push({
        x: (offsetX / width - 0.5) * scale + (Math.random() - 0.5) * pointJitter,
        y: -(offsetY / height - 0.5) * (scale * height / width) + (Math.random() - 0.5) * pointJitter,
        z: (luminance - 0.5) * zRange + (Math.random() - 0.5) * zRange * 0.28,
        color,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        role: roleMapper ? roleMapper({ x: offsetX, y: offsetY, r, g, b, a: alpha }) : 0
      });
    }
  }

  if (points.length > maxPoints) {
    shuffle(points);
    points.length = maxPoints;
  }

  return points;
}

export function createTextShape(text = "生日快乐", count = 9000) {
  const canvas = createCanvas(1900, 680);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(150, 0, canvas.width - 150, 0);
  gradient.addColorStop(0, "#ffe16b");
  gradient.addColorStop(0.34, "#ff54c8");
  gradient.addColorStop(0.66, "#34e8ff");
  gradient.addColorStop(1, "#8c72ff");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  const chars = [...text];
  let fontSize = 354;
  let tracking = 50;
  let widths = [];
  let totalWidth = 0;
  do {
    ctx.font = `900 ${fontSize}px "Microsoft YaHei", "PingFang SC", "SimHei", sans-serif`;
    widths = chars.map((char) => ctx.measureText(char).width);
    totalWidth = widths.reduce((sum, width) => sum + width, 0) + tracking * (chars.length - 1);
    fontSize -= 4;
  } while (totalWidth > canvas.width * 0.92 && fontSize > 244);

  const y = canvas.height / 2 + 20;
  let x = (canvas.width - totalWidth) / 2;
  chars.forEach((char, index) => {
    const charX = x + widths[index] / 2;
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#4f36ff";
    ctx.strokeText(char, charX, y);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.58)";
    ctx.strokeText(char, charX, y);
    ctx.fillStyle = gradient;
    ctx.fillText(char, charX, y);
    x += widths[index] + tracking;
  });

  return sampleCanvas(canvas, count, {
    scale: 1340,
    zRange: 30,
    alphaThreshold: 155,
    colorMode: "pixel",
    density: 0.54,
    sizeMin: 1.38,
    sizeMax: 2.45,
    pointJitter: 0.55,
    brightnessBoost: 0.86
  });
}

export function createSmileShape(count = 9000) {
  const canvas = createCanvas(900, 900);
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.lineWidth = 48;
  ctx.strokeStyle = "#ffd84a";
  ctx.beginPath();
  ctx.arc(cx, cy, 315, 0, TWO_PI);
  ctx.stroke();

  ctx.lineWidth = 18;
  ctx.strokeStyle = "#ff4fc3";
  ctx.beginPath();
  ctx.arc(cx, cy, 352, 0, TWO_PI);
  ctx.stroke();

  ctx.fillStyle = "#35f4ff";
  ctx.beginPath();
  ctx.ellipse(cx - 122, cy - 92, 42, 62, -0.08, 0, TWO_PI);
  ctx.ellipse(cx + 122, cy - 92, 42, 62, 0.08, 0, TWO_PI);
  ctx.fill();

  ctx.strokeStyle = "#ff4fc3";
  ctx.lineWidth = 68;
  ctx.beginPath();
  ctx.arc(cx, cy + 10, 190, 0.18 * Math.PI, 0.82 * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 17;
  ctx.beginPath();
  ctx.moveTo(cx - 116, cy + 150);
  ctx.quadraticCurveTo(cx, cy + 202, cx + 116, cy + 150);
  ctx.stroke();

  ctx.fillStyle = "#ff7ad9";
  ctx.beginPath();
  ctx.arc(cx - 210, cy + 42, 30, 0, TWO_PI);
  ctx.arc(cx + 210, cy + 42, 30, 0, TWO_PI);
  ctx.fill();

  return sampleCanvas(canvas, count, {
    scale: 780,
    zRange: 60,
    alphaThreshold: 120,
    colorMode: "pixel",
    density: 0.56,
    sizeMin: 2.35,
    sizeMax: 4.25,
    pointJitter: 0.9,
    brightnessBoost: 1.0
  });
}

async function drawPhotoPendant(ctx, url, index, x, y, width, height, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = 0.5;

  ctx.strokeStyle = "rgba(255, 230, 120, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, -height * 0.5);
  ctx.stroke();

  const radius = Math.min(width, height) / 2;
  const shine = ctx.createRadialGradient(-radius * 0.35, -radius * 0.35, 1, 0, 0, radius);
  shine.addColorStop(0, "rgba(255, 255, 255, 0.96)");
  shine.addColorStop(0.28, "rgba(255, 235, 135, 0.82)");
  shine.addColorStop(1, "rgba(255, 143, 220, 0.58)");
  ctx.fillStyle = shine;
  ctx.strokeStyle = "rgba(255, 221, 96, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TWO_PI);
  ctx.fill();
  ctx.stroke();

  const innerRadius = Math.max(4, radius - 4);

  try {
    const image = await loadImage(url);
    const innerSize = innerRadius * 2;
    const ratio = Math.max(innerSize / image.width, innerSize / image.height);
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, TWO_PI);
    ctx.clip();
    ctx.drawImage(
      image,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );
    ctx.restore();
  } catch {
    const fallback = ctx.createRadialGradient(0, 0, 1, 0, 0, innerRadius);
    fallback.addColorStop(0, "#ff4fc3");
    fallback.addColorStop(1, "#35f4ff");
    ctx.fillStyle = fallback;
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, TWO_PI);
    ctx.fill();
  }
  ctx.restore();
}

async function drawCakePhotoPendants(ctx) {
  const placements = [
    [PHOTO_PATHS[0], 0, 330, 608, 22, 22, -0.08],
    [PHOTO_PATHS[1], 1, 420, 500, 20, 20, 0.05],
    [PHOTO_PATHS[2], 2, 490, 574, 24, 24, 0],
    [PHOTO_PATHS[3], 3, 560, 500, 20, 20, -0.05],
    [PHOTO_PATHS[4], 4, 650, 608, 22, 22, 0.08]
  ];

  for (const placement of placements) {
    await drawPhotoPendant(ctx, ...placement);
  }
}

export async function createCakeShape(count = 9000) {
  const canvas = createCanvas(980, 840);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillTier(x, y, w, h, topColor, bottomColor) {
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    roundRect(x, y, w, h, 32);
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(255, 231, 122, 0.9)";
    ctx.stroke();
  }

  fillTier(135, 560, 710, 165, "#ff2f91", "#ff8a00");
  fillTier(215, 420, 550, 145, "#ff4fc3", "#7b61ff");
  fillTier(305, 300, 370, 125, "#ffcf2e", "#ff4f9d");

  ctx.fillStyle = "#ffd84f";
  for (const [x, y, w, drops] of [[122, 536, 736, 11], [202, 397, 576, 9], [292, 278, 396, 7]]) {
    roundRect(x, y, w, 52, 24);
    ctx.fill();
    for (let i = 0; i < drops; i += 1) {
      ctx.beginPath();
      ctx.arc(x + 42 + i * (w - 84) / Math.max(1, drops - 1), y + 51, 26, 0, Math.PI);
      ctx.fill();
    }
  }

  ctx.lineWidth = 18;
  ctx.strokeStyle = "#20f0ff";
  ctx.beginPath();
  ctx.moveTo(178, 642);
  ctx.lineTo(800, 642);
  ctx.moveTo(250, 492);
  ctx.lineTo(730, 492);
  ctx.moveTo(350, 356);
  ctx.lineTo(630, 356);
  ctx.stroke();

  const candleColors = ["#35f4ff", "#ff4fc3", "#8b6dff"];
  [392, 490, 588].forEach((x, i) => {
    ctx.fillStyle = candleColors[i];
    roundRect(x - 20, 172, 40, 118, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x - 12, 182);
    ctx.lineTo(x + 13, 280);
    ctx.stroke();

    const flame = ctx.createRadialGradient(x, 116, 4, x, 126, 58);
    flame.addColorStop(0, "#ffffff");
    flame.addColorStop(0.25, "#ffe86b");
    flame.addColorStop(0.7, "#ff732e");
    flame.addColorStop(1, "rgba(255, 64, 64, 0.8)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(x, 58);
    ctx.bezierCurveTo(x + 54, 115, x + 18, 150, x, 158);
    ctx.bezierCurveTo(x - 42, 140, x - 32, 98, x, 58);
    ctx.fill();
  });

  const sprinkleColors = ["#35f4ff", "#ff4fc3", "#ffe16b", "#8b6dff", "#ffffff"];
  for (let i = 0; i < 58; i += 1) {
    const tier = i % 3;
    const bounds = [
      [180, 598, 620, 95],
      [255, 454, 470, 80],
      [340, 326, 300, 64]
    ][tier];
    ctx.fillStyle = sprinkleColors[i % sprinkleColors.length];
    ctx.beginPath();
    ctx.arc(
      bounds[0] + Math.random() * bounds[2],
      bounds[1] + Math.random() * bounds[3],
      6 + Math.random() * 5,
      0,
      TWO_PI
    );
    ctx.fill();
  }

  await drawCakePhotoPendants(ctx);

  return sampleCanvas(canvas, count, {
    scale: 930,
    zRange: 62,
    alphaThreshold: 68,
    colorMode: "pixel",
    density: 0.52,
    sizeMin: 2.05,
    sizeMax: 3.65,
    pointJitter: 0.85,
    brightnessBoost: 0.86,
    roleMapper: ({ x, y, r, g, b }) => (y < 172 && r > 210 && g > 70 && b < 125 && x > 335 && x < 635 ? 1 : 0)
  });
}

function drawPlaceholderPhoto(canvas, index) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const hue = (index * 48 + 12) % 360;

  const sky = ctx.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, `hsl(${hue}, 88%, 54%)`);
  sky.addColorStop(0.38, `hsl(${(hue + 74) % 360}, 86%, 48%)`);
  sky.addColorStop(1, "#07101e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 120; i += 1) {
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2.4 + 0.8, 0, TWO_PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(width / 2, height / 2 + 26);
  ctx.rotate(-0.04 + index * 0.018);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(-218, -250, 436, 500);
  ctx.fillStyle = `hsl(${(hue + 150) % 360}, 88%, 58%)`;
  ctx.fillRect(-188, -214, 376, 360);

  const inner = ctx.createRadialGradient(-80, -90, 20, 0, -10, 300);
  inner.addColorStop(0, "#fff0a8");
  inner.addColorStop(0.42, "#ff66bb");
  inner.addColorStop(1, "#20e6ff");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(0, -22, 142, 0, TWO_PI);
  ctx.fill();

  ctx.fillStyle = "#101827";
  ctx.font = "900 74px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`PHOTO ${index + 1}`, 0, 196);
  ctx.restore();

  ctx.fillStyle = "#ffe16b";
  ctx.font = "900 56px 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("生日回忆", width / 2, 98);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `${url}?v=${Date.now()}`;
  });
}

export async function createPhotoShape(url, count = 9000, options = {}) {
  const canvas = createCanvas(760, 760);
  const ctx = canvas.getContext("2d");
  const index = options.index ?? 0;

  try {
    const image = await loadImage(url);
    const ratio = Math.max(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, x, y, width, height);
  } catch {
    drawPlaceholderPhoto(canvas, index);
  }

  return sampleCanvas(canvas, count, {
    scale: 620,
    zRange: 68,
    alphaThreshold: 6,
    colorMode: "pixel",
    density: 0.7
  });
}

export function createScatterTargets(count = 9000) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const radius = 250 + Math.random() * 520;
    const theta = Math.random() * TWO_PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const color = randomFromPalette(palettes.birthday);
    points.push({
      x: radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.sin(phi) * Math.sin(theta),
      z: radius * Math.cos(phi) - 70,
      color,
      size: 2.4 + Math.random() * 3.2,
      role: 0
    });
  }
  return points;
}
