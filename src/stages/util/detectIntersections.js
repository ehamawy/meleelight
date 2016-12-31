// @flow

import {Vec2D} from "../../main/util/Vec2D";
import {coordinateInterceptParameter} from "../../physics/environmentalCollision";

type Line = [Vec2D, Vec2D];
type Polygon = Array<Vec2D>;


export function intersectsAny (newLine : Line, lines : Array<Line>) : bool {
  for (let i = 0; i < lines.length; i++) {
    if (intersects(newLine, lines[i])) {
      return true;
    }
  } 
  return false;
}

function intersects( line1 : Line, line2 : Line) : bool {
  const t1 = coordinateInterceptParameter(line1, line2);
  const t2 = coordinateInterceptParameter(line2, line1);
  if (isNaN(t1) || isNaN(t2) || t1 === Infinity || t2 === Infinity || t1 < 0 || t2 < 0 || t1 > 1 || t2 > 1) {
    return false;
  }
  else {
    return true;
  }
}