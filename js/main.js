import { ParticleSystem } from "./particles.js";
import { FireworkSystem } from "./fireworks.js";
import { GestureController, gestureLabel } from "./gesture.js";
import {
  PHOTO_PATHS,
  createCakeShape,
  createSmileShape,
  createTextShape
} from "./shapes.js";

const photos = [...PHOTO_PATHS];
const state = {
  particleMode: "初始化",
  photoMode: false,
  currentPhotoIndex: 0,
  lastFireworkAt: 0,
  lastPhotoPinchAt: 0,
  photoPinchDown: false,
  lastShapeKey: "",
  photoToken: 0,
  fps: 0
};

const ui = {
  handCount: document.querySelector("#handCount"),
  leftGesture: document.querySelector("#leftGesture"),
  rightGesture: document.querySelector("#rightGesture"),
  particleMode: document.querySelector("#particleMode"),
  photoIndex: document.querySelector("#photoIndex"),
  fps: document.querySelector("#fps"),
  systemMessage: document.querySelector("#systemMessage"),
  video: document.querySelector("#cameraVideo"),
  photoShowcase: document.querySelector("#photoShowcase"),
  photoImage: document.querySelector("#photoDisplay"),
  photoCaption: document.querySelector("#photoCaption"),
  cakePendants: document.querySelector("#cakePendants")
};

const sceneRoot = document.querySelector("#sceneRoot");
const particleCount = window.innerWidth < 820 ? 6500 : 10000;
const particles = new ParticleSystem(sceneRoot, { count: particleCount });
const fireworks = new FireworkSystem(particles.scene);

const shapeCache = new Map();
const PHOTO_PINCH_COOLDOWN_MS = 950;

function renderCakePendants() {
  const positions = [
    { left: 31, top: 72, tilt: -7 },
    { left: 41, top: 61, tilt: 4 },
    { left: 50, top: 70, tilt: -1 },
    { left: 59, top: 61, tilt: -4 },
    { left: 69, top: 72, tilt: 7 }
  ];

  ui.cakePendants.innerHTML = photos
    .slice(0, 5)
    .map((src, index) => {
      const position = positions[index] ?? positions[positions.length - 1];
      return `
        <div class="cake-pendant" style="left:${position.left}%;top:${position.top}%;--tilt:${position.tilt}deg;--delay:${index * 0.22}s">
          <img src="${src}" alt="">
          <span>${index + 1}</span>
        </div>
      `;
    })
    .join("");
}

function setCakePendantsVisible(visible, background = false) {
  ui.cakePendants.classList.toggle("is-active", visible);
  ui.cakePendants.classList.toggle("is-background", visible && background);
}

function setMessage(message) {
  ui.systemMessage.textContent = message;
}

function setMode(label, key) {
  state.particleMode = label;
  state.lastShapeKey = key;
  ui.particleMode.textContent = label;
}

