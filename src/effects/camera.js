/**
 * 屏幕震动：trauma 衰减式抖动，偏移取整到像素。
 * addShake(magnitude, duration) 与已有抖动取较大值叠加。
 */
export function createCamera() {
  let time = 0;
  let duration = 0;
  let magnitude = 0;

  return {
    get shaking() {
      return time > 0;
    },
    get time() {
      return time;
    },
    addShake(mag, dur) {
      magnitude = Math.max(magnitude, mag);
      duration = Math.max(duration, dur);
      time = duration;
    },
    update(dt) {
      if (time > 0) time -= dt;
      if (time <= 0) {
        time = 0;
        magnitude = 0;
      }
    },
    offset() {
      if (time <= 0) return { x: 0, y: 0 };
      const k = time / duration;
      const m = magnitude * k * k;
      return {
        x: Math.round((Math.random() * 2 - 1) * m),
        y: Math.round((Math.random() * 2 - 1) * m),
      };
    },
  };
}
