import { ParticleSystem } from "./particles.js";
import { FireworkSystem } from "./fireworks.js";
import { GestureController, gestureLabel } from "./gesture.js";
import {
  PHOTO_PATHS,
  createCakeShape,
  createHeartShape,
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
  photoPinchFrames: 0,
  photoReleaseFrames: 0,
  photoSwitching: false,
  photoModeEnteredAt: 0,
  pendingPhotoIndex: null,
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
const imagePreloadCache = new Map();
const PHOTO_PINCH_COOLDOWN_MS = 220;
const PHOTO_PINCH_CONFIRM_FRAMES = 1;
const PHOTO_PINCH_RELEASE_FRAMES = 1;
const PHOTO_MODE_ARM_MS = 0;

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

function cancelPhotoTransition() {
  state.photoToken += 1;
  state.photoSwitching = false;
  state.pendingPhotoIndex = null;
}

function resetPhotoPinch() {
  state.photoPinchDown = false;
  state.photoPinchFrames = 0;
  state.photoReleaseFrames = 0;
}

function preloadPhoto(index) {
  const src = photos[index];
  if (!imagePreloadCache.has(src)) {
    imagePreloadCache.set(src, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = async () => {
        try {
          if (image.decode) await image.decode();
        } catch {
          // Decoding can fail on already-decoded images; the loaded image is still usable.
        }
        resolve(image);
      };
      image.onerror = reject;
      image.src = src;
    }));
  }
  return imagePreloadCache.get(src);
}

function warmNearbyPhotos(index) {
  const next = (index + 1) % photos.length;
  const previous = (index - 1 + photos.length) % photos.length;
  preloadPhoto(next).catch(() => {});
  preloadPhoto(previous).catch(() => {});
}

async function showPhotoOverlay(index, { switching = false, token = null } = {}) {
  if (switching) {
    ui.photoShowcase.classList.add("is-switching");
    await delay(70);
  }

  if (token !== null && token !== state.photoToken) return false;

  try {
    const image = await preloadPhoto(index);
    if (token !== null && token !== state.photoToken) return false;
    ui.photoImage.src = image.src;
  } catch {
    if (token !== null && token !== state.photoToken) return false;
    ui.photoImage.src = photos[index];
  }

  ui.photoCaption.textContent = `PHOTO ${index + 1}`;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (token !== null && token !== state.photoToken) return false;
  ui.photoShowcase.classList.remove("is-switching");
  ui.photoShowcase.classList.add("is-active");
  await delay(switching ? 110 : 60);
  return true;
}

function getCachedShape(key, factory) {
  if (!shapeCache.has(key)) {
    shapeCache.set(key, Promise.resolve(factory()));
  }
  return shapeCache.get(key);
}

async function showShape(key, label, factory, options = {}) {
  if (state.lastShapeKey === key) return;
  cancelPhotoTransition();
  state.photoMode = false;
  state.photoModeEnteredAt = 0;
  resetPhotoPinch();
  hidePhotoOverlay();
  updatePhotoUi();
  const points = await getCachedShape(key, factory);
  particles.setTarget(points, { label, jitter: options.jitter ?? 1.2, motion: options.motion ?? "none" });
  setCakePendantsVisible(key === "cake");
  setMode(label, key);
}

function scatter(label = "自由漂浮", burst = true) {
  if (state.lastShapeKey === "scatter" && !burst) return;
  cancelPhotoTransition();
  state.photoMode = false;
  state.photoModeEnteredAt = 0;
  hidePhotoOverlay();
  resetPhotoPinch();
  particles.scatter({ label, burst });
  setMode(label, "scatter");
  updatePhotoUi();
}

