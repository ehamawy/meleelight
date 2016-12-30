// @flow
/*eslint indent:1*/ // get stuffed

import {Vec2D, getXOrYCoord, putXOrYCoord, flipXOrY} from "../main/util/Vec2D";
import {dotProd, scalarProd, add, subtract, norm, orthogonalProjection} from "../main/linAlg";
import {findSmallestWithin, pickSmallestSweep} from "../main/util/findSmallestWithin";
import {solveQuadraticEquation} from "../main/util/solveQuadraticEquation";
import {lineAngle} from "../main/util/lineAngle";
import {extremePoint} from "../stages/util/extremePoint";
import {moveECB, squashECBAt, ecbFocusFromAngularParameter, interpolateECB} from "../main/util/ecbTransform";
import {zipLabels} from "../main/util/zipLabels";

// eslint-disable-next-line no-duplicate-imports
import type {ECB, SquashDatum} from "../main/util/ecbTransform";
// eslint-disable-next-line no-duplicate-imports
import type {Stage, LabelledSurface} from "../stages/stage";
// eslint-disable-next-line no-duplicate-imports
import type {XOrY} from "../main/util/Vec2D";


// for debugging, draw ECBs and points on top of everything else
import {fg2} from "../main/main";
import {activeStage} from "../stages/activeStage";

function drawECB(ecb : ECB, color : string) : void {
  fg2.strokeStyle = color;
  fg2.lineWidth = 1;
  fg2.beginPath();
  fg2.moveTo((ecb[0].x * activeStage.scale) + activeStage.offset[0], (ecb[0].y * -activeStage.scale) + activeStage.offset[1]);
  fg2.lineTo((ecb[1].x * activeStage.scale) + activeStage.offset[0], (ecb[1].y * -activeStage.scale) + activeStage.offset[1]);
  fg2.lineTo((ecb[2].x * activeStage.scale) + activeStage.offset[0], (ecb[2].y * -activeStage.scale) + activeStage.offset[1]);
  fg2.lineTo((ecb[3].x * activeStage.scale) + activeStage.offset[0], (ecb[3].y * -activeStage.scale) + activeStage.offset[1]);
  fg2.closePath();
  fg2.stroke();
};

function drawPoint( point : Vec2D, color : string) : void {
  fg2.fillStyle = color;
  fg2.fillRect((point.x * activeStage.scale) + activeStage.offset[0] ,(point.y * -activeStage.scale) + activeStage.offset[1],3,3);
};
// end of debugging helper code


export const additionalOffset : number = 0.00001;

const maxRecursion = 30;

// -----------------------------------------------------
// various utility functions

// horizontal line through a point
function hLineThrough ( point : Vec2D ) : [Vec2D, Vec2D] {
  return [ point, new Vec2D ( point.x+1, point.y)];
};

// vertical line through a point
function vLineThrough ( point : Vec2D ) : [Vec2D, Vec2D] {
  return [ point, new Vec2D ( point.x, point.y+1)];
};

// either horizontal or vertical line through a point
function lineThrough ( point : Vec2D, xOrY : XOrY ) : [Vec2D, Vec2D] {
  if (xOrY === "x") {
    return hLineThrough(point);
  }
  else {
    return vLineThrough(point);
  }
};

// next ECB point index, counterclockwise or clockwise (with respect to the ECB)
function turn(number : number, counterclockwise : boolean = true ) : number {
  if (counterclockwise) {
    if (number === 3) {
      return 0;
    }
    else { 
      return number + 1;
    }
  }
  else {
    if (number === 0) {
      return 3 ;
    }
    else {
      return number - 1;
    }
  }
};

// returns true if the vector is moving into the wall, false otherwise
// need to be careful that arguments 2 and 3 are given in the correct order to get the expected result
function movingInto (vec : Vec2D, wallTopOrRight : Vec2D, wallBottomOrLeft : Vec2D, wallType : string) : boolean {
  let sign = 1;
  switch (wallType) {
    case "l": // left wall
    case "g": // ground
    case "b":
    case "d":
    case "p": // platform
      sign = -1;
      break;
    default: // right wall, ceiling
      break;
  }
  // const outwardsWallNormal = new Vec2D ( sign * (wallTopOrRight.y - wallBottomOrLeft.y), sign*( wallBottomOrLeft.x-wallTopOrRight.x )  );
  // return ( dotProd ( vec, outwardsWallNormal ) < 0 );
  return ( dotProd ( vec, new Vec2D ( sign * (wallTopOrRight.y - wallBottomOrLeft.y), sign*(wallBottomOrLeft.x-wallTopOrRight.x) ) ) < 0);
};

// returns true if point is to the right of a "left" wall, or to the left of a "right" wall,
// and false otherwise
function isOutside (point : Vec2D, wallTopOrRight : Vec2D, wallBottomOrLeft : Vec2D, wallType : string) : boolean {
  //const vec = new Vec2D ( point.x - wallBottom.x, point.y - wallBottom.y );
  //return ( !movingInto(vec, wallTop, wallBottom, wallType ) );
  return ( !movingInto( new Vec2D ( point.x - wallBottomOrLeft.x, point.y - wallBottomOrLeft.y ), wallTopOrRight, wallBottomOrLeft, wallType ) );
};

