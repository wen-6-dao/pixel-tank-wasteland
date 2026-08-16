const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'KeyR', 'KeyM', 'KeyB',
]);

/**
 * 键盘输入管理：
 * - 基于 e.code，与键盘布局无关（AZERTY 键盘上 WASD 位置同样生效）；
 * - 忽略系统自动重复的 keydown；
 * - 窗口失焦时清空按键，避免“卡键”；
 * - 同时跟踪鼠标在画布上的逻辑坐标（鼠标瞄准）与左键状态。
 */
export class InputManager {
  constructor(target = window, canvas = null) {
    this.target = target;
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.pointer = { x: 0, y: 0, active: false };
    this.joy = { x: 0, y: 0, active: false }; // 移动虚拟摇杆
    this.touchFire = false; // 触摸开火按钮

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
  }

  attach() {
    this.target.addEventListener('keydown', this._onKeyDown);
    this.target.addEventListener('keyup', this._onKeyUp);
    this.target.addEventListener('blur', this._onBlur);
    if (this.canvas) {
      this.canvas.addEventListener('pointermove', this._onPointerMove);
      this.canvas.addEventListener('pointerdown', this._onPointerDown);
    }
    this.target.addEventListener('pointerup', this._onPointerUp);
  }

  detach() {
    this.target.removeEventListener('keydown', this._onKeyDown);
    this.target.removeEventListener('keyup', this._onKeyUp);
    this.target.removeEventListener('blur', this._onBlur);
    if (this.canvas) {
      this.canvas.removeEventListener('pointermove', this._onPointerMove);
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    }
    this.target.removeEventListener('pointerup', this._onPointerUp);
    this.down.clear();
  }

  isDown(...codes) {
    return codes.some((code) => this.down.has(code));
  }

  /** 边缘触发：返回并清除这些按键在本帧是否新按下（用于换地图等一次性操作） */
  consumePressed(...codes) {
    let hit = false;
    for (const code of codes) {
      if (this.pressed.has(code)) {
        this.pressed.delete(code);
        hit = true;
      }
    }
    return hit;
  }

  /** 虚拟摇杆：传入归一化方向（-1~1），active 表示正在触摸 */
  setJoystick(x, y, active) {
    const mag = Math.hypot(x, y);
    this.joy.active = active && mag > 0.12;
    this.joy.x = this.joy.active ? x / Math.max(1, mag) : 0;
    this.joy.y = this.joy.active ? y / Math.max(1, mag) : 0;
  }

  /** 触摸开火按钮 */
  setFireHeld(value) {
    this.touchFire = value;
  }

  /** 当前移动方向：键盘优先，其次虚拟摇杆；返回 {dx,dy} 或 null */
  getMove() {
    let dx = 0;
    let dy = 0;
    if (this.isDown('KeyA', 'ArrowLeft')) dx -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) dx += 1;
    if (this.isDown('KeyW', 'ArrowUp')) dy -= 1;
    if (this.isDown('KeyS', 'ArrowDown')) dy += 1;
    if (dx !== 0 || dy !== 0) return { dx, dy };
    if (this.joy.active) {
      if (Math.abs(this.joy.x) >= Math.abs(this.joy.y)) {
        return { dx: this.joy.x > 0 ? 1 : -1, dy: 0 };
      }
      return { dx: 0, dy: this.joy.y > 0 ? 1 : -1 };
    }
    return null;
  }

  _onKeyDown(event) {
    if (event.repeat) return;
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    this.down.add(event.code);
    this.pressed.add(event.code);
  }

  _onKeyUp(event) {
    this.down.delete(event.code);
  }

  _onBlur() {
    this.down.clear();
  }

  /** 将鼠标的 CSS 坐标换算为画布逻辑坐标（640×360） */
  _onPointerMove(event) {
    if (!this.canvas) return;
    if (event.pointerType === 'touch') return; // 触摸走虚拟摇杆，不用鼠标瞄准
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
    this.pointer.y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
    this.pointer.active = true;
  }

  _onPointerDown(event) {
    if (event.pointerType === 'touch') return; // 触摸开火走按钮
    if (event.button === 0) {
      this.down.add('MouseLeft');
      this.pressed.add('MouseLeft');
    }
  }

  _onPointerUp(event) {
    if (event.button === 0) this.down.delete('MouseLeft');
  }
}
