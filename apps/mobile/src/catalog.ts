export const games = [
  { id: 'breakout', slug: 'vector-breakout', title: 'Vector Breakout', genre: 'Arcade', symbol: '▦', description: 'Aim your paddle. Break the wall. Chase your personal best.', controls: 'Drag to move your paddle. Tap the canvas or Launch to serve. Left and Right also move the paddle.' },
  { id: 'dodge', slug: 'orbit-dodge', title: 'Orbit Dodge', genre: 'Survival', symbol: '△', description: 'Weave through a field of asteroids. Every second counts.', controls: 'Drag to move your ship, or hold the direction buttons. Avoid the falling rocks.' },
  { id: 'snake', slug: 'neon-snake', title: 'Neon Snake', genre: 'Classic', symbol: '⌁', description: 'Find your rhythm. Grow your trail. Leave room to turn.', controls: 'Swipe on the canvas or tap direction buttons. Eat the glowing food. Avoid walls and your own trail.' },
  { id: 'gravity', slug: 'gravity-well', title: 'Gravity Well', genre: 'Precision', symbol: '◎', description: 'Ride the orbit and collect every orb before gravity wins.', controls: 'Hold direction buttons to thrust. Collect ten orbs while avoiding the sun and the edges of space.' },
] as const;
export type Game = typeof games[number];