// say line1 passes through the two points p1 = (x1,y1), p2 = (x2,y2)
// and line2 by the two points p3 = (x3,y3) and p4 = (x4,y4)
// this function returns the parameter t, such that p3 + t*(p4-p3) is the intersection point of the two lines
// please ensure this function is not called on parallel lines
function coordinateInterceptParameter (line1 : [Vec2D, Vec2D], line2 : [Vec2D, Vec2D]) : number {
  // const x1 = line1[0].x;
  // const x2 = line1[1].x;
  // const x3 = line2[0].x;
  // const x4 = line2[1].x;
  // const y1 = line1[0].y;
  // const y2 = line1[1].y;
  // const y3 = line2[0].y;
  // const y4 = line2[1].y;
  // const t = ( (x1-x3)*(y2-y1) + (x1-x2)*(y1-y3) ) / ( (x4-x3)*(y2-y1) + (x2-x1)*(y3-y4) );
  // return t;
  return (     (line1[0].x-line2[0].x)*(line1[1].y-line1[0].y) 
             + (line1[0].x-line1[1].x)*(line1[0].y-line2[0].y) ) 
          / (  (line2[1].x-line2[0].x)*(line1[1].y-line1[0].y) 
             + (line1[1].x-line1[0].x)*(line2[0].y-line2[1].y) );
};

// find the intersection of two lines
// please ensure this function is not called on parallel lines
export function coordinateIntercept (line1 : [Vec2D, Vec2D], line2 : [Vec2D, Vec2D]) : Vec2D {
  const t = coordinateInterceptParameter(line1, line2);
  return ( new Vec2D( line2[0].x + t*(line2[1].x - line2[0].x), line2[0].y + t*(line2[1].y - line2[0].y) ) );
};

// ----------------------------------------------------------------------------------------------------------------------------------
// basic collision detection functions

// first: point sweeping functions

export type PointSweepResult = { sweep : number, kind : "surface", surface : [Vec2D, Vec2D], type : string, index : number, pt : number }

// finds whether the ECB impacted a surface on one of its vertices
function runPointSweep ( ecb1 : ECB, ecbp : ECB, same : number
                       , wall : [Vec2D, Vec2D], wallType : string, wallIndex : number
                       , wallBottomOrLeft : Vec2D, wallTopOrRight : Vec2D
                       , xOrY : XOrY ) : null | PointSweepResult {

  let result = null;

  const wallAngle = lineAngle([wallBottomOrLeft, wallTopOrRight]);

  if (wallType === "l" || wallType === "r") { // left or right wall, need to check top or bottom ECB vertex too
    const sameResult = pointSweepingCheck(ecb1, ecbp, same, wall, wallType, wallIndex, wallTopOrRight, wallBottomOrLeft, xOrY);
    const other = wallAngle < Math.PI/2 ? 0 : 2;
    const otherResult  = pointSweepingCheck(ecb1, ecbp, other, wall, wallType, wallIndex, wallTopOrRight, wallBottomOrLeft, xOrY);
    result = pickSmallestSweep([sameResult, otherResult]);
  }
  else if (wallType === "c") { // for ceilings, need to check side ECB vertex too
    const topResult  = pointSweepingCheck(ecb1, ecbp, 2   , wall, wallType, wallIndex, wallTopOrRight, wallBottomOrLeft, xOrY);
    const side = wallAngle < Math.PI/2 ? 3 : 1;
    const sideResult = pointSweepingCheck(ecb1, ecbp, side, wall, wallType, wallIndex, wallTopOrRight, wallBottomOrLeft, xOrY);
    result = pickSmallestSweep([topResult, sideResult]);
  }
  else { // can only collide grounds on the bottom ECB vertex
    result = pointSweepingCheck(ecb1, ecbp, same, wall, wallType, wallIndex, wallTopOrRight, wallBottomOrLeft, xOrY);
  }

  return result;

};

function pointSweepingCheck ( ecb1 : ECB, ecbp : ECB, pt : number
                            , wall : [Vec2D, Vec2D], wallType : string, wallIndex : number
                            , wallTopOrRight : Vec2D
                            , wallBottomOrLeft : Vec2D
                            , xOrY : XOrY ) : null | PointSweepResult {
  let result = null;

  if ( isOutside(ecb1[pt], wallTopOrRight, wallBottomOrLeft, wallType) && !isOutside(ecbp[pt], wallTopOrRight, wallBottomOrLeft, wallType) ) {
    const s = coordinateInterceptParameter (wall, [ecb1[pt], ecbp[pt]]); // need to put wall first
    if (!(isNaN(s) || s === Infinity || s > 1 || s < 0)) {
      const intersection = new Vec2D ((1-s)*ecb1[pt].x + s*ecbp[pt].x, (1-s)*ecb1[pt].y + s*ecbp[pt].y);
      if (getXOrYCoord(intersection, xOrY) <= getXOrYCoord(wallTopOrRight, xOrY) && getXOrYCoord(intersection, xOrY) >= getXOrYCoord(wallBottomOrLeft, xOrY)) {
        result = { sweep : s, kind : "surface", surface : wall, type: wallType, index : wallIndex, pt : pt } ;
      }
    }
  }

  return result;
};

// second: edge sweeping functions

