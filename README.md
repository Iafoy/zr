# 生日祝福粒子秀

基于 Three.js + MediaPipe Hands 的实时摄像头手势识别 3D 粒子互动项目。

## 目录结构

```text
birthday-particle-gesture/
  index.html
  css/
    style.css
  js/
    main.js
    gesture.js
    particles.js
    shapes.js
    fireworks.js
  assets/
    photos/
      photo1.jpg
      photo2.jpg
      photo3.jpg
      photo4.jpg
      photo5.jpg
```

## 运行方式

项目不需要安装依赖，浏览器会通过 CDN 加载 Three.js 和 MediaPipe。

```bash
cd birthday-particle-gesture
python -m http.server 5173
```

然后打开：

```text
http://localhost:5173
```

首次打开请允许摄像头权限。没有摄像头或模型加载失败时，可用键盘演示：`1` 文字、`2` 跳动爱心、`3` 蛋糕、空格散开、`F` 烟花、`P` 照片、`N` 下一张、方向键翻照片。实际手势中，'张掌'粒子扩散，'手势比数字一'为文字，'手势比数字二'为爱心，'握拳'为蛋糕，`握拳 + 张掌` 进入照片模式；照片模式下轻捏一下会快速切换到下一张照片，当前配置优先保证灵敏度。

## 替换照片

把照片放到 `assets/photos/`，并在 `js/shapes.js` 或 `js/main.js` 中维护 `photos` / `PHOTO_PATHS` 数组即可。图片数量不限，翻页逻辑会按数组长度循环。
