// @flow

import {Vec2D} from "./Vec2D";

export type ECB = [Vec2D, Vec2D, Vec2D, Vec2D];

export function moveECB (ecb : ECB, vec : Vec2D) : ECB {
  return ( [ new Vec2D (ecb[0].x+vec.x,ecb[0].y+vec.y)
           , new Vec2D (ecb[1].x+vec.x,ecb[1].y+vec.y)
           , new Vec2D (ecb[2].x+vec.x,ecb[2].y+vec.y)
           , new Vec2D (ecb[3].x+vec.x,ecb[3].y+vec.y) ] );
};

export function squashECBAt (ecb : ECB, squashData : [Vec2D, number]) : ECB {
  const pos = squashData[0];
  const t   = squashData[1];
  return ( [ new Vec2D ( t*ecb[0].x + (1-t)*pos.x, t*ecb[0].y + (1-t)*pos.y)
           , new Vec2D ( t*ecb[1].x + (1-t)*pos.x, t*ecb[1].y + (1-t)*pos.y)
           , new Vec2D ( t*ecb[2].x + (1-t)*pos.x, t*ecb[2].y + (1-t)*pos.y)
           , new Vec2D ( t*ecb[3].x + (1-t)*pos.x, t*ecb[3].y + (1-t)*pos.y) ] );
};