// in this next function, we are considering a line that is sweeping,
// from the initial line 'line1' passing through the two points p1 = (x1,y1), p2 = (x2,y2)
// to the final line 'line2' passing through the two points p3 = (x3,y3) and p4 = (x4,y4)
// there are two sweeping parameters: 
//   't', which indicates how far along each line we are
//   's', which indicates how far we are sweeping between line1 and line2 (the main sweeping parameter)
// for instance:
//  s=0 means we are on line1,
//  s=1 means we are on line2,
//  t=0 means we are on the line between p1 and p3,
//  t=1 means we are on the line between p2 and p4
// this function returns a specific value for each of t and s,
// which correspond to when the swept line hits the origin O (at coordinates (0,0))
// if either of the parameters is not between 0 and 1, this function instead returns null
// see '/doc/linesweep.png' for a visual representation of the situation
function lineSweepParameters( line1 : [Vec2D, Vec2D], line2 : [Vec2D, Vec2D], flip : boolean = false) : [number, number] | null {
  let sign = 1;
  if (flip) {
    sign = -1;
  }
  const x1 = line1[0].x;
  const x2 = line1[1].x;
  const x3 = line2[0].x;
  const x4 = line2[1].x;
  const y1 = line1[0].y;
  const y2 = line1[1].y;
  const y3 = line2[0].y;
  const y4 = line2[1].y;

  const a0 = x2*y1 - x1*y2;
  const a1 = x4*y1 - 2*x2*y1 + 2*x1*y2 - x3*y2 + x2*y3 - x1*y4;
  const a2 = x2*y1 - x4*y1 - x1*y2 + x3*y2 - x2*y3 + x4*y3 + x1*y4 - x3*y4;

  // s satisfies the equation:   a0 + a1*s + a2*s^2 = 0
  const s = solveQuadraticEquation( a0, a1, a2, sign );

  if (s === null || isNaN(s) || s === Infinity || s < 0 || s > 1) {
    return null; // no real solution
  }
  else {
    const t = ( s*(x1 - x3) - x1) / ( x2 - x1 + s*(x1 - x2 - x3 + x4) );
    
    if (isNaN(t) || t === Infinity || t < 0 || t > 1) {
      return null;
    }
    else {
      return [t,s];
    }
  }
};


type EdgeSweepResult = { kind : "corner", corner : Vec2D, sweep : number, angular : number }

// finds whether the ECB impacted a surface on one of its edges
function runEdgeSweep( ecb1 : ECB, ecbp : ECB, same : number
                     , wallType : string
                     , wallLeft : Vec2D, wallRight : Vec2D
                     , wallBottomOrLeft : Vec2D, wallTopOrRight : Vec2D
                     , xOrY : XOrY ) : null | EdgeSweepResult {

  let other = 0; // other ECB point
  let counterclockwise = true; // whether (same ECB point -> other ECB point) is counterclockwise (w.r.t. the ECB)

  let corner = null;
  let otherCorner = null;

  let edgeSweepResult = null;
  let otherEdgeSweepResult = null;

  const flip = wallType === "r" || wallType === "c" ? false : true;

  // case 1
  if ( getXOrYCoord(ecb1[same], xOrY) > getXOrYCoord(wallTopOrRight, xOrY) ) {
    counterclockwise = !flip;
    other = turn(same, counterclockwise);
    if ( getXOrYCoord(ecbp[other], xOrY) < getXOrYCoord(wallTopOrRight, xOrY) ) { 
      corner = wallTopOrRight;
    }
  }

  // case 2
  else if ( getXOrYCoord(ecb1[same], xOrY) < getXOrYCoord(wallBottomOrLeft, xOrY) ) {
    counterclockwise = flip;
    other = turn(same, counterclockwise);
    if ( getXOrYCoord(ecbp[other], xOrY) > getXOrYCoord(wallBottomOrLeft, xOrY) ) { 
      corner = wallBottomOrLeft;
    }
  }

  if (corner !== null ) {
    // the relevant ECB edge, that might collide with the corner, is the edge between ECB points 'same' and 'other'
    let interiorECBside = "l";
    if (counterclockwise === false) {
      interiorECBside = "r";    
    }

    if (!isOutside (corner, ecbp[same], ecbp[other], interiorECBside) && isOutside (corner, ecb1[same], ecb1[other], interiorECBside) ) {
      edgeSweepResult = edgeSweepingCheck( ecb1, ecbp, same, other, counterclockwise, corner );
    }
  }

  if ((wallType === "l" || wallType === "r") && (other === 0)) {
    // if dealing with a wall, we might also want to check the top ECB point for collision if we aren't already doing so
    let otherCounterclockwise = false; // whether ( same ECB point -> top ECB point) is counterclockwise
    otherCorner = wallRight;
    if (wallType === "l") {
      otherCounterclockwise = true;
      otherCorner = wallLeft;
    }

    let otherInteriorECBside = "l";
    if (otherCounterclockwise === false) {
      otherInteriorECBside = "r";
    }

    if (    !isOutside(otherCorner, ecbp[same], ecbp[2], otherInteriorECBside) 
         &&  isOutside(otherCorner, ecb1[same], ecb1[2], otherInteriorECBside)
       ) {
      otherEdgeSweepResult = edgeSweepingCheck( ecb1, ecbp, same, 2, otherCounterclockwise, otherCorner );
    }
  }

  return pickSmallestSweep([edgeSweepResult, otherEdgeSweepResult]);

};

