// @flow

import {Vec2D} from "../../main/util/Vec2D";
import {extremePoint} from "./extremePoint";

import type {Stage, LabelledSurface} from "../stage";


export function findWallFromCorner(corner : Vec2D, situation : string, cornerSide: number, stage : Stage) : null | LabelledSurface {
  const wallType = cornerSide === 3 ? "r" : "l";
  const relevantStageWalls = wallType === "r" ? stage.wallR : stage.wallL;
  const extreme = situation === "u" ? "b" : "t";

  for (let i = 0; i < relevantStageWalls.length; i++) {
    const wall = relevantStageWalls[i];
    const wallCorner = extremePoint(wall, extreme);
    if ( (Math.abs(corner.x - wallCorner.x) < 0.0001 && Math.abs(corner.y - wallCorner.y) < 0.0001) ) {
      return [wall, [wallType, i]];
    }
  }

  return null;

};