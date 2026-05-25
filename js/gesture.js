const MEDIAPIPE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

const GESTURE_NAMES = {
  none: "none",
  unknown: "未确定",
  one: "1",
  two: "2",
  three: "3",
  pinch: "捏合",
  fist: "握拳",
  open: "张开"
};

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

export function gestureLabel(value) {
  return GESTURE_NAMES[value] ?? value ?? "none";
}

export function palmCenter(landmarks) {
  const ids = [0, 5, 9, 13, 17];
  const center = ids.reduce(
    (sum, id) => {
      sum.x += landmarks[id].x;
      sum.y += landmarks[id].y;
      sum.z += landmarks[id].z ?? 0;
      return sum;
    },
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: center.x / ids.length,
    y: center.y / ids.length,
    z: center.z / ids.length
  };
}

function fingerExtended(landmarks, tip, pip, mcp) {
  const wrist = landmarks[0];
  const tipPoint = landmarks[tip];
  const pipPoint = landmarks[pip];
  const mcpPoint = landmarks[mcp];
  const distanceOpen = distance(tipPoint, wrist) > distance(pipPoint, wrist) * 1.08;
  const verticalOpen = tipPoint.y < pipPoint.y - 0.012 || tipPoint.y < mcpPoint.y - 0.03;
  return distanceOpen && verticalOpen;
}

function isPinching(landmarks) {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const center = palmCenter(landmarks);
  const palmWidth = distance(landmarks[5], landmarks[17]);
  const palmLength = distance(landmarks[0], landmarks[9]);
  const handScale = Math.max(palmWidth, palmLength, 0.001);
  const pinchGap = distance(thumbTip, indexTip);
  const pinchCenter = {
    x: (thumbTip.x + indexTip.x) / 2,
    y: (thumbTip.y + indexTip.y) / 2,
    z: ((thumbTip.z ?? 0) + (indexTip.z ?? 0)) / 2
  };
  const awayFromPalm = distance(pinchCenter, center) > handScale * 0.38;
  return pinchGap < handScale * 0.34 && awayFromPalm;
}

export function classifyHand(landmarks) {
  if (!landmarks || landmarks.length < 21) return "none";

  const extended = {
    index: fingerExtended(landmarks, 8, 6, 5),
    middle: fingerExtended(landmarks, 12, 10, 9),
    ring: fingerExtended(landmarks, 16, 14, 13),
    pinky: fingerExtended(landmarks, 20, 18, 17)
  };

  const longFingers = [extended.index, extended.middle, extended.ring, extended.pinky];
  const count = longFingers.filter(Boolean).length;
  const palm = palmCenter(landmarks);
  const palmLength = Math.max(distance(landmarks[0], landmarks[9]), 0.001);
  const indexCloseToPalm = distance(landmarks[8], palm) < palmLength * 0.48;

  if (isPinching(landmarks) && !(count === 0 && indexCloseToPalm)) return "pinch";

  if (count === 4) return "open";
  if (count === 0) return "fist";
  if (extended.index && !extended.middle && !extended.ring && !extended.pinky) return "one";
  if (extended.index && extended.middle && !extended.ring && !extended.pinky) return "two";
  if (extended.index && extended.middle && extended.ring && !extended.pinky) return "three";
  return "unknown";
}

class GestureStabilizer {
  constructor(minFrames = 6) {
    this.minFrames = minFrames;
    this.candidate = "none";
    this.stable = "none";
    this.count = 0;
  }

  update(value) {
    if (value === this.candidate) {
      this.count += 1;
    } else {
      this.candidate = value;
      this.count = 1;
    }

    if (this.count >= this.minFrames) {
      this.stable = this.candidate;
    }

    return this.stable;
  }
}

export class GestureController {
  constructor(video, callbacks = {}, options = {}) {
    this.video = video;
    this.callbacks = callbacks;
    this.options = options;
    this.landmarker = null;
    this.running = false;
    this.lastVideoTime = -1;
    this.stabilizers = {
      Left: new GestureStabilizer(options.minFrames ?? 6),
      Right: new GestureStabilizer(options.minFrames ?? 6)
    };
    this.latestPalm = {
      Left: null,
      Right: null
    };
  }

  async init() {
    await this.startCamera();
    await this.loadLandmarker();
    this.running = true;
    this.detectLoop();
  }

  async startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 960 },
        height: { ideal: 720 },
        facingMode: "user"
      },
      audio: false
    });
    this.video.srcObject = stream;
    await this.video.play();
    this.callbacks.onMessage?.("摄像头已启动，正在加载手势模型...");
  }

  async loadLandmarker() {
    const { FilesetResolver, HandLandmarker } = await import(MEDIAPIPE_URL);
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.options.modelUrl ?? HAND_MODEL_URL,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.options.modelUrl ?? HAND_MODEL_URL
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
    }

    this.callbacks.onMessage?.("手势模型已就绪");
  }

  detectLoop = () => {
    if (!this.running) return;

    if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const result = this.landmarker.detectForVideo(this.video, performance.now());
      this.handleResult(result);
    }

    requestAnimationFrame(this.detectLoop);
  };

  handleResult(result) {
    const hands = [];
    const rawSides = new Set();

    for (let i = 0; i < (result.landmarks?.length ?? 0); i += 1) {
      const landmarks = result.landmarks[i];
      const handedness = result.handednesses?.[i]?.[0]?.categoryName ?? (i === 0 ? "Right" : "Left");
      const side = handedness === "Left" ? "Left" : "Right";
      rawSides.add(side);

      const gesture = classifyHand(landmarks);
      const stableGesture = this.stabilizers[side].update(gesture);
      const palm = palmCenter(landmarks);
      this.latestPalm[side] = palm;

      hands.push({
        side,
        gesture: stableGesture,
        rawGesture: gesture,
        palm,
        // The preview video is mirrored. mirroredPalmX follows what the user sees on screen.
        mirroredPalmX: 1 - palm.x,
        landmarks
      });
    }

    for (const side of ["Left", "Right"]) {
      if (!rawSides.has(side)) {
        this.stabilizers[side].update("none");
        this.latestPalm[side] = null;
      }
    }

    const snapshot = {
      handCount: hands.length,
      leftGesture: this.stabilizers.Left.stable,
      rightGesture: this.stabilizers.Right.stable,
      hands,
      timestamp: performance.now()
    };

    this.callbacks.onResults?.(snapshot);
  }
}