// determines whether the given ECB edge (same--other) has collided with the corner, using the lineSweepParameters function
function edgeSweepingCheck( ecb1 : ECB, ecbp : ECB, same : number, other : number
                          , counterclockwise : boolean
                          , corner : Vec2D ) : null | EdgeSweepResult {

  let output = null;

  // the relevant ECB edge, that might collide with the corner, is the edge between ECB points 'same' and 'other'
  let interiorECBside = "l";   
  if (counterclockwise === false) {
    interiorECBside = "r";
  }

  if (!isOutside ( corner, ecbp[same], ecbp[other], interiorECBside) && isOutside ( corner, ecb1[same], ecb1[other], interiorECBside) ) {

    // we sweep a line,
    // starting from the relevant ECB1 edge, and ending at the relevant ECBp edge,
    // and figure out where this would intersect the corner
    
    // first we recenter everything around the corner,
    // as the 'lineSweepParameters' function calculates collision with respect to the origin
  
    const recenteredECB1Edge = [ new Vec2D( ecb1[same ].x - corner.x, ecb1[same ].y - corner.y )
                               , new Vec2D( ecb1[other].x - corner.x, ecb1[other].y - corner.y ) ];
    const recenteredECBpEdge = [ new Vec2D( ecbp[same ].x - corner.x, ecbp[same ].y - corner.y )
                               , new Vec2D( ecbp[other].x - corner.x, ecbp[other].y - corner.y ) ];
  
    // in the line sweeping, some tricky orientation checks show that a minus sign is required precisely in the counterclockwise case
    // this is what the third argument to 'lineSweepParameters' corresponds to
    const lineSweepResult = lineSweepParameters( recenteredECB1Edge, recenteredECBpEdge, counterclockwise );
    
    if (lineSweepResult !== null) {
      const [t,s] = lineSweepResult;
      const angularParameter = getAngularParameter ( t, same, other );
      output = { kind : "corner", corner : corner, sweep : s, angular : angularParameter };
    }
  }

  return output;

};

// ----------------------------------------------------------------------------------------------------------------------------------
// main collision detection routine

type CollisionDatum = null | PointSweepResult | EdgeSweepResult

// this function finds the first collision that happens as the old ECB moves to the projected ECB
// the sweeping parameter s corresponds to the location of this first collision
// terminology in the comments: a wall is a segment with an inside and an outside (could be a ground or ceiling )
// which is contained in an infinite line, extending both ways, which also has an inside and an outside
function findCollision ( ecb1 : ECB, ecbp : ECB, labelledSurface : LabelledSurface ) : CollisionDatum {

// STANDING ASSUMPTIONS
// the ECB can only collide a ground/platform surface on its bottom point (or a bottom edge)
// the ECB can only collide a ceiling surface on a top or side point (or a top edge)
// the ECB cannot collide a left wall on its left vertex
// the ECB cannot collide a right wall on its right vertex
// walls and corners push out horizontally, grounds/ceilings/platforms push out vertically

  const [wall, [wallType, wallIndex]] = labelledSurface;

  // start defining useful constants/variables
  const wallTop    = extremePoint(wall, "t");
  const wallBottom = extremePoint(wall, "b");
  const wallLeft   = extremePoint(wall, "l");
  const wallRight  = extremePoint(wall, "r");

  // right wall by default
  let wallTopOrRight = wallTop;
  let wallBottomOrLeft = wallBottom;
  let same = 3;
  let xOrY = "y";
  let isPlatform = false;

  switch(wallType) {
    case "l": // left wall
      same = 1;
      break;
    case "p": // platform
      isPlatform = true;
    case "g": // ground
      same = 0;
      wallTopOrRight  = wallRight;
      wallBottomOrLeft = wallLeft;
      xOrY = "x";
      break;
    case "c": // ceiling
      same = 2;
      wallTopOrRight  = wallRight;
      wallBottomOrLeft = wallLeft;
      xOrY = "x";
      break;
    default: // right wall by default
      break;
  }

  // first check if player ECB was even near the wall
  if (    (ecbp[0].y > wallTop.y    && ecb1[0].y > wallTop.y   ) // player ECB stayed above the wall
       || (ecbp[2].y < wallBottom.y && ecb1[2].y < wallBottom.y) // played ECB stayed below the wall
       || (ecbp[3].x > wallRight.x  && ecb1[3].x > wallRight.x ) // player ECB stayed to the right of the wall
       || (ecbp[1].x < wallLeft.x   && ecb1[1].x < wallLeft.x  ) // player ECB stayed to the left of the wall
     ) {
    return null;
  }
  else {

    // if the surface is a platform, and the bottom ECB point is below the platform, we shouldn't do anything
    if ( isPlatform ) {
      if ( !isOutside ( ecb1[same], wallTopOrRight, wallBottomOrLeft, wallType )) {
        return null;
      }
    }

    const closestEdgeCollision  = runEdgeSweep  ( ecb1, ecbp, same
                                                , wallType
                                                , wallLeft, wallRight, wallBottomOrLeft, wallTopOrRight
                                                , xOrY) ;
    const closestPointCollision = runPointSweep ( ecb1, ecbp, same
                                                , wall, wallType, wallIndex
                                                , wallBottomOrLeft, wallTopOrRight
                                                , xOrY );

    let finalCollision = null;

    // if we have only one collision type (point/edge), take that one
    if (closestEdgeCollision === null ) {
      finalCollision = closestPointCollision;
    }
    else if (closestPointCollision === null) {
      finalCollision = closestEdgeCollision;
    }
    // otherwise choose the collision with smallest sweeping parameter
    else if (closestEdgeCollision.sweep > closestPointCollision.sweep) {
      finalCollision = closestPointCollision;
    }
    else {
      finalCollision = closestEdgeCollision;
    }

    return finalCollision;

  }
};


