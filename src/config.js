// Game configuration: terrain palettes and tunable constants.

export const TERRAINS = {
  meadow: { name:'Meadow', ground:0x5a9a4e, road:0x33373d, fog:0xbfe0f0, grass:0x6fae5a, tree:0x2f5d2a, trunk:0x5b432c, treeChance:.6, grassDensity:1.0 },
  desert: { name:'Desert', ground:0xd9b06a, road:0x4a4540, fog:0xe7d3a3, grass:0xcfa85e, tree:0x6b8f3d, trunk:0x7a5c34, treeChance:.12, grassDensity:.25 },
  snow:   { name:'Snow',   ground:0xeef3f7, road:0x59636d, fog:0xd2dde8, grass:0xe8eef4, tree:0x2c4a35, trunk:0x4a3a2a, treeChance:.5,  grassDensity:.4 },
  canyon: { name:'Canyon', ground:0xb3623c, road:0x3d3530, fog:0xe0a37a, grass:0xb88a52, tree:0x7a8f4d, trunk:0x6b4a2c, treeChance:.22, grassDensity:.3 },
};
export const TERRAIN_KEYS = ['meadow','desert','snow','canyon'];

export const ROAD = { SEG:4, LENGTH:5000, WIDTH:13 };
export const NSEG = ROAD.LENGTH / ROAD.SEG;

export const COLORS = [['Red',0xd61f3a],['White',0xf2f2f2],['Blue',0x2a5cd6],['Black',0x1a1a1e]];

export const PHYS = { maxSpeed:170, accel:42, drag:14, brake:80, autoSpeed:80, turnRate:1.7 };
