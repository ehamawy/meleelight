// @flow

import {getSurfaceFromStage} from "../stages/stage";
import {Vec2D} from "../main/util/Vec2D";

// eslint-disable-next-line no-duplicate-imports
import type {Stage} from "../stages/stage";


export type IgnoreList = Array<[string, number]>;
export type IgnoreLists = [IgnoreList, Array<Vec2D>];

export function addToIgnoreList(surfaceIgnoreList : IgnoreList, label : [string, number]) : IgnoreList {
  return surfaceIgnoreList.concat([label]);
};

export function isIgnored ( label : [string, number], surfaceIgnoreList : IgnoreList) : bool {
  if (surfaceIgnoreList.length < 1) {
    return false;
  }
  else {
    const [head, ...tail] = surfaceIgnoreList;
    if (head[0] === label[0] && head[1] === label[1]) {
      return true;
    }
    else {
      return isIgnored(label, tail);
    }
  }
};

// total hack for the moment
export function cornerIsIgnoredInSurfaces ( corner : Vec2D , surfaceIgnoreList : IgnoreList, stage : Stage) : bool {
  if (surfaceIgnoreList.length < 1) {
    return false;
  }
  else {
    const [head, ...tail] = surfaceIgnoreList;
    const surface = getSurfaceFromStage(head, stage);
    if (    (Math.abs(corner.x - surface[0].x) < 0.0001 && Math.abs(corner.y - surface[0].y) < 0.0001)
         || (Math.abs(corner.x - surface[1].x) < 0.0001 && Math.abs(corner.y - surface[1].y) < 0.0001) ) {
      return true;
    }
    else {
      return cornerIsIgnoredInSurfaces(corner, tail, stage);
    }
  }
}

export function cornerIsIgnored ( corner: Vec2D, cornerIgnoreList : Array<Vec2D> ) : bool {
  if (cornerIgnoreList.length < 1) {
    return false;
  }
  else {
    const [head, ...tail] = cornerIgnoreList;
    if (Math.abs(corner.x - head.x) < 0.0001 && Math.abs(corner.y - head.y) < 0.0001) {
      return true;
    }
    else {
      return cornerIsIgnored(corner, tail);
    }
  }
}

