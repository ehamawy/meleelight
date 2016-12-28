// @flow
/*eslint indent:1*/ // get stuffed

import {Vec2D, getXOrYCoord, putXOrYCoord} from "../main/util/Vec2D";
import {dotProd, scalarProd, add, subtract, norm, orthogonalProjection} from "../main/linAlg";
import {findSmallestWithin} from "../main/util/findSmallestWithin";
import {solveQuadraticEquation} from "../main/util/solveQuadraticEquation";
import {lineAngle} from "../main/util/lineAngle";
import {extremePoint} from "../stages/util/extremePoint";
import {moveECB, squashECBAt, ecbFocusFromAngularParameter, interpolateECB} from "../main/util/ecbTransform";
import {zipLabels} from "../main/util/zipLabels";

// eslint-disable-next-line no-duplicate-imports
import type {ECB, SquashDatum} from "../main/util/ecbTransform";
// eslint-disable-next-line no-duplicate-imports
import type {Stage, LabelledSurface} from "../stages/stage";



export const additionalOffset : number = 0.00001;

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
function lineThrough ( point : Vec2D, xOrY : number ) : [Vec2D, Vec2D] {
  if (xOrY === 0) {
    return hLineThrough(point);
  }
  else {
    return vLineThrough(point);
  }
};

// next ECB point index, counterclockwise or clockwise
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

type PointSweepResult = { sweep : number, kind : "surface", surface : [Vec2D, Vec2D], type : string, index : number, pt : number }

// finds whether the ECB impacted a surface on one of its vertices
function pointSweepingCheck ( ecb1 : ECB, ecbp : ECB, same : number
                            , wall : [Vec2D, Vec2D], wallType : string, wallIndex : number ) : null | PointSweepResult {

  let xOrY;
  let wallBottomOrLeft;
  let wallTopOrRight;
  if (wallType === "l" || wallType === "r") {
    xOrY = 1;
    wallBottomOrLeft = extremePoint(wall, "b");
    wallTopOrRight   = extremePoint(wall, "t");
  }
  else {
    xOrY = 0;
    wallBottomOrLeft = extremePoint(wall, "l");
    wallTopOrRight   = extremePoint(wall, "r");
  }

  let relevantECB1Point = ecb1[same];
  let relevantECBpPoint = ecbp[same];

  if (wallType === "l" || wallType === "r") { // left or right wall, might need to check top or bottom ECB points instead
    let sign = 1;
    if (wallType === "l") {
      sign = -1;
    }
    const wallAngle      = lineAngle([wallBottomOrLeft, wallTopOrRight]);
    const bottomECBAngle = lineAngle([ecbp[0]         , ecbp[same]    ]);
    const topECBAngle    = lineAngle([ecbp[same]      , ecbp[2]       ]);
    if (sign * wallAngle < sign * topECBAngle) {
      relevantECB1Point = ecb1[2];
      relevantECBpPoint = ecbp[2];
    }
    else if (sign * wallAngle > sign * bottomECBAngle) {
      relevantECB1Point = ecb1[0];
      relevantECBpPoint = ecbp[0];
    }
  }

  if ( !isOutside(relevantECB1Point, wallTopOrRight, wallBottomOrLeft, wallType) || isOutside(relevantECBpPoint, wallTopOrRight, wallBottomOrLeft, wallType) ) {
    return null; // ECB did not cross the surface in the direction it can stop the ECB
  }
  else {
    const s = coordinateInterceptParameter (wall, [relevantECB1Point, relevantECBpPoint]); // need to put wall first

    if (s > 1 || s < 0 || isNaN(s) || s === Infinity) {
      console.log("'pointSweepingCheck': no collision with "+wallType+" surface, sweeping parameter outside of allowable range.");
      return null; // no collision
    }
    else {
      const intersection = new Vec2D (relevantECB1Point.x + s*(relevantECBpPoint.x-relevantECB1Point.x), relevantECB1Point.y + s*(relevantECBpPoint.y-relevantECB1Point.y));
      if (getXOrYCoord(intersection, xOrY) > getXOrYCoord(wallTopOrRight, xOrY) || getXOrYCoord(intersection, xOrY) < getXOrYCoord(wallBottomOrLeft, xOrY)) {
        console.log("'pointSweepingCheck': no collision, intersection point outside of "+wallType+" surface.");
        return null; // no collision
      }
      else {
        console.log("'pointSweepingCheck': collision, crossing relevant ECB point, "+wallType+" surface. Sweeping parameter s="+s+".");
        return { sweep : s, kind : "surface", surface : wall, type: wallType, index : wallIndex, pt : same } ;
      }
    }
  }
};