// ----------------------------------------------------------------------------------------------------------------------------------
// some helper functions to return the closest collision (collision with smallest sweeping parameter)

type TouchingDatum = null | { sweep : number, object : { kind : "surface", surface : [Vec2D, Vec2D], type : string, index : number, pt : number} 
                                                     | { kind : "corner", corner : Vec2D, angular : number } 
                            }

// this function finds the first (non-ignored) collision as the ECB1 moves to the ECBp
function findClosestCollision( ecb1 : ECB, ecbp : ECB
                             , labelledSurfaces : Array<LabelledSurface> ) : TouchingDatum {
  const touchingData : Array<TouchingDatum> = [null]; // initialise list of new collisions
  const collisionData = labelledSurfaces.map(
          (labelledSurface) => findCollision ( ecb1, ecbp, labelledSurface ) );
  for (let i = 0; i < collisionData.length; i++) {
    const collisionDatum = collisionData[i];
    if (collisionDatum !== null) {
      if (collisionDatum.kind === "surface") {
        touchingData.push( { sweep : collisionDatum .sweep, object : { kind : "surface"
                                                                   , surface : collisionDatum.surface
                                                                   , type : collisionDatum.type
                                                                   , index : collisionDatum.index
                                                                   , pt : collisionDatum.pt
                                                                   } } );
      }
      else if (collisionDatum.kind === "corner") {
        touchingData.push( { sweep : collisionDatum.sweep, object : { kind : "corner"
                                                                    , corner : collisionDatum.corner
                                                                    , angular : collisionDatum.angular 
                                                                    } } );
      }
    }
  }
  return pickSmallestSweep(touchingData); 
};


// ----------------------------------------------------------------------------------------------------------------------------------
// ECB sliding
// we attempt to move the ECB1 to the ECBp, sliding it against surfaces/corners as it encounters them

type SimpleTouchingDatum = { kind : "surface", type : string, index : number, pt : number } | { kind : "corner", angular : number }

type ECBTouching = { ecb : ECB, squash : SquashDatum, touching : null | SimpleTouchingDatum };
type Sliding = { type : null | "l" | "r" | "c", angular : null | number };
type SlideDatum = { event : "end"     , finalECB : ECB, touching : SimpleTouchingDatum } 
                | { event : "transfer", midECB : ECB, object : { kind : "surface", surface : [Vec2D, Vec2D], type : string, pt : number, index : number } 
                                                             | { kind : "corner", corner : Vec2D, angular : number } }
                | { event : "continue" }

function resolveECB ( ecb1 : ECB, ecbp : ECB, labelledSurfaces : Array<LabelledSurface> ) : ECBTouching {
  return runSlideRoutine( ecb1, ecbp, ecbp, labelledSurfaces, null, { type : null, angular : null }, true, 0 );  
}

function runSlideRoutine( srcECB : ECB, tgtECB : ECB, ecbp : ECB
                        , labelledSurfaces : Array<LabelledSurface>
                        , oldTouchingDatum : null | SimpleTouchingDatum
                        , slidingAgainst : Sliding
                        , final : bool
                        , recursionCounter : number ) : ECBTouching {
  if (recursionCounter > maxRecursion) {
    console.log("'runSlideRoutine': excessive recursion, aborting.");
    drawECB(srcECB, "#286ee0");
    drawECB(tgtECB, "#f49930");
    drawECB(ecbp, "#fff9ad");
    return { ecb : ecbp, squash : { factor : 1, location : null}, touching : null };
  }
  else {
    const slideDatum = slideECB ( srcECB, tgtECB, labelledSurfaces, slidingAgainst );
    let newECBp = ecbp;
  
    if (slideDatum.event === "end") {
      return { ecb : slideDatum.finalECB, squash : { factor : 1, location : null}, touching : slideDatum.touching };
    }
    else if (slideDatum.event === "continue") {
      if (final) {
        return { ecb : tgtECB, squash : { factor : 1, location : null}, touching : oldTouchingDatum };
      }
      else {
        newECBp = updateECBp( srcECB, tgtECB, ecbp, slidingAgainst.type, 0 );
        return runSlideRoutine ( tgtECB, newECBp, newECBp, labelledSurfaces, oldTouchingDatum, slidingAgainst, true, recursionCounter + 1);
      }
    }
    else { // transfer
      const newSrcECB = slideDatum.midECB;
      const slideObject = slideDatum.object;    
  
      let newTouchingDatum;
      let angular;
      let newFinal;
      let newTgtECB;
      let newSlidingType = null;
  
      if ( slideObject.kind === "surface" ) {
        const surface = slideObject.surface;
        const surfaceType = slideObject.type;
        if (surfaceType === "l" || surfaceType === "r" || surfaceType === "c") {
          newSlidingType = surfaceType;
        }
        angular = slideObject.pt;
        newECBp = updateECBp( srcECB, slideDatum.midECB, ecbp, newSlidingType, angular );
        newTouchingDatum = { kind : "surface", type : surfaceType, index : slideObject.index, pt : angular };
        [newTgtECB, newFinal] = findNextTargetFromSurface ( newSrcECB, newECBp, surface, surfaceType, angular );
      }
      else {
        const corner = slideObject.corner;
        angular = slideObject.angular;
        if (angular < 2 && angular > 0) {
          newSlidingType = "l";
        }
        else if (angular > 2) {
          newSlidingType = "r";
        }
        const [same, other] = getSameAndOther(angular);
        newECBp = updateECBp( srcECB, slideDatum.midECB, ecbp, newSlidingType, same );
        [newTgtECB, newFinal] = findNextTargetFromCorner ( newSrcECB, newECBp, corner, angular );
        newTouchingDatum = { kind : "corner", angular : angular };
      }
      return runSlideRoutine ( newSrcECB, newTgtECB, newECBp
                             , labelledSurfaces
                             , newTouchingDatum
                             , { type : newSlidingType
                               , angular : angular }
                             , newFinal
                             , recursionCounter + 1 );
    }
  }
};

