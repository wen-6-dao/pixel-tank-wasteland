/**
 * 固定时间步主循环（累加器模式）：
 * - update(dt) 以固定 1/60s 步进，保证逻辑与帧率无关；
 * - render(alpha) 每帧调用，alpha 为渲染插值系数（0~1），
 *   用于在两次逻辑更新之间平滑绘制。
 */
export function createGameLoop({ update, render, timestep = 1 / 60, maxFrameTime = 0.25 }) {
  let rafId = 0;
  let running = false;
  let lastTime = performance.now();
  let accumulator = 0;
  let frames = 0;
  let fpsTimer = 0;
  const stats = { fps: 0 };

  const frame = (now) => {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    let frameTime = (now - lastTime) / 1000;
    lastTime = now;
    if (frameTime > maxFrameTime) frameTime = maxFrameTime;

    accumulator += frameTime;
    while (accumulator >= timestep) {
      update(timestep);
      accumulator -= timestep;
    }

    const alpha = accumulator / timestep;
    render(alpha);

    // 滚动 FPS 统计（每秒刷新一次）
    frames += 1;
    fpsTimer += frameTime;
    if (fpsTimer >= 1) {
      stats.fps = frames / fpsTimer;
      frames = 0;
      fpsTimer = 0;
    }
  };

  return {
    stats,
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}