// in this function, we are considering a line that is sweeping,
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

// determines whether the ECB has moved across a corner, using the lineSweepParameters function
// returns null (for no collision) or collision data: ["x", pushout value, sweeping parameter, angular parameter]
function edgeSweepingCheck( ecb1 : ECB, ecbp : ECB, same : number, other : number
                          , counterclockwise : boolean
                          , corner : Vec2D ) : null | EdgeSweepResult {


  // the relevant ECB edge, that might collide with the corner, is the edge between ECB points 'same' and 'other'
  let interiorECBside = "l";   
  if (counterclockwise === false) {
    interiorECBside = "r";
  }

  if (!isOutside ( corner, ecbp[same], ecbp[other], interiorECBside) && isOutside ( corner, ecb1[same], ecb1[other], interiorECBside) ) {

    let [t,s] = [0,0];
  
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
    
    if (! (lineSweepResult === null) ) {

      [t,s] = lineSweepResult;
      const angularParameter = getAngularParameter ( t, same, other );
      console.log("'edgeSweepingCheck': collision, relevant edge of ECB has moved across corner. Sweeping parameter s="+s+".");
      return { kind : "corner", corner : corner, sweep : s, angular : angularParameter };
    }

    else {
      console.log("'edgeSweepingCheck': no edge collision, relevant edge of ECB does not cross corner.");
      return null;
    }
  }
  else {
    console.log("'edgeSweepingCheck': no edge collision, corner did not switch relevant ECB edge sides.");
    return null;
  }
};

// ----------------------------------------------------------------------------------------------------------------------------------
// main collision detection routine

type CollisionDatum = null | PointSweepResult | EdgeSweepResult
// recall:
// type PointSweepResult = { kind : "surface", surface : [Vec2D, Vec2D], sweep : number, pt      : number }
// type EdgeSweepResult  = { kind : "corner" , corner  : Vec2D         , sweep : number, angular : number }