// this function figures out if we can move the ECB, from the source ECB to the target ECB
function slideECB ( srcECB : ECB, tgtECB : ECB
                  , labelledSurfaces : Array<LabelledSurface>
                  , slidingAgainst : Sliding
                  ) : SlideDatum {
  // figure our whether a collision occured while moving srcECB -> tgtECB
  const touchingDatum = findClosestCollision( srcECB, tgtECB
                                            , labelledSurfaces );

  if (touchingDatum === null) {
    //console.log("'slideECB': sliding.");
    return { event : "continue"};
  }
  else { 
    const s = touchingDatum.sweep;
    const r = Math.max(0, s - additionalOffset/10); // to account for floating point errors
    const midECB = interpolateECB(srcECB, tgtECB, r);
    const collisionObject = touchingDatum.object;

    if ( slidingAgainst.type === null ) {
      if ( collisionObject.kind === "surface" ) {
        if (collisionObject.type === "g" || collisionObject.type === "p") {
          //console.log("'slideECB': sliding interrupted by landing.");
          return { event : "end"
                 , finalECB : midECB
                 , touching : { kind : "surface"
                              , type : collisionObject.type
                              , index : collisionObject.index
                              , pt : collisionObject.pt 
                              }
                 };
        }
        else {
          //console.log("'slideECB': beginning slide on surface.");
          return { event : "transfer"
                 , midECB : midECB
                 , object : { kind : "surface"
                            , surface : collisionObject.surface
                            , type    : collisionObject.type
                            , pt      : collisionObject.pt 
                            , index   : collisionObject.index
                            } 
                 };
        }
      }
      else {
        //console.log("'slideECB': beginning slide on corner.");
        return { event : "transfer"
               , midECB : midECB
               , object : { kind    : "corner"
                          , corner  : collisionObject.corner
                          , angular : collisionObject.angular 
                          } 
               };
      }
    }
    else {
      const slidingType = slidingAgainst.type;
      if ( collisionObject.kind === "surface" ) {
        const surfaceType = collisionObject.type;
        if ( slidingType === null || surfaceType === slidingType ) {
          //console.log("'slideECB': transferring slide to new surface.");
          return { event : "transfer"
                 , midECB : midECB
                 , object : { kind : "surface"
                            , surface : collisionObject.surface
                            , type    : collisionObject.type
                            , pt      : collisionObject.pt
                            , index   : collisionObject.index
                            } 
                 };
        }
        else {
          //console.log("'slideECB': interrupting sliding because of conflicting surface collision.");
          return { event : "end"
                 , finalECB : midECB
                 , touching : { kind : "surface"
                              , type : collisionObject.type
                              , index : collisionObject.index
                              , pt : collisionObject.pt 
                              }
                 };
        }
      }
      else {
        const angularParameter = collisionObject.angular;
        if ( slidingType === null 
             || (angularParameter <= 2 && slidingType === "l") 
             || ((angularParameter === 0 || angularParameter >=2) && slidingType === "r") ) {
          //console.log("'slideECB': transferring slide to new corner.");
          return { event : "transfer"
                 , midECB : midECB, object : { kind : "corner"
                                             , corner  : collisionObject.corner
                                             , angular : angularParameter
                                             }
                 };
        }
        else {
          //console.log("'slideECB': interrupting sliding because of conflicting corner collision.");
          return { event : "end"
                 , finalECB : midECB
                 , touching : { kind : "corner"
                              , angular : angularParameter }
                 };
        }
      }
    }
  }
};

function findNextTargetFromSurface ( srcECB : ECB, ecbp : ECB, wall : [Vec2D, Vec2D], wallType : string, pt : number ) : [ECB, bool] {
  let wallForward;
  let s = 1;
  let tgtECB = ecbp;
  let pushout = 0;
  let final = true;

  const sign = (wallType === "l" || wallType === "c") ? -1 : 1;
  const additionalPushout = sign * additionalOffset;
  const xOrY = (wallType === "l" || wallType === "r") ? "x" : "y";

  if (wallType === "c") {
    const wallLeft = extremePoint(wall, "l");
    const wallRight = extremePoint(wall, "r");
    if (ecbp[pt].x <= wallRight.x && ecbp[pt].x >= wallLeft.x) {
      const intercept = coordinateIntercept(vLineThrough(ecbp[pt]), wall);
      pushout = intercept.y - ecbp[pt].y;
    }
    else {
      wallForward = ecbp[pt].x < srcECB[pt].x ? wallLeft : wallRight;
      s = (wallForward.x - srcECB[pt].x) / (ecbp[pt].x - srcECB[pt].x);
      s = Math.min(Math.max(s,0), 1);
      tgtECB = interpolateECB(srcECB, ecbp, s);
      pushout = wallForward.y - tgtECB[pt].y;
    }
  }
  else {
    const wallBottom = extremePoint(wall, "b");
    const wallTop = extremePoint(wall, "t");
    if (ecbp[pt].y <= wallTop.y && ecbp[pt].y >= wallBottom.y) {
      const intercept = coordinateIntercept(hLineThrough(ecbp[pt]), wall);
      pushout = intercept.x - ecbp[pt].x;
    }
    else {
      wallForward = ecbp[pt].y < srcECB[pt].y ? wallBottom : wallTop;
      s = (wallForward.y - srcECB[pt].y) / (ecbp[pt].y - srcECB[pt].y);
      s = Math.min(Math.max(s,0), 1);
      tgtECB = interpolateECB(srcECB, ecbp, s);
      pushout = wallForward.x - tgtECB[pt].x;
    }
  }

  if (s < 1 || sign * pushout < 0 ) {
    final = false;
  }

  tgtECB = moveECB(tgtECB, putXOrYCoord(pushout + additionalPushout, xOrY));

  drawECB(ecbp  , "#8f54ff");
  drawECB(tgtECB, "#35f4ab");

  return [tgtECB, final];
};

