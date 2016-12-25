// @flow

import {Vec2D} from "./Vec2D";

export type ECB = [Vec2D, Vec2D, Vec2D, Vec2D];

export function moveECB (ecb : ECB, vec : Vec2D) : ECB {
  return ( [ new Vec2D (ecb[0].x+vec.x,ecb[0].y+vec.y)
           , new Vec2D (ecb[1].x+vec.x,ecb[1].y+vec.y)
           , new Vec2D (ecb[2].x+vec.x,ecb[2].y+vec.y)
           , new Vec2D (ecb[3].x+vec.x,ecb[3].y+vec.y) ] );
};

export function squashECBAt (ecb : ECB, squashData : [null | number, number]) : ECB {
  const pos = ecbFocusFromAngularParameter(ecb, squashData[0]);
  const t   = squashData[1];
  return ( [ new Vec2D ( t*ecb[0].x + (1-t)*pos.x, t*ecb[0].y + (1-t)*pos.y)
           , new Vec2D ( t*ecb[1].x + (1-t)*pos.x, t*ecb[1].y + (1-t)*pos.y)
           , new Vec2D ( t*ecb[2].x + (1-t)*pos.x, t*ecb[2].y + (1-t)*pos.y)
           , new Vec2D ( t*ecb[3].x + (1-t)*pos.x, t*ecb[3].y + (1-t)*pos.y) ] );
};

export function ecbFocusFromAngularParameter( ecb : ECB, t : null | number ) : Vec2D {
  let focus = null;
  if (t === null) {
    focus = new Vec2D( ecb[0].x, (ecb[0].y + ecb[2].y)/2 );
  }
  else if (t <= 1) {
    focus = new Vec2D ( (1 - t    )*ecb[0].x + t    *ecb[1].x, (1 - t    )*ecb[0].y + t    *ecb[1].y );
  }
  else if (t <= 2) {
    focus = new Vec2D ( (1 - (t-1))*ecb[1].x + (t-1)*ecb[2].x, (1 - (t-1))*ecb[1].y + (t-1)*ecb[2].y );
  }
  else if (t <= 3) {
    focus = new Vec2D ( (1 - (t-2))*ecb[2].x + (t-2)*ecb[3].x, (1 - (t-2))*ecb[2].y + (t-2)*ecb[3].y );
  }
  else {
    focus = new Vec2D ( (1 - (t-3))*ecb[3].x + (t-3)*ecb[0].x, (1 - (t-3))*ecb[3].y + (t-3)*ecb[0].y );
  }
  return focus;
}