// ecbp : projected ECB
// ecb1 : old ECB
// this function finds the first collision that happens as the old ECB moves to the projected ECB
// the sweeping parameter s corresponds to the location of this first collision
// terminology in the comments: a wall is a segment with an inside and an outside (could be a ground or ceiling )
// which is contained in an infinite line, extending both ways, which also has an inside and an outside
function findCollision ( ecb1 : ECB, ecbp : ECB, labelledSurface : LabelledSurface ) : CollisionDatum {

// STANDING ASSUMPTIONS
// the ECB can only collide a ground/platform surface on its bottom point (or a bottom edge on a corner of the ground/platform)
// the ECB can only collide a ceiling surface on its top point (or a top edge on a corner)
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
  let xOrY = 1; // y by default
  let isPlatform = false;
  let flip = false;
  let sign = 1;

  let other = 0; // this will be calculated later, not in the following switch statement

  switch(wallType) {
    case "l": // left wall
      same = 1;
      flip = true;
      break;
    case "p": // platform
      isPlatform = true;
    case "g": // ground
    case "b":
    case "d":
      same = 0;
      wallTopOrRight  = wallRight;
      wallBottomOrLeft = wallLeft;
      xOrY = 0;
      flip = true;
      sign = -1;
      break;
    case "c": // ceiling
    case "t":
    case "u":
      same = 2;
      wallTopOrRight  = wallRight;
      wallBottomOrLeft = wallLeft;
      xOrY = 0;
      break;
    default: // right wall by default
      break;
  }

  const wallAngle = lineAngle([wallBottomOrLeft, wallTopOrRight]);
  const checkTopInstead = (wallType === "l" || wallType === "r") && (sign * wallAngle < sign * lineAngle([ecbp[same], ecbp[2]]));

  // first check if player ECB was even near the wall
  if (    (ecbp[0].y > wallTop.y    && ecb1[0].y > wallTop.y   ) // player ECB stayed above the wall
       || (ecbp[2].y < wallBottom.y && ecb1[2].y < wallBottom.y) // played ECB stayed below the wall
       || (ecbp[3].x > wallRight.x  && ecb1[3].x > wallRight.x ) // player ECB stayed to the right of the wall
       || (ecbp[1].x < wallLeft.x   && ecb1[1].x < wallLeft.x  ) // player ECB stayed to the left of the wall
     ) {
    //console.log("'findCollision': no collision, ECB not even near "+wallType+""+wallIndex+".");
    return null;
  }
  else {

    // if the surface is a platform, and the bottom ECB point is below the platform, we shouldn't do anything
    if ( isPlatform ) {
      if ( !isOutside ( ecb1[same], wallTopOrRight, wallBottomOrLeft, wallType )) {
        console.log("'findCollision': no collision, bottom ECB1 point was below p"+wallIndex+".");
        return null;
      }
    }

    // -------------------------------------------------------------------------------------------------------------------------------------------------------
    // now, we check whether the ECB is colliding on an edge, and not a vertex

    // first, figure out which is the relevant ECB edge that could collide at the corner
    // we know that one of the endpoints of this edge is the same-side ECB point of the wall,
    // we are left to find the other, which we'll call 'other'


    let counterclockwise = true; // whether (same ECB point -> other ECB point) is counterclockwise or not

    let corner = null;
    let otherCorner = null;

    let closestEdgeCollision = null;
    let edgeSweepResult = null;
    let otherEdgeSweepResult = null;

    // ignore all ECB edge collision checking if horizontal pushout is ignored
    // we already tackled this if ignoringPushouts === "all"

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

    if (corner !== null) {
      // the relevant ECB edge, that might collide with the corner, is the edge between ECB points 'same' and 'other'
      let interiorECBside = "l";
      if (counterclockwise === false) {
        interiorECBside = "r";    
      }

      if (!isOutside (corner, ecbp[same], ecbp[other], interiorECBside) && isOutside (corner, ecb1[same], ecb1[other], interiorECBside) ) {
        edgeSweepResult = edgeSweepingCheck( ecb1, ecbp, same, other, counterclockwise, corner );
      }
    }

    if (checkTopInstead) {
      // unless we are dealing with a wall where the ECB can collided on the topmost point, in whih case 'same' and 'top' are relevant
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


    // if only one of the two ECB edges (same-other / same-top) collided, take that one
    if (edgeSweepResult === null) {
      if (otherEdgeSweepResult !== null) {
        closestEdgeCollision = otherEdgeSweepResult;
      }
    }
    else if (otherEdgeSweepResult === null) {
      if (edgeSweepResult !== null) {
        closestEdgeCollision = edgeSweepResult;
      }
    }
    // otherwise choose the collision with smallest sweeping parameter
    else if ( otherEdgeSweepResult.sweep > edgeSweepResult.sweep ) {
      closestEdgeCollision = edgeSweepResult;
    }
    else {
      closestEdgeCollision = otherEdgeSweepResult;
    }
 

    // end of edge case checking
    // -------------------------------------------------------------------------------------------------------------------------------------------------------

    // -------------------------------------------------------------------------------------------------------------------------------------------------------
    // ECB vertex collision checking

    const closestPointCollision = pointSweepingCheck ( ecb1, ecbp, same, wall, wallType, wallIndex );

    // end of ECB vertex collision checking
    // -------------------------------------------------------------------------------------------------------------------------------------------------------

    // -------------------------------------------------------------------------------------------------------------------------------------------------------
    // final gathering of collisions

    let finalCollision;

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

// touching datum is null, or: wall type and index, sweeping parameter, and additional data about the collided object (surface/edge)
type TouchingDatum = null | { sweep : number, object : { kind : "surface", surface : [Vec2D, Vec2D], type : string, index : number, pt : number} | { kind : "corner", corner : Vec2D, angular : number } }

// recall:
// type CollisionDatum = null | PointSweepResult | EdgeSweepResult
// type PointSweepResult = { sweep : number, kind : "surface", surface : [Vec2D, Vec2D], type : string, index : number, pt : number }
// type EdgeSweepResult  = { sweep : number, kind : "corner" , corner  : Vec2D         , angular : number }

// this function finds the first (non-ignored) collision as the ECB1 moves to the ECBp
// return type: either null (no collision), or a new center, with a label according to which surface was collided (null if a corner)
function findClosestCollision( ecb1 : ECB, ecbp : ECB
                             , labelledSurfaces : Array<LabelledSurface> ) : TouchingDatum {
  const touchingData : Array<TouchingDatum> = [null]; // initialise list of new collisions
  const collisionData = labelledSurfaces.map(
          (labelledSurface) => findCollision ( ecb1, ecbp, labelledSurface ) );
  for (let i = 0; i < collisionData.length; i++) {
    const thisData = collisionData[i];
    if (thisData !== null) {
      if (thisData.kind === "surface") {
        touchingData.push( { sweep : thisData.sweep, object : { kind : "surface"
                                                              , surface : thisData.surface
                                                              , type : thisData.type
                                                              , index : thisData.index
                                                              , pt : thisData.pt
                                                              } } );
      }
      else if (thisData.kind === "corner") {
        touchingData.push( { sweep : thisData.sweep, object : { kind : "corner"
                                                              , corner : thisData.corner
                                                              , angular : thisData.angular 
                                                              } } );
      }
    }
  }
  return closestTouchingDatum(touchingData); 
};

// returns the closest touching datum from the provided list, by comparing sweeping parameters
function closestTouchingDatum ( touchingData : Array<TouchingDatum> ) : TouchingDatum {
  let newTouchingDatum = null;
  let start = -1;
  const l = touchingData.length;

  // start by looking for the first non-null touching datum
  for (let i = 0; i < l; i++) {
    if (touchingData[i] !== null) {
      newTouchingDatum = touchingData[i];
      start = i+1;
      break;
    }
  }
  if (newTouchingDatum === null || start > l) {
    // no non-null touching datum found
    return null;
  }
  else {
    // choose the touching datum with smallest sweeing parameter
    for (let j = start; j < l; j++) {
      if (touchingData[j] !== null && touchingData[j].sweep < newTouchingDatum.sweep) {
        newTouchingDatum = touchingData[j];
      }
    }
    return newTouchingDatum;
  }
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
  return sliders( ecb1, ecbp, ecbp, labelledSurfaces, null, { type : null, angular : null } );  
}

function sliders( srcECB : ECB, tgtECB : ECB, ecbp : ECB
                , labelledSurfaces : Array<LabelledSurface>
                , oldTouchingDatum : null | SimpleTouchingDatum
                , slidingAgainst : Sliding ) : ECBTouching {
  const slideDatum = slideECB ( srcECB, tgtECB, labelledSurfaces, slidingAgainst );
  if (slideDatum.event === "end") {
    return { ecb : slideDatum.finalECB, squash : { factor : 1, location : null}, touching : slideDatum.touching };
  }
  else if (slideDatum.event === "continue") {
    return { ecb : tgtECB, squash : { factor : 1, location : null}, touching : oldTouchingDatum };
  }
  else { // transfer
    const newSrcECB = slideDatum.midECB;
    const slideObject = slideDatum.object;
    const newECBp = updateECBp( srcECB, slideDatum.midECB, ecbp, 0 );

    let newTouchingDatum;
    let angular;
    let newTgtECB;

    if ( slideObject.kind === "surface" ) {
      const surface = slideObject.surface;
      const surfaceType = slideObject.type;
      angular = slideObject.pt;
      newTouchingDatum = { kind : "surface", type : surfaceType, index : slideObject.index, pt : angular };
      newTgtECB = findNextTargetFromSurface ( newSrcECB, newECBp, surface, surfaceType );
    }
    else {
      const corner = slideObject.corner;
      angular = slideObject.angular;
      newTgtECB = findNextTargetFromCorner ( newSrcECB, newECBp, corner, angular );
      newTouchingDatum = { kind : "corner", angular : angular };
    }
    return sliders ( newSrcECB, newTgtECB, newECBp
                   , labelledSurfaces
                   , newTouchingDatum
                   , { type : slidingAgainst.type // type hasn't changed, as we transferred
                     , angular : angular } );
  }
};

// recall :
// type TouchingDatum = null | { sweep : number, object : { kind : "surface", surface : [Vec2D, Vec2D], type : string, pt : number} | { kind : "corner", corner : Vec2D, angular : number } }

// this function figures out if we can move the ECB, from the source ECB to the target ECB
function slideECB ( srcECB : ECB, tgtECB : ECB
                  , labelledSurfaces : Array<LabelledSurface>
                  , slidingAgainst : Sliding
                  ) : SlideDatum {
  // figure our whether a collision occured while moving srcECB -> tgtECB
  const touchingDatum = findClosestCollision( srcECB, tgtECB
                                            , labelledSurfaces );

  if (touchingDatum === null) {
    console.log("'slideECB': sliding.");
    return { event : "continue" };
  }
  else { 
    const s = touchingDatum.sweep;
    const r = Math.max(0, s - additionalOffset/10); // to account for floating point errors
    const midECB = interpolateECB(srcECB, tgtECB, r);
    const collisionObject = touchingDatum.object;

    if ( slidingAgainst.type === null ) {
      if ( collisionObject.kind === "surface" ) {
        if (collisionObject.type === "g" || collisionObject.type === "p") {
          console.log("'slideECB': sliding interrupted by landing.");
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
          console.log("'slideECB': beginning slide on surface.");
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
        console.log("'slideECB': beginning slide on corner.");
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
        const surfaceType = collisionObject.surface;        
        if ( slidingType === null || surfaceType === slidingType ) {
          console.log("'slideECB': transferring slide to new surface.");
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
          console.log("'slideECB': interrupting sliding because of conflicting surface collision.");
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
          console.log("'slideECB': transferring slide to new corner.");
          return { event : "transfer"
                 , midECB : midECB, object : { kind : "corner"
                                             , corner  : collisionObject.corner
                                             , angular : angularParameter
                                             }
                 };
        }
        else {
          console.log("'slideECB': interrupting sliding because of conflicting corner collision.");
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

function findNextTargetFromSurface ( srcECB : ECB, ecbp : ECB, wall : [Vec2D, Vec2D], wallType : string ) : ECB {
  let wallForward;
  let s;
  let tgtECB;
  if (wallType === "c") {
    const wallLeft = extremePoint(wall, "l");
    const wallRight = extremePoint(wall, "r");
    if (ecbp[2].x <= wallRight.x && ecbp[2].x >= wallLeft.x) {
      const intercept = coordinateIntercept(vLineThrough(ecbp[2]), wall);
      tgtECB = moveECB( ecbp, new Vec2D (0, intercept.y - ecbp[2].y - additionalOffset ));
    }
    else {
      wallForward = ecbp[2].x < srcECB[2].x ? wallLeft : wallRight;
      s = (wallForward.x - srcECB[2].x) / (ecbp[2].x - srcECB[2].x);
      tgtECB = interpolateECB(srcECB, ecbp, s);
      tgtECB = moveECB(tgtECB, new Vec2D ( 0, wallForward.y - tgtECB[2].y - additionalOffset ) );
    }
  }
  else {
    const wallBottom = extremePoint(wall, "b");
    const wallTop = extremePoint(wall, "t");
    const pt = relevantECBPointFromWall(srcECB, wallBottom, wallTop, wallType);
    const additionalPushout = (wallType === "l") ? (-additionalOffset) : additionalOffset;
    if (ecbp[pt].y <= wallTop.y && ecbp[pt].y >= wallBottom.y) {
      const intercept = coordinateIntercept(hLineThrough(ecbp[pt]), wall);
      tgtECB = moveECB( ecbp, new Vec2D( intercept.x - ecbp[pt].x + additionalPushout, 0));
    }
    else {
      wallForward = ecbp[pt].y < srcECB[pt].y ? wallBottom : wallTop;
      s = (wallForward.y - srcECB[pt].y) / (ecbp[pt].y - srcECB[pt].y);
      tgtECB = interpolateECB(srcECB, ecbp, s);
      tgtECB = moveECB(tgtECB, new Vec2D ( wallForward.x - tgtECB[pt].x + additionalPushout, 0 ) );
    }
  }
  return tgtECB;
};

function findNextTargetFromCorner ( srcECB : ECB, ecbp : ECB, corner : Vec2D, angularParameter : number) : ECB {
  const [same, other] = getSameAndOther(angularParameter);
  const sign = (same === 1 || other === 1) ? "-" : "+";
  const additionalPushout = sign === "-" ? (-additionalOffset) : additionalOffset;
  let tgtECB;
  if (    (sign === "+" && ecbp[same].x < corner.x) 
       || (sign === "-" && ecbp[same].x > corner.x) ) {
    const intercept = coordinateIntercept( hLineThrough(corner), [ecbp[same], ecbp[other]]);
    tgtECB = moveECB( ecbp, new Vec2D (corner.x - intercept.x + additionalPushout, 0));
  }
  else {
    const s = (corner.y - srcECB[same].y) / (ecbp[same].y - srcECB[same].y);
    tgtECB = interpolateECB(srcECB, ecbp, s);
    tgtECB = moveECB(tgtECB, new Vec2D (corner.x - tgtECB[same].x + additionalPushout, 0));
  }
  return tgtECB;
};

function updateECBp( startECB : ECB, endECB : ECB, ecbp : ECB, pt : number ) : ECB {
  if (startECB[pt].x === ecbp[pt].x && startECB[pt].y === ecbp[pt].y) {
    return ecbp;
  }
  else {
    const mov = subtract( endECB[pt], startECB[pt] );
    const projectedVec = subtract( orthogonalProjection( endECB[pt], [startECB[pt], ecbp[pt]] ), startECB[pt] );
    const complement = subtract( mov, projectedVec );
    return moveECB(ecbp, complement);
  }
};


// ----------------------------------------------------------------------------------------------------------------------------------
// some more utility functions

// finds which is the relevant potential ECB point of contact with a wall, depending on their angles
function relevantECBPointFromWall(ecb : ECB, wallBottom : Vec2D, wallTop : Vec2D, wallType : string) : number {
  let sign = 1;
  let same = 3;
  if (wallType === "l") {
    same = 1;
    sign = -1;
  }

  const wallAngle      = lineAngle([wallBottom, wallTop   ]);
  const bottomECBAngle = lineAngle([ecb[0]    , ecb[same]]);
  const topECBAngle    = lineAngle([ecb[same] , ecb[2]   ]);
 
  if (sign * wallAngle < sign * topECBAngle) {
    return 2; // top point collision
  }
  else if (sign * wallAngle > sign * bottomECBAngle) {
    return 0; // bottom point
  }
  else {
    return same; // side point
  }

};


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
    return { location : null, factor : 1};
  }
  else {
    return { location : t, factor : Math.max(offset, closestCollision[1] - offset)}; // ECB angular parameter, sweeping parameter
  }
}

function reinflateECB ( ecb : ECB, position : Vec2D
                      , relevantSurfaces : Array<LabelledSurface>
                      , oldecbSquashDatum : SquashDatum
                      ) : [Vec2D, SquashDatum, ECB] {
  let q = 1;
  let angularParameter = null;
  if (oldecbSquashDatum.factor < 1) {
    q = 1 / oldecbSquashDatum.factor + additionalOffset/5;
    angularParameter = oldecbSquashDatum.location;
    const focus = ecbFocusFromAngularParameter(ecb, angularParameter);
    const fullsizeecb = [ new Vec2D ( q*ecb[0].x + (1-q)*focus.x , q*ecb[0].y + (1-q)*focus.y )
                        , new Vec2D ( q*ecb[1].x + (1-q)*focus.x , q*ecb[1].y + (1-q)*focus.y )
                        , new Vec2D ( q*ecb[2].x + (1-q)*focus.x , q*ecb[2].y + (1-q)*focus.y )
                        , new Vec2D ( q*ecb[3].x + (1-q)*focus.x , q*ecb[3].y + (1-q)*focus.y )
                        ];
    const ecbSquashData = inflateECB (fullsizeecb, angularParameter, relevantSurfaces);    
    const squashedecb = squashECBAt(fullsizeecb, ecbSquashData);
    const newPosition = new Vec2D( position.x + squashedecb[0].x - ecb[0].x
                                 , position.y );
    return [newPosition, ecbSquashData, squashedecb];

  }
  else {
    return [position, { location : null, factor : 1}, ecb];
  }
};


// ----------------------------------------------------------------------------------------------------------------------------------
// main collision routine

// this function initialises necessary data and then calls the main collision routine loop
export function runCollisionRoutine( ecb1 : ECB, ecbp : ECB, position : Vec2D
                                   , ecbSquashData : SquashDatum
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

  let relevantSurfaces = [];
  let relevantSurfacesMinusPlatforms = [];

  switch (horizIgnore) {
    case "platforms":
      relevantSurfacesMinusPlatforms = stageWalls.concat(stageGrounds).concat(stageCeilings);
      relevantSurfaces = relevantSurfacesMinusPlatforms;      
      break;
    case "none":
    default:
      relevantSurfacesMinusPlatforms = stageWalls.concat(stageGrounds).concat(stageCeilings);
      relevantSurfaces = relevantSurfacesMinusPlatforms.concat(stagePlatforms);
      break;
    case "all":
      relevantSurfaces = stageWalls;
      relevantSurfacesMinusPlatforms = relevantSurfaces;
      break;
  }

  const resolution = resolveECB( ecb1, ecbp, relevantSurfaces);
  const newTouching = resolution.touching;
  let newECBp = resolution.ecb;
  let newSquashData = resolution.squash;
  newSquashData.factor *= ecbSquashData.factor;
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

  if (newSquashData.factor < 1 ) {
    [ newPosition
    , newSquashData
    , newECBp ] = reinflateECB( newECBp, newPosition                       
                              , relevantSurfacesMinusPlatforms
                              , newSquashData
                              );
  } 

  return [ newPosition, collisionLabel, newSquashData, newECBp ];

};