function findNextTargetFromCorner ( srcECB : ECB, ecbp : ECB, corner : Vec2D, angularParameter : number) : [ECB, bool] {
  const [same, other] = getSameAndOther(angularParameter);
  const LRSign = (same  === 1) ? -1 : 1;
  const UDSign = (other === 2) ? -1 : 1;
  const additionalPushout = LRSign * additionalOffset;

  let tgtECB = ecbp;
  let s = 1;
  let pushout = 0;
  let final = true;

  if ( UDSign * ecbp[same].y < UDSign * corner.y ) {
    s = (corner.y - srcECB[same].y) / (ecbp[same].y - srcECB[same].y);
    s = Math.min(Math.max(s,0), 1);
    tgtECB = interpolateECB(srcECB, ecbp, s);
    pushout = corner.x - tgtECB[same].x;
  }
  else if ( UDSign * ecbp[other].y < UDSign * corner.y ) {
    const intercept = coordinateIntercept( hLineThrough(corner), [ecbp[same], ecbp[other]]);
    pushout = corner.x - intercept.x + additionalPushout;
  }
  else {
    s = (corner.y - srcECB[other].y) / (ecbp[other].y - srcECB[other].y);
    s = Math.min(Math.max(s,0), 1);
    tgtECB = interpolateECB(srcECB, ecbp, s);
    pushout = corner.x - tgtECB[other].x;
  }

  if (s < 1 || LRSign * pushout < 0) {
    final = false;
  }

  tgtECB = moveECB(tgtECB, putXOrYCoord(pushout + additionalPushout, "x"));

  drawECB(ecbp  , "#1098c9");
  drawECB(tgtECB, "#5cbc12");
  drawPoint(corner, "#ffc23f");

  return [tgtECB, final];

};

function updateECBp( startECB : ECB, endECB : ECB, ecbp : ECB, slidingType : null | string, pt : number ) : ECB {
  if (slidingType === null) {
    return ecbp;
  }
  else {
    const xOrY = (slidingType === "l" || slidingType === "r") ? "x" : "y";
    let pushout = 0;
    if ( getXOrYCoord(startECB[pt], flipXOrY(xOrY)) === getXOrYCoord(ecbp[pt], flipXOrY(xOrY)) ) {
      pushout = getXOrYCoord(endECB[pt], xOrY) - getXOrYCoord(startECB[pt], xOrY);
    }
    else {
      const intercept = coordinateIntercept(lineThrough(endECB[pt], xOrY), [startECB[pt], ecbp[pt]]);
      pushout = getXOrYCoord(intercept, xOrY) - getXOrYCoord(endECB[pt], xOrY);
    }
    return moveECB(ecbp, putXOrYCoord(pushout, xOrY));
  }
};


// ----------------------------------------------------------------------------------------------------------------------------------
// convert between angular parameters and "same/other" data

function getAngularParameter ( t : number, same : number, other : number) {
  if (same === 3 && other === 0) {
    return ((1-t)*3 + t*4);
  }
  else if (same === 0 && other === 3) {
    return ((1-t)*4 + t*3);
  }
  else {
    return ((1-t)*same + t*other);
  }
};

function getSameAndOther( a : number ) : [number, number] {
  if (a < 1) {
    return [1, 0];
  }
  else if (a < 2) {
    return [1, 2];
  }
  else if (a < 3) {
    return [3, 2];
  }
  else {
    return [3, 0];
  }
};


// ----------------------------------------------------------------------------------------------------------------------------------
// ECB squashing and re-inflating


// finds the ECB squash factor for a grounded ECB
export function groundedECBSquashFactor( ecbTop : Vec2D, ecbBottom : Vec2D, ceilings : Array<[Vec2D, Vec2D]>) : null | number {
  const ceilingYValues = ceilings.map ( (ceil) => {
    if (ecbTop.x < extremePoint(ceil, "l").x || ecbTop.x > extremePoint(ceil, "r").x ) {
      return null;
    } 
    else {
      return coordinateIntercept( [ ecbBottom, ecbTop ] , ceil).y;
    }
  } );
  const lowestCeilingYValue = findSmallestWithin(ceilingYValues, ecbBottom.y, ecbTop.y);
  const offset = additionalOffset/10;
  if (lowestCeilingYValue === null) {
    return null;
  }
  else {
    return ( Math.max(offset, (lowestCeilingYValue - ecbBottom.y) / (ecbTop.y - ecbBottom.y) - offset));
  }
};

