// @flow

import {getSurfaceFromStage} from "../stages/stage";
import {Vec2D} from "../main/util/Vec2D";

// eslint-disable-next-line no-duplicate-imports
import type {Stage} from "../stages/stage";


export type ignoreList = Array<[string, number]>;

export function addToIgnoreList(surfaceIgnoreList : ignoreList, label : [string, number]) : ignoreList {
  return surfaceIgnoreList.concat([label]);
};

export function isIgnored ( label : [string, number], surfaceIgnoreList : ignoreList) : bool {
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
export function cornerIsIgnored( corner : Vec2D , surfaceIgnoreList : ignoreList, stage : Stage) : bool {
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
      return cornerIsIgnored(corner, tail, stage);
    }

  }
}