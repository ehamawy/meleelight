// @flow

import {Vec2D} from "../main/util/Vec2D";
import {Box2D} from "../main/util/Box2D";

export type Stage = {
  box           : Array< Box2D >,
  platform      : Array< [Vec2D, Vec2D] >,
  ground        : Array< [Vec2D, Vec2D] >,
  ceiling       : Array< [Vec2D, Vec2D] >,
  wallL         : Array< [Vec2D, Vec2D] >,
  wallR         : Array< [Vec2D, Vec2D] >,
  startingPoint : [Vec2D, Vec2D, Vec2D, Vec2D],
  startingFace  : [number, number, number, number],
  respawnPoints : [Vec2D, Vec2D, Vec2D, Vec2D],
  respawnFace   : [number, number, number, number],
  blastzone     : Box2D,
  ledge         : Array< [number, number] >,
  ledgePos      : Array< Vec2D >,
  scale         : number,
  offset        : [number, number],
  connected?    : Array< [boolean, Array< [ string, number] > ] >
}

export function getSurfaceFromStage ( surfaceTypeAndIndex : [string, number], stage : Stage) : [Vec2D, Vec2D] {
  const surfaceType  = surfaceTypeAndIndex[0];
  const surfaceIndex = surfaceTypeAndIndex[1];
  switch (surfaceType) {
    case "l":
      return stage.wallL   [surfaceIndex];
    case "r":
      return stage.wallR   [surfaceIndex];
    case "p":
      return stage.platform[surfaceIndex];
    case "g":
    default:
      return stage.ground  [surfaceIndex];
    case "c":
      return stage.ceiling [surfaceIndex];
  }
};