// finds the ECB squash factor by inflating the ECB from the point on the ECB given by the angular parameter t
// if angular parameter is null, instead inflates the ECB from its center
function inflateECB ( ecb : ECB, t : null | number
                    , relevantSurfaces : Array<LabelledSurface> ) : SquashDatum {
  const focus = ecbFocusFromAngularParameter(ecb, t);
  const offset = additionalOffset/10;
  const pointlikeECB : ECB = [ new Vec2D ( focus.x         , focus.y - offset ) 
                             , new Vec2D ( focus.x + offset, focus.y          )
                             , new Vec2D ( focus.x         , focus.y + offset )
                             , new Vec2D ( focus.x - offset, focus.y          )
                             ];

  const closestCollision = findClosestCollision( pointlikeECB, ecb
                                               , relevantSurfaces );
  
  if (closestCollision === null) { 
    return { location : t, factor : 1};
  }
  else {
    return { location : t, factor : Math.max(offset, closestCollision.sweep - offset)}; // ECB angular parameter, sweeping parameter
  }
}

function reinflateECB ( ecb : ECB, position : Vec2D
                      , relevantSurfaces : Array<LabelledSurface>
                      , oldecbSquashDatum : SquashDatum
                      ) : [Vec2D, SquashDatum, ECB] {
  let q = 1;
  const angularParameter = oldecbSquashDatum.location;
  if (oldecbSquashDatum.factor < 1) {
    q = 1 / oldecbSquashDatum.factor + additionalOffset/5;    
    const focus = ecbFocusFromAngularParameter(ecb, angularParameter);
    const fullsizeecb = [ new Vec2D ( q*ecb[0].x + (1-q)*focus.x , q*ecb[0].y + (1-q)*focus.y )
                        , new Vec2D ( q*ecb[1].x + (1-q)*focus.x , q*ecb[1].y + (1-q)*focus.y )
                        , new Vec2D ( q*ecb[2].x + (1-q)*focus.x , q*ecb[2].y + (1-q)*focus.y )
                        , new Vec2D ( q*ecb[3].x + (1-q)*focus.x , q*ecb[3].y + (1-q)*focus.y )
                        ];
    const ecbSquashDatum = inflateECB (fullsizeecb, angularParameter, relevantSurfaces);    
    const squashedecb = squashECBAt(fullsizeecb, ecbSquashDatum);
    const newPosition = new Vec2D( position.x + squashedecb[0].x - ecb[0].x
                                 , position.y );
    return [newPosition, ecbSquashDatum, squashedecb];

  }
  else {
    return [position, { location : angularParameter, factor : 1}, ecb];
  }
};


// ----------------------------------------------------------------------------------------------------------------------------------
// main collision routine

// this function initialises necessary data and then calls the main collision routine loop
export function runCollisionRoutine( ecb1 : ECB, ecbp : ECB, position : Vec2D
                                   , ecbSquashDatum : SquashDatum
                                   , horizIgnore : string
                                   , stage : Stage
                                   ) : [ Vec2D // new position
                                       , null | [string, number] // collision surface type and index
                                       , SquashDatum // ECB scaling data
                                       , ECB // final ECB to become next frame ECB1
                                       ] {

  // --------------------------------------------------------------
  // BELOW: this is recomputed every frame and should be avoided
  
  const stageWalls = zipLabels(stage.wallL,"l").concat( zipLabels(stage.wallR,"r") );
  const stageGrounds = zipLabels(stage.ground,"g");
  const stageCeilings = zipLabels(stage.ceiling,"c");
  const stagePlatforms = zipLabels(stage.platform, "p");

  // ABOVE: this is recomputed every frame and should be avoided
  // --------------------------------------------------------------

  const allSurfacesMinusPlatforms = stageWalls.concat(stageGrounds).concat(stageCeilings);
  let relevantSurfaces = [];
  switch (horizIgnore) {
    case "platforms":
      relevantSurfaces = stageWalls.concat(stageGrounds).concat(stageCeilings);    
      break;
    case "none":
    default:
      relevantSurfaces = stageWalls.concat(stageGrounds).concat(stageCeilings).concat(stagePlatforms);
      break;
    case "all":
      relevantSurfaces = stageWalls;
      break;
  }

  const resolution = resolveECB( ecb1, ecbp, relevantSurfaces );
  const newTouching = resolution.touching;
  let newECBp = resolution.ecb;
  let newSquashDatum = resolution.squash;
  newSquashDatum.factor *= ecbSquashDatum.factor;
  let newPosition = subtract(add(position, newECBp[0]), ecbp[0]);

  let collisionLabel = null;
  if (newTouching !== null) {
    if (newTouching.kind === "surface") {
      collisionLabel = [newTouching.type, newTouching.index];
    }
    else {
      collisionLabel = ["x", -1];
    }
  }

  if (newSquashDatum.factor < 1 ) {
    if (newSquashDatum.location === null) {
      newSquashDatum.location = ecbSquashDatum.location;
    }
    [ newPosition
    , newSquashDatum
    , newECBp ] = reinflateECB( newECBp, newPosition
                              , allSurfacesMinusPlatforms
                              , newSquashDatum
                              );
  } 

  return [ newPosition, collisionLabel, newSquashDatum, newECBp ];

};