async function showPhoto(index, { burst = false, resetToFirst = false } = {}) {
  const normalized = (index + photos.length) % photos.length;
  if (state.photoSwitching) {
    state.pendingPhotoIndex = normalized;
    return;
  }

  const enteringPhotoMode = !state.photoMode;
  const key = `photo-direct-${normalized}`;
  const token = ++state.photoToken;
  const now = performance.now();

  state.photoSwitching = true;
  state.photoMode = true;
  state.currentPhotoIndex = normalized;
  if (enteringPhotoMode || resetToFirst) {
    state.photoModeEnteredAt = now;
    state.lastPhotoPinchAt = now;
    resetPhotoPinch();
  }
  updatePhotoUi();
  warmNearbyPhotos(normalized);

  try {
    const overlayPromise = showPhotoOverlay(normalized, { switching: burst, token });

    if (token !== state.photoToken) return;

    const cakePoints = await getCachedShape("cake-pendants", () => createCakeShape(particles.count));

    if (token !== state.photoToken) return;

    particles.setTarget(cakePoints, { label: "照片挂坠蛋糕", jitter: 0.35 });
    setCakePendantsVisible(true, true);
    await overlayPromise;
    if (token !== state.photoToken) return;
    setMode(resetToFirst ? "照片模式" : `照片 ${normalized + 1}`, key);
    setMessage("照片模式：轻捏一下马上切换下一张");
  } catch (error) {
    console.warn("Photo switch failed:", error);
    if (token === state.photoToken) {
      setMessage("照片切换失败，请检查图片路径");
    }
  } finally {
    if (token === state.photoToken) {
      state.photoSwitching = false;
      const pendingIndex = state.pendingPhotoIndex;
      state.pendingPhotoIndex = null;
      if (pendingIndex !== null && pendingIndex !== state.currentPhotoIndex) {
        window.setTimeout(() => showPhoto(pendingIndex, { burst: true }), 0);
      }
    }
  }
}

function handleSingleHand(snapshot) {
  const hand = snapshot.hands[0];
  if (!hand || hand.gesture === "none") return;

  switch (hand.gesture) {
    case "one":
      showShape("text-birthday", "生日快乐", () => createTextShape("生日快乐", particles.count), { jitter: 0.18, motion: "bounce" });
      break;
    case "two":
      showShape("heart", "跳动爱心", () => createHeartShape(particles.count), { jitter: 0.35, motion: "heartbeat" });
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
    opens: snapshot.hands.filter((hand) => hand.gesture === "open")
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
    state.photoReleaseFrames += 1;
    state.photoPinchFrames = 0;
    if (state.photoReleaseFrames >= PHOTO_PINCH_RELEASE_FRAMES) {
      state.photoPinchDown = false;
    }
    return false;
  }

  state.photoPinchFrames += 1;
  state.photoReleaseFrames = 0;

  const confirmedPinch = state.photoPinchFrames >= PHOTO_PINCH_CONFIRM_FRAMES;
  const cooldownReady = now - state.lastPhotoPinchAt > PHOTO_PINCH_COOLDOWN_MS;
  const modeArmed = now - state.photoModeEnteredAt > PHOTO_MODE_ARM_MS;

  if (confirmedPinch && !state.photoPinchDown && cooldownReady && modeArmed) {
    state.photoPinchDown = true;
    state.lastPhotoPinchAt = now;
    showPhoto((state.currentPhotoIndex + 1) % photos.length, { burst: true });
    setMessage("轻捏触发，切换下一张照片");
  }

  return true;
}

function handleTwoHands(snapshot) {
  const now = performance.now();
  const { fists, opens } = findHands(snapshot);

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

  if (fists.length === 1 && opens.length === 1) {
    if (!state.photoMode) {
      showPhoto(0, { burst: false, resetToFirst: true });
      return;
    }

    setMessage("照片模式：轻捏一下马上切换下一张");
  }
}

function handleGesture(snapshot) {
  ui.handCount.textContent = String(snapshot.handCount);
  ui.leftGesture.textContent = gestureLabel(snapshot.leftGesture);
  ui.rightGesture.textContent = gestureLabel(snapshot.rightGesture);

  if (handlePhotoPinch(snapshot, snapshot.timestamp)) return;
  if (state.photoMode && snapshot.handCount < 2) {
    setMessage("照片模式：轻捏一下马上切换下一张");
    return;
  }

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
    if (key === "2") showShape("heart", "跳动爱心", () => createHeartShape(particles.count), { jitter: 0.35, motion: "heartbeat" });
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
