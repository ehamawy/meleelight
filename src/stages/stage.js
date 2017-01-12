// @flow

import {Vec2D} from "../main/util/Vec2D";
import {Box2D} from "../main/util/Box2D";

import type {DamageType} from "../physics/damageTypes";

export type SurfaceProperties = { damageType : DamageType };

export type Surface = [Vec2D, Vec2D, void | SurfaceProperties];
type SurfaceLabel = [string, number];
export type LabelledSurface = {surface : Surface, label : SurfaceLabel};

export type Connected = [ Array< [ null | SurfaceLabel, null | SurfaceLabel ] >, Array< [ null | SurfaceLabel, null | SurfaceLabel ] >];

export type Stage = {
  box           : Array< Box2D >,
  polygon       : Array< Array< Surface > >,
  platform      : Array< Surface >,
  ground        : Array< Surface >,
  ceiling       : Array< Surface >,
  wallL         : Array< Surface >,
  wallR         : Array< Surface >,
  startingPoint : [Vec2D, Vec2D, Vec2D, Vec2D],
  startingFace  : [number, number, number, number],
  respawnPoints : [Vec2D, Vec2D, Vec2D, Vec2D],
  respawnFace   : [number, number, number, number],
  blastzone     : Box2D,
  ledge         : Array< [number, number] >,
  ledgePos      : Array< Vec2D >,
  scale         : number,
  offset        : [number, number],
  connected?    : Connected
}

export function getSurfaceFromStage ( surfaceTypeAndIndex : [string, number], stage : Stage) : Surface {
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