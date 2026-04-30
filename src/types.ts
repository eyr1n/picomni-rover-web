export interface Command {
  vx: number;
  vy: number;
  w: number;
  a: boolean;
  b: boolean;
}

export interface Odometry {
  x: number;
  y: number;
  yaw: number;
}