function updatePhotoUi() {
  ui.photoIndex.textContent = state.photoMode ? `${state.currentPhotoIndex + 1} / ${photos.length}` : "-";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hidePhotoOverlay() {
  ui.photoShowcase.classList.remove("is-active", "is-switching");
  ui.photoImage.removeAttribute("src");
  setCakePendantsVisible(false);
}

function resetPhotoPinch() {
  state.photoPinchDown = false;
}

function showPhotoOverlay(index, switching = false) {
  if (switching) {
    ui.photoShowcase.classList.add("is-switching");
  }

  window.setTimeout(() => {
    ui.photoImage.src = photos[index];
    ui.photoCaption.textContent = `PHOTO ${index + 1}`;
    ui.photoShowcase.classList.remove("is-switching");
    ui.photoShowcase.classList.add("is-active");
  }, switching ? 260 : 0);
}

function getCachedShape(key, factory) {
  if (!shapeCache.has(key)) {
    shapeCache.set(key, Promise.resolve(factory()));
  }
  return shapeCache.get(key);
}

async function showShape(key, label, factory, options = {}) {
  if (state.lastShapeKey === key) return;
  state.photoMode = false;
  hidePhotoOverlay();
  updatePhotoUi();
  const points = await getCachedShape(key, factory);
  particles.setTarget(points, { label, jitter: options.jitter ?? 1.2, motion: options.motion ?? "none" });
  setCakePendantsVisible(key === "cake");
  setMode(label, key);
}

function scatter(label = "自由漂浮", burst = true) {
  if (state.lastShapeKey === "scatter" && !burst) return;
  state.photoMode = false;
  hidePhotoOverlay();
  resetPhotoPinch();
  particles.scatter({ label, burst });
  setMode(label, "scatter");
  updatePhotoUi();
}

async function showPhoto(index, { burst = false, resetToFirst = false } = {}) {
  const normalized = (index + photos.length) % photos.length;
  const key = `photo-direct-${normalized}`;
  const token = ++state.photoToken;

  state.photoMode = true;
  state.currentPhotoIndex = normalized;
  updatePhotoUi();

  if (burst) {
    showPhotoOverlay(normalized, true);
    await delay(260);
  }

  if (token !== state.photoToken) return;

  const cakePoints = await getCachedShape("cake-pendants", () => createCakeShape(particles.count));

  if (token !== state.photoToken) return;
  particles.setTarget(cakePoints, { label: "照片挂坠蛋糕", jitter: 0.35 });
  setCakePendantsVisible(true, true);
  if (!burst) {
    showPhotoOverlay(normalized, false);
  }
  setMode(resetToFirst ? "照片模式" : `照片 ${normalized + 1}`, key);
  setMessage("照片模式：照片直接放大显示，捏一下切换下一张");
}

function handleSingleHand(snapshot) {
  const hand = snapshot.hands[0];
  if (!hand || hand.gesture === "none") return;

  switch (hand.gesture) {
    case "one":
      showShape("text-birthday", "生日快乐", () => createTextShape("生日快乐", particles.count), { jitter: 0.18, motion: "bounce" });
      break;
    case "two":
      showShape("smile", "大笑脸", () => createSmileShape(particles.count), { jitter: 0.45 });
      break;
    case "fist":
      showShape("cake", "生日蛋糕", () => createCakeShape(particles.count), { jitter: 0.45 });
      break;
    case "open":
      scatter("祝福星云", true);
      break;
    default:
      break;
  }
}

function findHands(snapshot) {
  return {
    fists: snapshot.hands.filter((hand) => hand.gesture === "fist"),
    opens: snapshot.hands.filter((hand) => hand.gesture === "open"),
    digits: snapshot.hands.filter((hand) => ["one", "two", "three"].includes(hand.gesture))
  };
}

function hasPinch(snapshot) {
  return snapshot.hands.some((hand) => hand.gesture === "pinch" || hand.rawGesture === "pinch");
}

function handlePhotoPinch(snapshot, now = performance.now()) {
  if (!state.photoMode) {
    resetPhotoPinch();
    return false;
  }

  const pinching = hasPinch(snapshot);
  if (!pinching) {
    resetPhotoPinch();
    return false;
  }

  if (!state.photoPinchDown && now - state.lastPhotoPinchAt > PHOTO_PINCH_COOLDOWN_MS) {
    state.photoPinchDown = true;
    state.lastPhotoPinchAt = now;
    showPhoto((state.currentPhotoIndex + 1) % photos.length, { burst: true });
    setMessage("捏合切换下一张照片");
  }

  return true;
}

function handleTwoHands(snapshot) {
  const now = performance.now();
  const { fists, opens, digits } = findHands(snapshot);

  if (handlePhotoPinch(snapshot, now)) return;

  if (fists.length >= 2) {
    if (now - state.lastFireworkAt > 1300) {
      fireworks.launchShow();
      state.lastFireworkAt = now;
      setMessage("烟花已触发");
    }
    return;
  }

  if (opens.length >= 2) {
    scatter("双手释放", true);
    setMessage("已退出照片模式");
    return;
  }

  if (fists.length === 1 && digits.length === 1) {
    const digitToIndex = { one: 0, two: 1, three: 2 };
    const targetIndex = digitToIndex[digits[0].gesture] ?? 0;
    if (!state.photoMode || state.currentPhotoIndex !== targetIndex) {
      showPhoto(targetIndex, { burst: state.photoMode });
    }
    return;
  }

  if (fists.length === 1 && opens.length === 1) {
    if (!state.photoMode) {
      showPhoto(0, { burst: false, resetToFirst: true });
      return;
    }

    setMessage("照片模式：捏一下切换下一张");
  }
}

function handleGesture(snapshot) {
  ui.handCount.textContent = String(snapshot.handCount);
  ui.leftGesture.textContent = gestureLabel(snapshot.leftGesture);
  ui.rightGesture.textContent = gestureLabel(snapshot.rightGesture);

  if (handlePhotoPinch(snapshot, snapshot.timestamp)) return;

  if (snapshot.handCount === 1) {
    handleSingleHand(snapshot);
  } else if (snapshot.handCount >= 2) {
    handleTwoHands(snapshot);
  }
}

function bindKeyboardDemo() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "1") showShape("text-birthday", "生日快乐", () => createTextShape("生日快乐", particles.count), { jitter: 0.18, motion: "bounce" });
    if (key === "2") showShape("smile", "大笑脸", () => createSmileShape(particles.count), { jitter: 0.45 });
    if (key === "3") showShape("cake", "生日蛋糕", () => createCakeShape(particles.count), { jitter: 0.45 });
    if (key === " ") scatter("祝福星云", true);
    if (key === "f") fireworks.launchShow();
    if (key === "p") showPhoto(state.currentPhotoIndex, { burst: true });
    if (key === "n") showPhoto((state.currentPhotoIndex + 1) % photos.length, { burst: true });
    if (key === "arrowleft") showPhoto((state.currentPhotoIndex + 1) % photos.length, { burst: true });
    if (key === "arrowright") showPhoto((state.currentPhotoIndex - 1 + photos.length) % photos.length, { burst: true });
  });
}

async function startGestureRecognition() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage("当前浏览器不支持摄像头，已启用键盘演示");
    return;
  }

  const controller = new GestureController(
    ui.video,
    {
      onResults: handleGesture,
      onMessage: setMessage
    },
    { minFrames: 6 }
  );

  try {
    await controller.init();
  } catch (error) {
    console.warn("Gesture recognition failed:", error);
    setMessage("摄像头或模型加载失败，已启用键盘演示");
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = particles.clock.getDelta();
  const elapsed = particles.clock.elapsedTime;
  particles.update(delta, elapsed);
  fireworks.update(delta, elapsed);
  particles.render();
  updateFps(delta);
}

let fpsFrames = 0;
let fpsTime = 0;
function updateFps(delta) {
  fpsFrames += 1;
  fpsTime += delta;
  if (fpsTime >= 0.5) {
    state.fps = Math.round(fpsFrames / fpsTime);
    ui.fps.textContent = String(state.fps);
    fpsFrames = 0;
    fpsTime = 0;
  }
}

async function init() {
  renderCakePendants();
  bindKeyboardDemo();
  scatter("祝福星云", false);
  animate();
  await startGestureRecognition();
}

init();
