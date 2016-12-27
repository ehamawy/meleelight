// @flow
/*eslint indent:1*/ // get stuffed

import {Vec2D, getXOrYCoord, putXOrYCoord} from "../main/util/Vec2D";
import {Box2D} from "../main/util/Box2D";
import {dotProd, scalarProd, add, norm, orthogonalProjection} from "../main/linAlg";
import {findSmallestWithin} from "../main/util/findSmallestWithin";
import {solveQuadraticEquation} from "../main/util/solveQuadraticEquation";
import {lineAngle} from "../main/util/lineAngle";
import {extremePoint} from "../stages/util/extremePoint";
import {connectednessFromChains} from "../stages/util/connectednessFromChains";
import {moveECB, squashECBAt, ecbFocusFromAngularParameter} from "../main/util/ecbTransform";
import {zipLabels} from "../main/util/zipLabels";
import {getSurfaceFromStage} from "../stages/stage";
import {addToIgnoreList, isIgnored, cornerIsIgnored, cornerIsIgnoredInSurfaces} from "./ignoreList";
import {findWallFromCorner} from "../stages/util/findWallFromCorner";

// eslint-disable-next-line no-duplicate-imports
import type {ECB} from "../main/util/ecbTransform";
// eslint-disable-next-line no-duplicate-imports
import type {ConnectednessFunction} from "../stages/util/connectednessFromChains";
// eslint-disable-next-line no-duplicate-imports
import type {Stage, LabelledSurface} from "../stages/stage";
// eslint-disable-next-line no-duplicate-imports
import type {IgnoreList, IgnoreLists} from "./ignoreList";


const magicAngle : number = Math.PI/6;
const maximumCollisionDetectionPasses = 15;
export const additionalOffset : number = 0.00001;

const pushoutSigns : [null | string, null | string] = [null, null];

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


// clamps a number depending on surface type
function pushoutClamp( push : number, wallType : string ) {
  switch(wallType) {
    case "r":
    case "g":
    case "p":
    default:
      return (push < 0 ? 0 : push );
    case "l":
    case "c":
      return (push > 0 ? 0 : push );
  }
};


// ----------------------------------------------------------------------------------------------------------------------------------
// collision detection functions

// finds whether the ECB impacted a surface on one of its vertices
// if so, returns the sweeping parameter for that collision; otherwise returns null
function pointSweepingCheck ( ecb1 : ECB, ecbp : ECB, same : number
                            , wall : [Vec2D, Vec2D], wallType : string, wallIndex : number
                            , wallBottomOrLeft : Vec2D, wallTopOrRight : Vec2D
                            , stage : Stage, connectednessFunction : ConnectednessFunction
                            , xOrY : number) : null | number {

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
        return s ;
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


type EdgeSweepResult = [number, [Vec2D, number, number]]
//         [sweeping parameter, [corner position, same, other]]

// determines whether the ECB has moved across a corner, using the lineSweepParameters function
// returns null (for no collision) or collision data: ["x", pushout value, sweeping parameter, angular parameter]
function edgeSweepingCheck( ecb1 : ECB, ecbp : ECB, same : number, other : number
                          , counterclockwise : boolean
                          , maybeWallAndThenWallTypeAndIndex : null | [[Vec2D, Vec2D], [string, number]]
                          , corner : Vec2D, wallType : string
                          , stage : Stage, connectednessFunction : ConnectednessFunction ) : null | EdgeSweepResult {


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
      console.log("'edgeSweepingCheck': collision, relevant edge of ECB has moved across "+wallType+" corner. Sweeping parameter s="+s+".");
      return [s, [corner, same, other]];
    }

    else {
      console.log("'edgeSweepingCheck': no edge collision, relevant edge of ECB does not cross "+wallType+" corner.");
      return null;
    }
  }
  else {
    console.log("'edgeSweepingCheck': no edge collision, "+wallType+" corner did not switch relevant ECB edge sides.");
    return null;
  }
};



type CollisionDatum = null | [number, null | [Vec2D, number, number]];
// collision datum is one of:
//      - null                       (no collision)
//      - [s, null]                  (point collision) 
//      - [s, [corner, same, other]] (edge collision)
// s is the sweeping parameter, corner the position of the corner (for an edge collision), with the edge collision occurring on edge same-other

// ecbp : projected ECB
// ecb1 : old ECB
// this function finds the first collision that happens as the old ECB moves to the projected ECB
// the sweeping parameter s corresponds to the location of this first collision
// terminology in the comments: a wall is a segment with an inside and an outside,
// which is contained in an infinite line, extending both ways, which also has an inside and an outside
function findCollision ( ecb1 : ECB, ecbp : ECB
                       , wall : [Vec2D, Vec2D], wallType : string, wallIndex : number
                       , ignoringPushouts : string
                       , ignoreLists : IgnoreLists
                       , stage : Stage, connectednessFunction : ConnectednessFunction) : CollisionDatum {

// STANDING ASSUMPTIONS
// the ECB can only collide a ground/platform surface on its bottom point (or a bottom edge on a corner of the ground/platform)
// the ECB can only collide a ceiling surface on its top point (or a top edge on a corner)
// the ECB cannot collide a left wall on its left vertex
// the ECB cannot collide a right wall on its right vertex
// walls and corners push out horizontally, grounds/ceilings/platforms push out vertically
// the chains of connected surfaces go clockwise:
//    - left to right for grounds
//    - top to bottom for right walls
//    - right to left for ceilings
//    - bottom to top for left walls

  // first check whether we are in an ignored situation
  if (ignoringPushouts === "all") {
    return null;
  }
  else if (ignoringPushouts === "horiz" && (wallType === "l" || wallType === "r")) {
    return null;
  }
  // cannot immediately return null for horizontal surfaces when vertical pushouts are ignored, because of ECB edge colliding on corners of surfaces
  // this will be tackled later

  // start keeping track of additional ignored surfaces this round
  // ignore lists only get updated during pushout routines, so we can use const here
  const [surfaceIgnoreList, cornerIgnoreList] = ignoreLists;
  if (isIgnored ( [wallType, wallIndex], surfaceIgnoreList)) {
    return null;
  }

  // start defining useful constants/variables

  const wallTop    = extremePoint(wall, "t");
  const wallBottom = extremePoint(wall, "b");
  const wallLeft   = extremePoint(wall, "l");
  const wallRight  = extremePoint(wall, "r");

  // right wall by default
  let wallTopOrRight = wallTop;
  let wallBottomOrLeft = wallBottom;
  let extremeWall = wallRight;
  let extremeSign = 1;
  let same = 3;
  let opposite = 1;
  let xOrY = 1; // y by default
  let isPlatform = false;
  let flip = false;
  let sign = 1;

  let other = 0; // this will be calculated later, not in the following switch statement

  switch(wallType) {
    case "l": // left wall
      same = 1;
      opposite = 3;
      flip = true;
      sign = -1;
      extremeWall = wallLeft;
      extremeSign = -1;
      break;
    case "p": // platform
      isPlatform = true;
    case "g": // ground
    case "b":
    case "d":
      same = 0;
      opposite = 2;
      wallTopOrRight  = wallRight;
      wallBottomOrLeft = wallLeft;
      extremeWall = wallTop;
      xOrY = 0;
      flip = true;
      sign = -1;
      break;
    case "c": // ceiling
    case "t":
    case "u":
      same = 2;
      opposite = 0;
      wallTopOrRight  = wallRight;
      wallBottomOrLeft = wallLeft;
      extremeSign = -1;
      extremeWall = wallBottom;
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
    let corner : null | Vec2D = null;
    let otherCorner : null | Vec2D = null;

    let closestEdgeCollision = null;
    let edgeSweepResult = null;
    let otherEdgeSweepResult = null;

    const maybeWallAndThenWallTypeAndIndex = (wallType === "l" || wallType === "r") ? [wall, [wallType, wallIndex]] : null;

    // ignore all ECB edge collision checking if horizontal pushout is ignored
    // we already tackled this if ignoringPushouts === "all"
    if (ignoringPushouts !== "horiz") {

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

      if (corner !== null && !cornerIsIgnoredInSurfaces(corner, surfaceIgnoreList, stage)
                          && !cornerIsIgnored(corner, cornerIgnoreList)
         ) {
        // the relevant ECB edge, that might collide with the corner, is the edge between ECB points 'same' and 'other'
        let interiorECBside = "l";
        if (counterclockwise === false) {
          interiorECBside = "r";    
        }

        if (!isOutside (corner, ecbp[same], ecbp[other], interiorECBside) && isOutside (corner, ecb1[same], ecb1[other], interiorECBside) ) {
          edgeSweepResult = edgeSweepingCheck( ecb1, ecbp, same, other, counterclockwise
                                             , maybeWallAndThenWallTypeAndIndex, corner, wallType
                                             , stage, connectednessFunction);
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
             && !cornerIsIgnoredInSurfaces(otherCorner, surfaceIgnoreList, stage) 
             && !cornerIsIgnored(otherCorner, cornerIgnoreList)
           ) {
          otherEdgeSweepResult = edgeSweepingCheck( ecb1, ecbp, same, 2, otherCounterclockwise
                                                  , maybeWallAndThenWallTypeAndIndex, otherCorner, wallType
                                                  , stage, connectednessFunction);
        }
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
    else if ( otherEdgeSweepResult[0] > edgeSweepResult[0] ) {
      closestEdgeCollision = edgeSweepResult;
    }
    else {
      closestEdgeCollision = otherEdgeSweepResult;
    }
 

    // end of edge case checking
    // -------------------------------------------------------------------------------------------------------------------------------------------------------

    // -------------------------------------------------------------------------------------------------------------------------------------------------------
    // ECB vertex collision checking

    let closestPointCollision : null | number = null;

    // ignore point collision if told to
    // we already tackled this if ignoringPushouts is "all" or "vert",
    // so we just need to not run the vertex collision routine in the case that we are ignoring horizontal pushout, and the surface is horizontal
    if (ignoringPushouts !== "horiz" || wallType === "l" || wallType === "r" ) {

      // s = sweeping parameter
      closestPointCollision = pointSweepingCheck ( ecb1, ecbp, same
                                                 , wall, wallType, wallIndex
                                                 , wallBottomOrLeft, wallTopOrRight
                                                 , stage, connectednessFunction
                                                 , xOrY);
    }

    // end of ECB vertex collision checking
    // -------------------------------------------------------------------------------------------------------------------------------------------------------

    // -------------------------------------------------------------------------------------------------------------------------------------------------------
    // final gathering of collisions

    let finalCollision : null | [number, null | [Vec2D, number, number]];

    // if we have only one collision type (point/edge), take that one
    if (closestEdgeCollision === null ) {
      finalCollision = closestPointCollision === null ? null : [closestPointCollision, null];
    }
    else if (closestPointCollision === null) {
      finalCollision = closestEdgeCollision === null ? null : [closestEdgeCollision[0], closestEdgeCollision[1]];
    }
    // otherwise choose the collision with smallest sweeping parameter
    else if (closestEdgeCollision[0] > closestPointCollision) {
      finalCollision = [closestPointCollision, null];
    }
    else {
      finalCollision = [closestEdgeCollision[0], closestEdgeCollision[1]];
    }

    return finalCollision;

  }
};


// ----------------------------------------------------------------------------------------------------------------------------------
// some helper functions to return the closest collision (collision with smallest sweeping parameter)

// touching datum is null, or: wall type and index, sweeping parameter, and additional data about the collided object (surface/edge)
type TouchingDatum = null | [[string, number], number, { kind: "wall", value: [Vec2D, Vec2D]} | { kind: "corner", value : [Vec2D, number, number]}];

// this function finds the first (non-ignored) collision as the ECB1 moves to the ECBp
// return type: either null (no collision), or a new center, with a label according to which surface was collided (null if a corner)
function findClosestCollision( ecb1 : ECB, ecbp : ECB
                             , wallAndThenWallTypeAndIndexs : Array<LabelledSurface>
                             , ignoringPushouts : string
                             , ignoreLists : IgnoreLists
                             , stage : Stage, connectednessFunction : ConnectednessFunction ) : TouchingDatum {
  const touchingData : Array<TouchingDatum> = [null]; // initialise list of new collisions
  const collisionData = wallAndThenWallTypeAndIndexs.map( 
                                         // [ null | [number, null | [Vec2D, number, number], LabelledSurface];
          (wallAndThenWallTypeAndIndex)  => [ findCollision ( ecb1, ecbp
                                                            , wallAndThenWallTypeAndIndex[0]
                                                            , wallAndThenWallTypeAndIndex[1][0], wallAndThenWallTypeAndIndex[1][1]
                                                            , ignoringPushouts
                                                            , ignoreLists
                                                            , stage, connectednessFunction )
                                            , wallAndThenWallTypeAndIndex ]);

  for (let i = 0; i < collisionData.length; i++) {
    if (collisionData[i][0] !== null) {

      let collidedWith = { kind : "wall", value : collisionData[i][1][0]};
      if (collisionData[i][0][1] !== null ) {
        collidedWith = { kind : "corner", value: collisionData[i][0][1]};
      }

      touchingData.push( [collisionData[i][1][1], collisionData[i][0][0], collidedWith] );
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
      if (touchingData[j] !== null && touchingData[j][1] < newTouchingDatum[1]) {
        newTouchingDatum = touchingData[j];
      }
    }
    return newTouchingDatum;
  }
};


// ----------------------------------------------------------------------------------------------------------------------------------
// main pushout functions

function getCornerPushout( ecb1 : ECB, ecbp : ECB, wallType : string
                         , ignoreLists : IgnoreLists
                         , edgeSweepResult : EdgeSweepResult
                         , stage : Stage, connectednessFunction : ConnectednessFunction ) : [string, Vec2D, null | number, IgnoreLists] {
  const [s, [corner, same, other]] = edgeSweepResult;
  const [surfaceIgnoreList, cornerIgnoreList] = ignoreLists;



  let sign = 1;
  let cornerSide = 3;
  if (same === 1 || other === 1) {
    sign = -1;
    cornerSide = 1;
  }
  
  const xIntersect = coordinateIntercept( [ ecbp[same], ecbp[other] ], [ corner, new Vec2D( corner.x+1, corner.y ) ]).x;
  const pushout = corner.x - xIntersect;
  const clampedPushout = corner.x - ecbp[cornerSide].x;

  if (sign*pushout > sign*clampedPushout) { // corner can't push out fully on its own, might need to defer to relevant wall

    // find the wall to be considered for deferral
    const situation = (same === 0 || other === 0 ) ? "d" : "u";
    const maybeWallAndThenWallTypeAndIndex = findWallFromCorner(corner, situation, cornerSide, stage);

    if (    maybeWallAndThenWallTypeAndIndex === null 
         || (    maybeWallAndThenWallTypeAndIndex[1] !== "l" 
              && maybeWallAndThenWallTypeAndIndex[1] !== "r"
            )
        ) {
      // can't pass on to a relevant wall, directly push out
      return ( ["x"+wallType, new Vec2D(clampedPushout + sign*additionalOffset, 0), cornerSide, [surfaceIgnoreList, cornerIgnoreList.concat(corner)]] );
    }
    else {
      // defer to wall
      const horizPushout = getHorizPushout( ecb1, ecbp, same
                                          , maybeWallAndThenWallTypeAndIndex[0]
                                          , maybeWallAndThenWallTypeAndIndex[1][0]
                                          , maybeWallAndThenWallTypeAndIndex[1][1]
                                          , clampedPushout, clampedPushout 
                                          , situation
                                          , [surfaceIgnoreList, cornerIgnoreList.concat(corner)]
                                          , stage, connectednessFunction
                                          );
      const collisionType = horizPushout[1] === null ? ("x"+wallType) : wallType;
      return ( [ collisionType, horizPushout[0], horizPushout[1], horizPushout[2] ] );
    }

  }
  else {
    const angularParameter = getAngularParameter((corner.x-ecbp[same].x)/(ecbp[other].x-ecbp[same].x), same, other);
    return ( ["x"+wallType, new Vec2D(pushout + sign*additionalOffset, 0), angularParameter, [surfaceIgnoreList, cornerIgnoreList]] );
  }

};


// this function calculates the horizontal pushout when the ECB has crossed a wall
// if a wall can push back directly, it does so; otherwise a physics calculation is used to figure out how much pushing out the wall has done
// this function defers to adjacent walls, recursively, if necessary
// when a surface defers to an adjacent surface (or can't push out fully on its own), it becomes ignored for the rest of the frame
function getHorizPushout( ecb1 : ECB, ecbp : ECB, same : number
                        , wall : [Vec2D, Vec2D], wallType : string, wallIndex : number
                        , oldTotalPushout : number, previousPushout : number
                        , situation : string
                        , ignoreLists : IgnoreLists
                        , stage : Stage, connectednessFunction : ConnectednessFunction) : [Vec2D, null | number, IgnoreLists] {
  console.log("'getHorizPushout': working with "+wallType+""+wallIndex+".");
  console.log("'getHorizPushout': pushout total was "+oldTotalPushout+".");
  console.log("'getHorizPushout': previous pushout was "+previousPushout+".");

  let surfaceIgnoreList = ignoreLists[0];
  const cornerIgnoreList = ignoreLists[1];

  const wallRight  = extremePoint(wall, "r");
  const wallLeft   = extremePoint(wall, "l");
  const wallTop    = extremePoint(wall, "t");
  const wallBottom = extremePoint(wall, "b");

  const wallAngle      = lineAngle([wallBottom, wallTop   ]);
  const bottomECBAngle = lineAngle([ecbp[0]   , ecbp[same]]);
  const topECBAngle    = lineAngle([ecbp[same], ecbp[2]   ]);

  const pt = relevantECBPointFromWall(ecbp, wallBottom, wallTop, wallType);
  const additionalPushout = wallType === "r"? additionalOffset : -additionalOffset;

  let UDSign = 1;
  let wallForward  = wallTop;
  let wallBackward = wallBottom;
  let fPt = 2; // forward ECB point
  let bPt = 0; // backward ECB point
  if (situation === "d") {
    UDSign = -1;
    wallForward  = wallBottom;
    wallBackward = wallTop;
    fPt = 0;
    bPt = 2;
  }

  let dir = "l"; // clockwise to go up right walls or down left walls
  if ((situation === "d") !== (wallType === "l")) {
    dir = "r"; // counterclockwise to go down right walls or up left walls
  }

  // initialisations
  let intercept = null;
  let intercept2 = null;
  let pushout = 0;
  let cornerPushout = 0;
  let nextWallTypeAndIndex = null;
  let nextWall = null;
  let nextWallBottom = null;
  let nextWallTop = null;
  let nextWallForward = null;
  let nextWallBackward = null;
  let nextPt = same;
  let t = 0;
  let angularParameter = same;
  let totalPushout = oldTotalPushout;
  let output = [new Vec2D(0,0), null, [surfaceIgnoreList, cornerIgnoreList]];
  // end of initialisations

  // small utility function
  function ptv(pushout : number) : Vec2D {
    if (pushout === 0) {
      return new Vec2D(0,0);
    }
    else {
      return new Vec2D ( pushout + additionalPushout, 0);
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // start main pushout logic


  // case 1, ECB colliding at top vertex if going upwards, or at bottom vertex if going downwards
  if (pt === fPt) {
    if (UDSign * ecbp[pt].y <= UDSign * wallForward.y) {
      // directly push out and end immediately thereafter
      intercept = coordinateIntercept(wall, hLineThrough(ecbp[pt]));
      pushout = pushoutClamp(intercept.x - ecbp[pt].x, wallType);
      if (Math.abs(totalPushout) > Math.abs(pushout)) {
        console.log("'getHorizPushout': cur = fwd, ecb = fwd, directly pushing out with total.");
        output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
      }
      else {
        console.log("'getHorizPushout': cur = fwd, ecb = fwd, directly pushing out.");
        output = [ptv(pushout), pt, [surfaceIgnoreList, cornerIgnoreList]];
      }
    }
    else {
      nextWallTypeAndIndex = connectednessFunction( [wallType, wallIndex], dir);
      if (nextWallTypeAndIndex === null || nextWallTypeAndIndex[0] !== wallType) {
        // slide ECB along wall, at most so that ECB backwards point is at wallForward
        // if we stop short, put the ECBp there and end
        // otherwise, do the physics calculation to get pushout, and end
        if ( UDSign * ecbp[same].y <= UDSign * wallForward.y) {
          // stopped short (didn't even get to the same side ECB point, let alone the backwards point)
          // pushout at corner and end
          [pushout, t] = putEdgeOnCorner(ecbp[same], ecbp[pt], wallForward, wallType);
          pushout = pushoutClamp(pushout, wallType);
          if (Math.abs(totalPushout) > Math.abs(pushout)) {
            console.log("'getHorizPushout': cur = fwd, ecb = same, nxt = null, directly pushing out with total.");
            output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
          }
          else {
            angularParameter = getAngularParameter(t, same, pt);
            console.log("'getHorizPushout': cur = fwd, ecb = same, nxt = null, directly pushing out.");
            output = [ptv(pushout), angularParameter, [surfaceIgnoreList, cornerIgnoreList]];
          }
        }
        else if (UDSign * ecbp[bPt].y <= UDSign * wallForward.y) {
          // stopped short of ECB backwards point
          // pushout at corner or do physics, depending on greater pushout
          intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[same], ecbp[same]]);
          pushout = pushoutClamp(wallForward.x - intercept.x, wallType);
          [cornerPushout, t] = putEdgeOnCorner( ecbp[same], ecbp[bPt], wallForward, wallType);
          cornerPushout = pushoutClamp(cornerPushout, wallType);
          if (Math.abs(cornerPushout) > Math.abs(pushout)) {
            pushout = cornerPushout;
          }
          if (Math.abs(totalPushout) > Math.abs(pushout)) {
            console.log("'getHorizPushout': cur = fwd, ecb = bwd-same, nxt = null, directly pushing out with total.");
            output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
          }
          else {
            angularParameter = getAngularParameter(t, same, bPt);
            console.log("'getHorizPushout': cur = fwd, ecb = bwd-same, nxt = null, directly pushing out.");
            output = [ptv(pushout), angularParameter, [surfaceIgnoreList, cornerIgnoreList]];
          }
        }
        else {
          // didn't stop short, do the physics
          intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[bPt], ecbp[bPt]]);
          pushout = wallForward.x - intercept.x;
          totalPushout += pushoutClamp(pushout - previousPushout, wallType);
          console.log("'getHorizPushout': cur = fwd, ecb = bwd, nxt = null, doing physics and pushing out.");
          surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
          output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
        }
      }
      else {
        nextWall = getSurfaceFromStage(nextWallTypeAndIndex, stage);
        nextWallTop    = extremePoint(nextWall, "t");
        nextWallBottom = extremePoint(nextWall, "b");
        nextPt = relevantECBPointFromWall(ecbp, nextWallBottom, nextWallTop, wallType);
        if (nextPt === pt) {
          // slide ECB along wall, so that ECB point is at wallForward
          // then do the physics calculation to get pushout, and pass on to the next wall
          intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[bPt], ecbp[bPt]]);
          pushout = wallForward.x - intercept.x;
          totalPushout += pushoutClamp(pushout - previousPushout, wallType);
          console.log("'getHorizPushout': cur = fwd, ecb = fwd, nxt = fwd, doing physics and deferring.");
          surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
          output = getHorizPushout( ecb1, ecbp, same
                                  , nextWall, wallType, nextWallTypeAndIndex[1]
                                  , totalPushout, pushout
                                  , situation
                                  , [surfaceIgnoreList, cornerIgnoreList]
                                  , stage, connectednessFunction);
        }
        else if (nextPt === same) {
          // slide ECB along wall, at most so that ECB same point is at wallForward
          // if we stop short, put the ECBp there and end
          // otherwise, do the physics calculation to get pushout, and pass on to the next wall
          if ( UDSign * ecbp[same].y <= UDSign * wallForward.y) {
            // stopped short of ECB same-side point
            // pushout at corner and end
            [pushout, t] = putEdgeOnCorner(ecbp[same], ecbp[pt], wallForward, wallType);
            pushout = pushoutClamp(pushout, wallType);
            if (Math.abs(totalPushout) > Math.abs(pushout)) {
              console.log("'getHorizPushout': cur = fwd, ecb = same-fwd, nxt = same, directly pushing out with total.");
              output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
            }
            else {
              angularParameter = getAngularParameter(t, same, pt);
              console.log("'getHorizPushout': cur = fwd, ecb = same-fwd, nxt = same, directly pushing out.");
              output = [ptv(pushout), angularParameter, [surfaceIgnoreList, cornerIgnoreList]];
            }
          }
          else {
            // didn't stop short, do the physics
            intercept = coordinateIntercept( hLineThrough(wallForward), [ecb1[same], ecbp[same]]);
            pushout = wallForward.x - intercept.x;
            totalPushout += pushoutClamp(pushout - previousPushout, wallType);
            console.log("'getHorizPushout': cur = fwd, ecb = fwd, nxt = same, doing physics and deferring.");
            surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
            output = getHorizPushout( ecb1, ecbp, same
                                    , nextWall, wallType, nextWallTypeAndIndex[1]
                                    , totalPushout, pushout
                                    , situation
                                    , [surfaceIgnoreList, cornerIgnoreList]
                                    , stage, connectednessFunction);
          }
        }
        else { // nextPt === bPt
          // slide ECB along wall, at most so that ECB backwards point is at wallForward
          // if we stop short, put the ECBp there and end
          // otherwise, do the physics calculation to get pushout, and pass on to the next wall
          if ( UDSign * ecbp[same].y <= UDSign * wallForward.y) {
            // stopped short (didn't even get to the same side ECB point, let alone the backwards point)
            // pushout at corner and end
            [pushout, t] = putEdgeOnCorner(ecbp[same], ecbp[pt], wallForward, wallType);
            pushout = pushoutClamp(pushout, wallType);
            if (Math.abs(totalPushout) > Math.abs(pushout)) {
              console.log("'getHorizPushout': cur = fwd, ecb = same-fwd, nxt = bwd, directly pushing out with total.");
              output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
            }
            else {
              angularParameter = getAngularParameter(t, same, pt);
              console.log("'getHorizPushout': cur = fwd, ecb = same-fwd, nxt = bwd, directly pushing out.");
              output = [ptv(pushout), angularParameter, [surfaceIgnoreList, cornerIgnoreList]];
            }
          }
          else if (UDSign * ecbp[bPt].y <= UDSign * wallForward.y) {
            // stopped short of ECB backwards point
            // pushout at corner or do physics, depending on greater pushout
            intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[same], ecbp[same]]);
            pushout = pushoutClamp(wallForward.x - intercept.x, wallType);
            [cornerPushout, t] = putEdgeOnCorner( ecbp[same], ecbp[bPt], wallForward, wallType);
            cornerPushout = pushoutClamp(cornerPushout, wallType);
            if (Math.abs(cornerPushout) > Math.abs(pushout)) {
              pushout = cornerPushout;
            }
            if (Math.abs(totalPushout) > Math.abs(pushout)) {
              console.log("'getHorizPushout': cur = fwd, ecb = bwd-same, nxt = bwd, directly pushing out with total.");
              output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
            }
            else {
              angularParameter = getAngularParameter(t, same, pt);
              console.log("'getHorizPushout': cur = fwd, ecb = bwd-same, nxt = bwd, directly pushing out.");
              output = [ptv(pushout), angularParameter, [surfaceIgnoreList, cornerIgnoreList]];
            }
          }
          else {
            // didn't stop short, do the physics
            intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[bPt], ecbp[bPt]]);
            pushout = wallForward.x - intercept.x;
            totalPushout += pushoutClamp(pushout - previousPushout, wallType);
            console.log("'getHorizPushout': cur = fwd, ecb = bwd, nxt = bwd, doing physics and deferring.");
            surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
            output = getHorizPushout( ecb1, ecbp, same
                                    , nextWall, wallType, nextWallTypeAndIndex[1]
                                    , totalPushout, pushout
                                    , situation
                                    , [surfaceIgnoreList, cornerIgnoreList]
                                    , stage, connectednessFunction);
          }
        }
      }
    }
  }

  // case 2, ECB colliding at bottom vertex if going upwards, or at top vertex if going downwards
  else if (pt === bPt) {
    nextWallTypeAndIndex = connectednessFunction( [wallType, wallIndex], dir);
    if (nextWallTypeAndIndex === null || nextWallTypeAndIndex[0] !== wallType) {
      // slide ECB along wall, so that ECB backwards point is at wallForward
      // if we stop short, pushout directly and end
      // otherwise, do the physics and end
      if (UDSign * ecbp[pt].y <= UDSign * wallForward.y) {
        // stopped short, directly push out backwards ECB point
        intercept = coordinateIntercept(wall, hLineThrough(ecbp[pt]));
        pushout = pushoutClamp( intercept.x - ecbp[pt].x, wallType);
        if (Math.abs(totalPushout) > Math.abs(pushout)) {
          console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = null, directly pushing out with total.");
          output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
        }
        else {
          console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = null, directly pushing out.");
          output = [ptv(pushout), pt, [surfaceIgnoreList, cornerIgnoreList]];
        }
      }
      else {
        // didn't stop short, do the physics and end
        intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[bPt], ecbp[bPt]]);
        pushout = wallForward.x - intercept.x;
        totalPushout += pushoutClamp(pushout - previousPushout, wallType);
        console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = null, doing physics and pushing out.");
        surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
        output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
      }
    }
    else {
      nextWall = getSurfaceFromStage(nextWallTypeAndIndex, stage);
      nextWallTop    = extremePoint(nextWall, "t");
      nextWallBottom = extremePoint(nextWall, "b");
      if (situation === "u") {
        nextWallForward  = nextWallTop;
        nextWallBackward = nextWallBottom;
      }
      else {
        nextWallForward  = nextWallBottom;
        nextWallBackward = nextWallTop;
      }
      
      nextPt = relevantECBPointFromWall(ecbp, nextWallBottom, nextWallTop, wallType);
      if (nextPt === bPt) {
        // we can slide ECB all the way to have ECB backwards point at wallForward
        // if we stop short, pushout and end
        // otherwise, do the physics and pass on to the next wall
        if (UDSign * ecbp[pt].y <= UDSign * wallForward.y) {
          // stopped short, directly push out backwards ECB point
          intercept = coordinateIntercept(wall, hLineThrough(ecbp[pt]));
          pushout = pushoutClamp( intercept.x - ecbp[pt].x, wallType);
          if (Math.abs(totalPushout) > Math.abs(pushout)) {
            console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = bwd, directly pushing out with total.");
            output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
          }
          else {
            console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = bwd, directly pushing out.");
            output = [ptv(pushout), pt, [surfaceIgnoreList, cornerIgnoreList]];
          }
        }
        else {
          intercept = coordinateIntercept( hLineThrough(wallForward), [ecb1[bPt], ecbp[bPt]]);
          pushout = wallForward.x - intercept.x;
          totalPushout += pushoutClamp(pushout - previousPushout, wallType);
          console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = bwd, doing physics and deferring.");
          surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
          output = getHorizPushout( ecb1, ecbp, same
                                  , nextWall, wallType, nextWallTypeAndIndex[1]
                                  , totalPushout, pushout
                                  , situation
                                  , [surfaceIgnoreList, cornerIgnoreList]
                                  , stage, connectednessFunction);
        }
      }
      else if (nextPt === same) {
        // slide the ECB along wall, until the same side ECB point collides with next wall
        // if we stop short, pushout and end, otherwise run the physics and pass on to the next wall
        // use the line that is parallel to the wall, but shifted by the vector (ecbp[same]-ecbp[bPt]) to find this point of collision
        intercept = coordinateIntercept( [ new Vec2D (wallBottom.x + ecbp[same].x - ecbp[bPt].x, wallBottom.y + ecbp[same].y - ecbp[bPt].y)
                                         , new Vec2D (wallTop.x    + ecbp[same].x - ecbp[bPt].x, wallTop.y    + ecbp[same].y - ecbp[bPt].y)
                                         ], nextWall);
        if (    UDSign * intercept.y    >= UDSign * nextWallForward.y 
             || UDSign * intercept.y    <= UDSign * nextWallBackward.y
             || UDSign * ecbp[nextPt].y <= UDSign * nextWallBackward.y
             || UDSign * ecbp[nextPt].y <= UDSign * intercept.y
             || isOutside(ecbp[nextPt], nextWallTop, nextWallBottom, wallType)
           ) {
          if (UDSign * ecbp[pt].y <= UDSign * wallForward.y || UDSign * ecbp[nextPt].y <= UDSign * intercept.y) {
            // stopped short, directly push out backwards ECB point
            intercept2 = coordinateIntercept(wall, hLineThrough(ecbp[pt]));
            pushout = pushoutClamp( intercept2.x - ecbp[pt].x, wallType);
            if (Math.abs(totalPushout) > Math.abs(pushout)) {
              console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = same, directly pushing out with total.");
              output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
            }
            else {
              console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = same, directly pushing out.");
              output = [ptv(pushout), pt, [surfaceIgnoreList, cornerIgnoreList]];
            }
          }
          else {
            // can slide the backwards ECB point all the way to wallForward
            // warning: we are ignoring the possibility that the ECB can enter in contact at an edge on the corner nextWallForward
            // this will be caught by the edge sweeping routine, and not the point sweeping routine
            intercept2 = coordinateIntercept( hLineThrough(wallForward), [ecb1[bPt], ecbp[bPt]]);
            pushout = wallForward.x - intercept2.x;
            totalPushout += pushoutClamp(pushout - previousPushout, wallType);
            console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = same, doing physics and deferring.");
            surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
            output = getHorizPushout( ecb1, ecbp, same
                                    , nextWall, wallType, nextWallTypeAndIndex[1]
                                    , totalPushout, pushout
                                    , situation
                                    , [surfaceIgnoreList, cornerIgnoreList]
                                    , stage, connectednessFunction);
          }
        }
        else {
          // do the physics to find the pushout, with ECB same side point being in contact with next wall
          intercept2 = coordinateIntercept( hLineThrough(intercept), [ecb1[same], ecbp[same]]);
          pushout = intercept.x - intercept2.x;
          totalPushout += pushoutClamp(pushout - previousPushout, wallType);
          console.log("'getHorizPushout': cur = bwd, ecb = same, nxt = same, doing physics and deferring.");
          surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
          output = getHorizPushout( ecb1, ecbp, same
                                  , nextWall, wallType, nextWallTypeAndIndex[1]
                                  , totalPushout, pushout
                                  , situation
                                  , [surfaceIgnoreList, cornerIgnoreList]
                                  , stage, connectednessFunction);
        }

      }
      else { // nextPt === fPt
        // slide the ECB along wall, until the forward ECB point collides with next wall
        // if we stop short, pushout and end, otherwise run the physics and pass on to the next wall
        // use the line that is parallel to the wall, but shifted by the vector (ecbp[fPt] - ecbp[bPt]) to find this point of collision
        intercept = coordinateIntercept( [ new Vec2D (wallBottom.x + ecbp[fPt].x - ecbp[bPt].x, wallBottom.y + ecbp[fPt].y - ecbp[bPt].y)
                                         , new Vec2D (wallTop.x    + ecbp[fPt].x - ecbp[bPt].x, wallTop.y    + ecbp[fPt].y - ecbp[bPt].y)
                                         ], nextWall);
        if (    UDSign * intercept.y  >= UDSign * nextWallForward.y 
             || UDSign * intercept.y  <= UDSign * nextWallBackward.y
             || UDSign * ecbp[nextPt].y <= UDSign * nextWallBackward.y
             || UDSign * ecbp[nextPt].y <= UDSign * intercept.y
             || isOutside(ecbp[nextPt], nextWallTop, nextWallBottom, wallType)
           ) {
          if (UDSign * ecbp[pt].y <= UDSign * wallForward.y || UDSign * ecbp[nextPt].y <= UDSign * intercept.y) {
            // stopped short, directly push out backwards ECB point
            intercept2 = coordinateIntercept(wall, hLineThrough(ecbp[pt]));
            pushout = pushoutClamp( intercept2.x - ecbp[pt].x, wallType);
            if (Math.abs(totalPushout) > Math.abs(pushout)) {
              console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = fwd, directly pushing out with total.");
              output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
            }
            else {
              console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = fwd, directly pushing out");
              output = [ptv(pushout), pt, [surfaceIgnoreList, cornerIgnoreList]];
            }
          }
          else {
            // can slide the backwards ECB point all the way to wallForward
            // warning: we are ignoring the possibility that the ECB can enter in contact at an edge on the corner nextWallForward
            // this will be caught by the edge sweeping routine, and not the point sweeping routine
            intercept2 = coordinateIntercept( hLineThrough(wallForward), [ecb1[bPt], ecbp[bPt]]);
            pushout = wallForward.x - intercept2.x;
            totalPushout += pushoutClamp(pushout - previousPushout, wallType);
            console.log("'getHorizPushout': cur = bwd, ecb = bwd, nxt = fwd, doing physics and deferring.");
            surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
            output = getHorizPushout( ecb1, ecbp, same
                                    , nextWall, wallType, nextWallTypeAndIndex[1]
                                    , totalPushout, pushout
                                    , situation
                                    , [surfaceIgnoreList, cornerIgnoreList]
                                    , stage, connectednessFunction);
          }
        }
        else {
          // do the physics to find the pushout, with ECB forward point being in contact with next wall
          intercept2 = coordinateIntercept( hLineThrough(intercept), [ecb1[fPt], ecbp[fPt]]);
          pushout = intercept.x - intercept2.x;
          totalPushout += pushoutClamp(pushout - previousPushout, wallType);
          console.log("'getHorizPushout': cur = bwd, ecb = fwd, nxt = fwd, doing physics and deferring.");
          surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
          output = getHorizPushout( ecb1, ecbp, same
                                  , nextWall, wallType, nextWallTypeAndIndex[1]
                                  , totalPushout, pushout
                                  , situation
                                  , [surfaceIgnoreList, cornerIgnoreList]
                                  , stage, connectednessFunction);
        } 
      }
    }
  }

  // case 3, ECB colliding at same-side vertex (typical case for walls)
  else { // pt === same
    nextWallTypeAndIndex = connectednessFunction( [wallType, wallIndex], dir);
    if (nextWallTypeAndIndex === null || nextWallTypeAndIndex[0] !== wallType) {
      // slide ECB along wall, at most so that ECB backwards point is at wallForward
      // if we stop short, put the ECBp there and end
      // otherwise, do the physics calculation to get pushout, and end
      if (UDSign * ecbp[pt].y <= UDSign * wallForward.y) {
        // stopped short: can push out side ECB point directly, so do that
        intercept = coordinateIntercept( wall, hLineThrough(ecbp[same]));
        pushout = pushoutClamp(intercept.x - ecbp[same].x, wallType);
        if (Math.abs(totalPushout) > Math.abs(pushout)) {
          console.log("'getHorizPushout': cur = same, ecb = same, nxt = null, directly pushing out with total.");
          output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
        }
        else {
          console.log("'getHorizPushout': cur = same, ecb = same, nxt = null, directly pushing out.");
          output = [ptv(pushout), pt, [surfaceIgnoreList, cornerIgnoreList]];
        }
      }
      else if (UDSign * ecbp[bPt].y <= UDSign * wallForward.y) {
        // stopped short of ECB backwards point
        // pushout at corner or do physics, depending on greater pushout
        intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[same], ecbp[same]]);
        pushout = pushoutClamp(wallForward.x - intercept.x, wallType);
        [cornerPushout, t] = putEdgeOnCorner( ecbp[same], ecbp[bPt], wallForward, wallType);
        cornerPushout = pushoutClamp(cornerPushout, wallType);
        if (Math.abs(cornerPushout) > Math.abs(pushout)) {
          pushout = cornerPushout;
        }
        if (Math.abs(totalPushout) > Math.abs(pushout)) {
          console.log("'getHorizPushout': cur = same, ecb = bwd-same, nxt = null, directly pushing out with total.");
          output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
        }
        else {
          angularParameter = getAngularParameter(t, same, bPt);
          console.log("'getHorizPushout': cur = same, ecb = bwd-same, nxt = null, directly pushing out.");
          output = [ptv(pushout), angularParameter, [surfaceIgnoreList, cornerIgnoreList]];
        }
      }
      else {
        // didn't stop short, do the physics
        intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[bPt], ecbp[bPt]]);
        pushout = wallForward.x - intercept.x;
        totalPushout += pushoutClamp(pushout - previousPushout, wallType);
        console.log("'getHorizPushout': cur = same, ecb = bwd-same, nxt = null, doing physics and pushing out.");
        surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
        output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
      }
    }
    else {
      nextWall = getSurfaceFromStage(nextWallTypeAndIndex, stage);
      nextWallTop    = extremePoint(nextWall, "t");
      nextWallBottom = extremePoint(nextWall, "b");
      if (situation === "u") {
        nextWallForward  = nextWallTop;
        nextWallBackward = nextWallBottom;
      }
      else {
        nextWallForward  = nextWallBottom;
        nextWallBackward = nextWallTop;
      }
      nextPt = relevantECBPointFromWall(ecbp, nextWallBottom, nextWallTop, wallType);
      if (nextPt === fPt) {
        // slide ECB along wall, at most so that forward ECB point is in contact with next wall
        // use the line that is parallel to the wall, but shifted by the vector (ecbp[fPt]-ecbp[same]) to find where the ECB forward point enters in contact with next wall
        intercept = coordinateIntercept ( [ new Vec2D (wallBottom.x + ecbp[fPt].x - ecbp[same].x, wallBottom.y + ecbp[fPt].y - ecbp[same].y)
                                          , new Vec2D (wallTop.x    + ecbp[fPt].x - ecbp[same].x, wallTop.y    + ecbp[fPt].y - ecbp[same].y)
                                          ], nextWall);
        if (    UDSign * intercept.y  >= UDSign * nextWallForward.y 
             || UDSign * intercept.y  <= UDSign * nextWallBackward.y
             || UDSign * ecbp[nextPt].y <= UDSign * nextWallBackward.y
             || UDSign * ecbp[nextPt].y <= UDSign * intercept.y
             || isOutside(ecbp[nextPt], nextWallTop, nextWallBottom, wallType)
           ) {
          if (UDSign * ecbp[pt].y <= UDSign * wallForward.y || UDSign * ecbp[nextPt].y <= UDSign * intercept.y) {
            // stopped short: can push out side ECB point directly, so do that
            intercept2 = coordinateIntercept( wall, hLineThrough(ecbp[same]));
            pushout = pushoutClamp(intercept2.x - ecbp[same].x, wallType);
            if (Math.abs(totalPushout) > Math.abs(pushout)) {
              console.log("'getHorizPushout': cur = same, ecb = same, nxt = fwd, directly pushing out with total.");
              output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
            }
            else {
              console.log("'getHorizPushout': cur = same, ecb = same, nxt = fwd, directly pushing out.");
              output = [ptv(pushout), pt, [surfaceIgnoreList, cornerIgnoreList]];
            }
          }
          else {
            // can slide same side ECB point all the way to wallForward
            // warning: we are ignoring the possibility that the ECB can enter in contact at an edge on the corner nextWallForward
            // this will be caught by the edge sweeping routine, and not the point sweeping routine
            intercept2 = coordinateIntercept( hLineThrough(wallForward), [ecb1[same], ecbp[same]]);
            pushout = wallForward.x - intercept2.x;
            totalPushout += pushoutClamp(pushout - previousPushout, wallType);
            console.log("'getHorizPushout': cur = same, ecb = same, nxt = fwd, doing physics and deferring.");
            surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
            output = getHorizPushout( ecb1, ecbp, same
                                    , nextWall, wallType, nextWallTypeAndIndex[1]
                                    , totalPushout, pushout
                                    , situation
                                    , [surfaceIgnoreList, cornerIgnoreList]
                                    , stage, connectednessFunction);
          }
        }
        else {
          // do the physics to find the pushout, with ECB forward point being put in contact with next wall
          intercept2 = coordinateIntercept( hLineThrough(intercept), [ecb1[fPt], ecbp[fPt]]);
          pushout = intercept.x - intercept2.x;
          totalPushout += pushoutClamp(pushout - previousPushout, wallType);
          console.log("'getHorizPushout': cur = same, ecb = fwd, nxt = fwd, doing physics and deferring.");
          surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
          output = getHorizPushout( ecb1, ecbp, same
                                  , nextWall, wallType, nextWallTypeAndIndex[1]
                                  , totalPushout, pushout
                                  , situation
                                  , [surfaceIgnoreList, cornerIgnoreList]
                                  , stage, connectednessFunction);     
        }
      }
      else if (nextPt === same) {
        // slide ECB along wall, at most so that ECB same-side point is at wallForward
        // if we stop short, put the ECBp there and end
        // otherwise, do the physics calculation to get pushout, and pass on to the next wall
        if (UDSign * ecbp[pt].y <= UDSign * wallForward.y) {
          // stopped short: can push out side ECB point directly, so do that
          intercept = coordinateIntercept( wall, hLineThrough(ecbp[same]));
          pushout = pushoutClamp(intercept.x - ecbp[same].x, wallType);
          if (Math.abs(totalPushout) > Math.abs(pushout)) {
            console.log("'getHorizPushout': cur = same, ecb = same, nxt = same, directly pushing out with total.");
            output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
          }
          else {
            console.log("'getHorizPushout': cur = same, ecb = same, nxt = same, directly pushing out.");
            output = [ptv(pushout), pt, [surfaceIgnoreList, cornerIgnoreList]];
          }
        }
        else {
          // slide ECB point to wallForward, calculate offset, and pass on to the next wall
          intercept = coordinateIntercept ( hLineThrough(wallForward), [ecb1[same], ecbp[same]]);
          pushout = wallForward.x - intercept.x;
          totalPushout += pushoutClamp(pushout - previousPushout, wallType);
          console.log("'getHorizPushout': cur = same, ecb = same, nxt = same, doing physics and deferring.");
          surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
          output = getHorizPushout( ecb1, ecbp, same
                                  , nextWall, wallType, nextWallTypeAndIndex[1]
                                  , totalPushout, pushout
                                  , situation
                                  , [surfaceIgnoreList, cornerIgnoreList]
                                  , stage, connectednessFunction);
        }
      }
      else { // nextPt === bPt
        // slide ECB along wall, at most so that ECB backwards point is at wallForward
        // if we stop short, put the ECBp there and end
        // otherwise, do the physics calculation to get pushout, and pass on to the next wall
        if (UDSign * ecbp[pt].y <= UDSign * wallForward.y) {
          // stopped short: can push out same side ECB point directly, so do that
          intercept = coordinateIntercept( wall, hLineThrough(ecbp[same]));
          pushout = pushoutClamp(intercept.x - ecbp[same].x, wallType);
          if (Math.abs(totalPushout) > Math.abs(pushout)) {
            console.log("'getHorizPushout': cur = same, ecb = same, nxt = bwd, directly pushing out with total.");
            output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
          }
          else {
            console.log("'getHorizPushout': cur = same, ecb = same, nxt = bwd, directly pushing out.");
            output = [ptv(pushout), pt, [surfaceIgnoreList, cornerIgnoreList]];
          }
        }
        else if (UDSign * ecbp[bPt].y <= UDSign * wallForward.y) {
          // stopped short of ECB backwards point
          // pushout at corner or do physics, depending on greater pushout
          intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[same], ecbp[same]]);
          pushout = pushoutClamp(wallForward.x - intercept.x, wallType);
          [cornerPushout, t] = putEdgeOnCorner( ecbp[same], ecbp[bPt], wallForward, wallType);
          cornerPushout = pushoutClamp(cornerPushout, wallType);
          if (Math.abs(cornerPushout) > Math.abs(pushout)) {
            pushout = cornerPushout;
          }
          if (Math.abs(totalPushout) > Math.abs(pushout)) {
            console.log("'getHorizPushout': cur = same, ecb = bwd-same, nxt = bwd, directly pushing out with total.");
            output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
          }
          else {
            angularParameter = getAngularParameter(t, same, bPt);
            console.log("'getHorizPushout': cur = same, ecb = bwd-same, nxt = bwd, directly pushing out.");
            output = [ptv(pushout), angularParameter, [surfaceIgnoreList, cornerIgnoreList]];
          }
        }
        else {
          // didn't stop short, do the physics
          intercept = coordinateIntercept( hLineThrough( wallForward), [ecb1[bPt], ecbp[bPt]]);
          pushout = wallForward.x - intercept.x;
          totalPushout += pushoutClamp(pushout - previousPushout, wallType);
          console.log("'getHorizPushout': cur = same, ecb = bwd, nxt = bwd, doing physics and deferring.");
          surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
          output = getHorizPushout( ecb1, ecbp, same
                                  , nextWall, wallType, nextWallTypeAndIndex[1]
                                  , totalPushout, pushout
                                  , situation
                                  , [surfaceIgnoreList, cornerIgnoreList]
                                  , stage, connectednessFunction);
        }
      }
    }
  }

  return output;

};

function getCeilingPushout( ecb1Top : Vec2D, ecbpTop : Vec2D
                          , wall : [Vec2D, Vec2D], wallType : string, wallIndex : number
                          , oldTotalPushout : number, previousPushout : number
                          , ignoreLists : IgnoreLists
                          , stage : Stage, connectednessFunction : ConnectednessFunction) : [Vec2D, null | number, IgnoreLists] {
  console.log("'getCeilingPushout': working with "+wallType+""+wallIndex+".");
  console.log("'getCeilingPushout': pushout total was "+oldTotalPushout+".");
  console.log("'getCeilingPushout': previous pushout was "+previousPushout+".");

  let surfaceIgnoreList = ignoreLists[0];
  const cornerIgnoreList = ignoreLists[1];

  const wallRight  = extremePoint(wall, "r");
  const wallLeft   = extremePoint(wall, "l");
  const wallTop    = extremePoint(wall, "t");
  const wallBottom = extremePoint(wall, "b");

  const wallAngle  = lineAngle([wallBottom, wallTop]);

  const situation = (ecb1Top.x > ecbpTop.x) ? "l" : "r";

  let wallForward  = wallRight;
  let wallBackward = wallLeft;
  let LRSign = 1;
  let dir = "l"; // look clockwise in connected chains if going right
  if (situation === "l") {
    wallForward  = wallLeft;
    wallBackward = wallRight;
    LRSign = -1;
    dir = "r"; // look counterclockwise in connected chains if going left
  }

  // initialisations
  let intercept = null;
  let pushout = 0;
  let nextWallTypeAndIndex = null;
  let nextWall = null;
  let totalPushout = oldTotalPushout;
  let output = [new Vec2D(0,0), null, [surfaceIgnoreList, cornerIgnoreList]];
  // end of initialisations

  // small utility function
  function ptv(pushout : number) : Vec2D {
    if (pushout === 0) {
      return new Vec2D(0,0);
    }
    else {
      return new Vec2D ( 0, pushout - additionalOffset);
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // start main pushout logic

  // essentially, this function does the same thing as 'getHorizPushout', but with x and y flipped
  // moreover, significant simplifications result from only ever needing to consider the top ECB point
  // this means that no corner cases can crop up


  // first check if the ceiling can directly push out
  if (LRSign * ecbpTop.x <= LRSign * wallForward.x) {
    // stopped short: can push out side ECB point directly, so do that
    intercept = coordinateIntercept(wall, vLineThrough(ecbpTop));
    pushout = Math.min(0, intercept.y - ecbpTop.y);
    if (totalPushout < pushout) { // i.e. Math.abs(totalPushout) > Math.abs(pushout), as ceilings give negative y-value pushouts
      console.log("'getCeilingPushout': directly pushing out with total.");
      output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
    }
    else {
      console.log("'getCeilingPushout': directly pushing out.");
      output = [ptv(pushout), 2, [surfaceIgnoreList, cornerIgnoreList]];
    }
  }
  else {
    // current ceiling can't directly push out, defer to next ceiling if one exists
    nextWallTypeAndIndex = connectednessFunction( [wallType, wallIndex], dir);
    if (nextWallTypeAndIndex === null || nextWallTypeAndIndex[0] !== wallType) {
      // no other ceiling further along, do the physics and end
      intercept = coordinateIntercept( vLineThrough(wallForward), [ecb1Top, ecbpTop]);
      pushout = wallForward.y - intercept.y;
      totalPushout += Math.min(0, pushout - previousPushout);
      console.log("'getCeilingPushout': doing physics and pushing out.");
      surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
      output = [ptv(totalPushout), null, [surfaceIgnoreList, cornerIgnoreList]];
    }
    else {
      nextWall = getSurfaceFromStage(nextWallTypeAndIndex, stage);

      // do the physics to calculate pushout, and defer to next ceiling
      intercept = coordinateIntercept ( vLineThrough(wallForward), [ecb1Top, ecbpTop]);
      pushout = wallForward.y - intercept.y;
      totalPushout += Math.min(0, pushout - previousPushout);
      console.log("'getCeilingPushout': doing physics and deferring.");
      surfaceIgnoreList = addToIgnoreList(surfaceIgnoreList, [wallType, wallIndex]);
      output = getCeilingPushout( ecb1Top, ecbpTop
                               , nextWall, wallType, nextWallTypeAndIndex[1]
                               , totalPushout, pushout
                               , [surfaceIgnoreList, cornerIgnoreList]
                               , stage, connectednessFunction);
    }
  }

  return output;
};


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

// finds the pushout value to put a certain ECB edge onto a corner
// returns a pushout value, plus the angular parameter which records where the ECB will be touching after pushing out
function putEdgeOnCorner( point1 : Vec2D, point2 : Vec2D, corner : Vec2D, wallType : string) : [number, number] {
  const intercept = coordinateIntercept( [point1, point2], hLineThrough(corner));
  const pushout = pushoutClamp(corner.x - intercept.x, wallType);
  const parameter = (intercept.x - point1.x) / (point2.x - point1.x);
  return [pushout, parameter];
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


// ----------------------------------------------------------------------------------------------------------------------------------
// assembly of the various pushout routines


// recall: type TouchingDatum = null | [[string, number], number, { kind: "wall", value: [Vec2D, Vec2D]} | { kind: "corner", value : [Vec2D, number, number]}];
type PushoutDatum = null | [[string, number], Vec2D, null | number, IgnoreLists]
//                         [[wallType, wallIndex], newPosition, maybeAngularParameter, ignoreLists]

// this function invokes the various pushout functions to determine pushout
// note that it returns a 'newPosition' and not a 'pushout'
function getPushout ( ecb1 : ECB, ecbp : ECB
                    , position : Vec2D, prevPosition : Vec2D
                    , ignoringPushouts : string
                    , ignoreLists : IgnoreLists
                    , touchingDatum : TouchingDatum
                    , stage : Stage
                    , connectednessFunction : ConnectednessFunction ) : PushoutDatum {
  const [surfaceIgnoreList, cornerIgnoreList] = ignoreLists;
  if (touchingDatum === null) {
    return null;
  }
  else {
    const [wallType, wallIndex] = touchingDatum[0];
    if (touchingDatum[2].kind === "corner") { // edge collision
      const [corner, same, other] : [Vec2D, number, number] = touchingDatum[2].value;
      if (ignoringPushouts === "horiz" || ignoringPushouts === "all") {
        return null;
      }
      else {        
        const cornerPushoutResult = getCornerPushout( ecb1, ecbp, wallType
                                                    , ignoreLists
                                                    , [touchingDatum[1], [corner, same, other]]
                                                    , stage, connectednessFunction);
        return [ [cornerPushoutResult[0], wallIndex]
               , add(position, cornerPushoutResult[1])
               , cornerPushoutResult[2]
               , cornerPushoutResult[3]
               ];
      }
    }
    else if (wallType === "l" || wallType === "r") { // wall collision
      if (ignoringPushouts === "horiz" || ignoringPushouts === "all") {
        return null;
      }
      else {
        const same = wallType === "r" ? 3 : 1;
        const wall = touchingDatum[2].value;
        if(isIgnored( [wallType, wallIndex], surfaceIgnoreList)) {
          return null;
        }
        else {
          const situation = position.y < prevPosition.y ? "d" : "u";
          const horizPushoutResult = getHorizPushout( ecb1, ecbp, same
                                                    , wall, wallType, wallIndex
                                                    , 0, 0 // start off with no pushouts
                                                    , situation
                                                    , ignoreLists
                                                    , stage, connectednessFunction);
          return [ [horizPushoutResult[1] === null ? "n"+wallType : wallType, wallIndex]
                 , add(position, horizPushoutResult[0])
                 , horizPushoutResult[1]
                 , horizPushoutResult[2]
                 ];
        }
      }
    }
    else if (wallType === "c") { // ceiling collision
      if (ignoringPushouts === "vert" || ignoringPushouts === "all") {
        return null;
      }
      else {
        const wall = touchingDatum[2].value;
        if (isIgnored( [wallType, wallIndex], surfaceIgnoreList)) {
          return null;
        }
        else {
          const ceilPushoutResult = getCeilingPushout( ecb1[2], ecbp[2]
                                                     , wall, wallType, wallIndex
                                                     , 0, 0 // start off with no pushouts
                                                     , ignoreLists
                                                     , stage, connectednessFunction);

          return [ [ceilPushoutResult[1] === null ? "n"+wallType : wallType, wallIndex]
                 , add(position, ceilPushoutResult[0])
                 , ceilPushoutResult[1]
                 , ceilPushoutResult[2]
                 ];
        }
      }
    }
    else if (wallType === "g" || wallType === "p") {
      if (ignoringPushouts === "vert" || ignoringPushouts === "all") {
        return null;
      }
      else {
        // grounds never get added to ignore lists, so we don't need to check that
        const s = touchingDatum[1];
        return [ [wallType, wallIndex]
               , new Vec2D( position.x + (1-s)*ecb1[0].x + (s-1)*ecbp[0].x
                          , position.y + (1-s)*ecb1[0].y + (s-1)*ecbp[0].y + additionalOffset
                          )
               , 0 // angular parameter is 0: bottom ECB point
               , ignoreLists
               ];
      }
    }
    else {
      console.log("error in 'getPushout': unrecognised wallType "+wallType+".");
      return null;
    }
  }

};


// runs over all walls in the stage to find the closest collision
// then uses this first collision to get pushout
function getClosestCollisionAndPushout( ecb1 : ECB, ecbp : ECB
                                      , position : Vec2D, prevPosition : Vec2D
                                      , wallAndThenWallTypeAndIndexs : Array<LabelledSurface>
                                      , ignoringPushouts : string
                                      , ignoreLists : IgnoreLists
                                      , stage : Stage
                                      , connectednessFunction : ConnectednessFunction) : PushoutDatum {

  const touchingDatum = findClosestCollision( ecb1, ecbp
                                            , wallAndThenWallTypeAndIndexs
                                            , ignoringPushouts
                                            , ignoreLists
                                            , stage, connectednessFunction );
  return getPushout( ecb1, ecbp
                   , position, prevPosition
                   , ignoringPushouts
                   , ignoreLists
                   , touchingDatum
                   , stage
                   , connectednessFunction );
};


// this function loops over all walls/surfaces it is provided, calculating the collision offsets that each ask for,
// and at each iteration returning the smallest possible offset (i.e. collision with smallest sweeping parameter)
function collisionRoutine ( ecb1 : ECB, ecbp : ECB, position : Vec2D, prevPosition : Vec2D
                          , relevantHorizSurfaces : Array<LabelledSurface>
                          , relevantVertSurfaces : Array<LabelledSurface>
                          , relevantSurfacesMinusPlatforms : Array<LabelledSurface>
                          , ignoringPushouts : string
                          , ignoreLists : [IgnoreList, Array<Vec2D>]
                          , stage : Stage
                          , connectednessFunction : ConnectednessFunction
                          , oldTouchingData : null | [string, number, number | null] // surface type, surface index, angular parameter
                          , oldecbSquashData : null | [null | number, number]
                          , passNumber : number
                          ) : [ Vec2D // new position
                              , null | [string, number] // collision surface type and index
                              , null | [null | number, number] // ECB scaling data
                              , ECB // final ECBp to become next frame ECB1
                              ] {

  let touchingData = oldTouchingData;
  let ecbSquashData = oldecbSquashData;
  const oldSquashFactor = oldecbSquashData === null ? 1 : oldecbSquashData[1];
  const allRelevantSurfaces = relevantVertSurfaces.concat(relevantHorizSurfaces);
  let currentRelevantSurfaces = [];
  switch (ignoringPushouts) {
    case "no":
    default:
      currentRelevantSurfaces = allRelevantSurfaces;
      break;
    case "horiz": // ignoring horizontal pushout, so not ignoring horizontal surfaces
      currentRelevantSurfaces = relevantHorizSurfaces;
      break;
    case "vert": // ignoring vertical pushout, so not ignoring vertical surfaces
      currentRelevantSurfaces = relevantVertSurfaces;
      break;
    case "all": // ignoring all pushouts
      currentRelevantSurfaces = [];
      break;
  }
  let newIgnoringPushouts = ignoringPushouts;

  if (passNumber > maximumCollisionDetectionPasses || ignoringPushouts === "all") {
    // try to re-inflate the ECB, and end
    console.log("'collisionRoutine': ending collision routine prematurely after pass number "+passNumber+".");
    return reinflateECB( ecbp, position, touchingData
                       , relevantSurfacesMinusPlatforms
                       , ecbSquashData
                       , stage
                       , connectednessFunction
                       );
  }
  else {
    console.log("'collisionRoutine': pass number "+passNumber+".");
    // first, find the closest collision
    const closestCollision = getClosestCollisionAndPushout( ecb1, ecbp
                                                          , position, prevPosition
                                                          , currentRelevantSurfaces
                                                          , newIgnoringPushouts
                                                          , ignoreLists
                                                          , stage, connectednessFunction);
    if (closestCollision === null) {
      // if no collision occured, try to re-inflate the ECB, and end
      console.log("'collisionRoutine': no collision detected on this pass.");      
      return reinflateECB( ecbp, position, touchingData
                         , relevantSurfacesMinusPlatforms
                         , ecbSquashData
                         , stage
                         , connectednessFunction
                         );
    }
    else {
      const surfaceTypeAndIndex = closestCollision[0];
      let newPosition = closestCollision[1];
      const angularParameter = closestCollision[2];
      const newIgnoreLists = closestCollision[3];
      const vec = new Vec2D (newPosition.x - position.x, newPosition.y - position.y);
      const newecbp = moveECB (ecbp, vec); // this only gets used if there is no pushout conflict
      let squashedecbp = ecbp;

      // first, check for pushout conflicts
      if (    (pushoutSigns[0] === "+" && vec.x < 0)
           || (pushoutSigns[0] === "-" && vec.x > 0)
         ) { // horizontal pushout conflict

        console.log("'collisionRoutine': horizontal pushout conflict.");

        if (touchingData !== null) { // should be impossible for touchingData to be null at this point
          ecbSquashData = inflateECB (ecbp, touchingData[2], allRelevantSurfaces, stage, connectednessFunction);  
          if (ecbSquashData !== null) {
            ecbSquashData[1] *= oldSquashFactor;
            squashedecbp = squashECBAt(ecbp, ecbSquashData);
            newPosition = new Vec2D( newPosition.x + squashedecbp[0].x - ecbp[0].x
                                   , newPosition.y ); // + squashedecbp[0].y - ecbp[0].y);
          }
        }

        if (ignoringPushouts === "vert" || ignoringPushouts === "all") {
          newIgnoringPushouts = "all";
        }
        else {
          newIgnoringPushouts = "horiz";
        }

        // loop (now ignoring everything that pushes out horizontally, i.e. walls and corners)
        return collisionRoutine( ecb1, squashedecbp, newPosition, position
                               , relevantHorizSurfaces
                               , relevantVertSurfaces
                               , relevantSurfacesMinusPlatforms 
                               , newIgnoringPushouts
                               , newIgnoreLists
                               , stage, connectednessFunction
                               , touchingData, ecbSquashData, passNumber+1);
      }

      else if (    (pushoutSigns[1] === "+" && vec.y < 0)
                || (pushoutSigns[1] === "-" && vec.y > 0)
              ) { // vertical pushout conflict

        console.log("'collisionRoutine': vertical pushout conflict.");

        if (touchingData !== null) { // should be impossible for touchingData to be null at this point
          ecbSquashData = inflateECB (ecbp, touchingData[2], allRelevantSurfaces, stage, connectednessFunction);          
          if (ecbSquashData !== null) {
            ecbSquashData[1] *= oldSquashFactor;
            squashedecbp = squashECBAt(ecbp, ecbSquashData);
            newPosition = new Vec2D( newPosition.x + squashedecbp[0].x - ecbp[0].x
                                   , newPosition.y ); // + squashedecbp[0].y - ecbp[0].y);
          }
        }

        if (ignoringPushouts === "horiz" || ignoringPushouts === "all") {
          newIgnoringPushouts = "all";
        }
        else {
          newIgnoringPushouts = "vert";
        }

        // loop (now ignoring everything that pushes out vertically)
        return collisionRoutine( ecb1, squashedecbp, newPosition, position
                               , relevantHorizSurfaces
                               , relevantVertSurfaces
                               , relevantSurfacesMinusPlatforms 
                               , newIgnoringPushouts
                               , newIgnoreLists
                               , stage, connectednessFunction
                               , touchingData, ecbSquashData, passNumber+1);
      }


      // no pushout conflicts, update pushout signs if necessary
      else if (pushoutSigns[0] === null && vec.x !== 0) {
        pushoutSigns[0] = vec.x > 0 ? "+" : "-";
      }
      else if (pushoutSigns[1] === null && vec.y !== 0) {
        pushoutSigns[1] = vec.y > 0 ? "+" : "-";
      }

      // no conflicting pushouts, loop

      // update collision label data
      if (touchingData === null) {
        if (surfaceTypeAndIndex !== null) {
          touchingData = [surfaceTypeAndIndex[0], surfaceTypeAndIndex[1], angularParameter];
        }
      }
      // prioritise ground collisions when reporting the type of the last collision
      // warning: we are not using **position** information from just ground collisions, but from latest collision
      else if (    surfaceTypeAndIndex !== null 
                && ( surfaceTypeAndIndex[0] === "g" || surfaceTypeAndIndex[0] === "p" || (touchingData[0] !== "g" && touchingData[0] !== "p"))
              ) {
        touchingData = [surfaceTypeAndIndex[0], surfaceTypeAndIndex[1], angularParameter];
      }
      else if (touchingData[2] === null) {
        touchingData[2] = angularParameter; // might be useful for later computations to use this parameter
      }

      return collisionRoutine( ecb1, newecbp, newPosition, position // might want to keep this 4th argument as prevPosition and not update it to position?
                             , relevantHorizSurfaces
                             , relevantVertSurfaces
                             , relevantSurfacesMinusPlatforms 
                             , newIgnoringPushouts
                             , newIgnoreLists
                             , stage, connectednessFunction
                             , touchingData, ecbSquashData, passNumber+1);
    }
  }
};

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
                    , relevantSurfaces : Array<LabelledSurface>
                    , stage : Stage
                    , connectednessFunction : ConnectednessFunction) : null | [null | number, number] {
  const focus = ecbFocusFromAngularParameter(ecb, t);
  const offset = additionalOffset/10;
  const pointlikeECB : ECB = [ new Vec2D ( focus.x         , focus.y - offset ) 
                             , new Vec2D ( focus.x + offset, focus.y          )
                             , new Vec2D ( focus.x         , focus.y + offset )
                             , new Vec2D ( focus.x - offset, focus.y          )
                             ];

  const closestCollision = findClosestCollision( pointlikeECB, ecb
                                               , relevantSurfaces
                                               , "no" // don't ignore any pushouts for this calculation
                                               , [[],[]] // empty ignore lists
                                               , stage, connectednessFunction );
  if (closestCollision === null) { 
    return null;
  }
  else {
    return [t, Math.max(offset, closestCollision[1] - offset)]; // ECB angular parameter, sweeping parameter
  }
}

function reinflateECB ( ecb : ECB, position : Vec2D
                      , touchingData : null | [string, number, number | null]
                      , relevantSurfaces : Array<LabelledSurface>
                      , oldecbSquashData : null | [null | number, number]
                      , stage : Stage
                      , connectednessFunction : ConnectednessFunction
                      ) : [Vec2D, null | [string, number], null | [null | number, number], ECB] {

  let q = 1;
  let angularParameter = null;
  if (oldecbSquashData !== null) {
    q = 1 / oldecbSquashData[1] + additionalOffset/5;
    angularParameter = oldecbSquashData[0];
    const focus = ecbFocusFromAngularParameter(ecb, angularParameter);
    const fullsizeecb = [ new Vec2D ( q*ecb[0].x + (1-q)*focus.x , q*ecb[0].y + (1-q)*focus.y )
                        , new Vec2D ( q*ecb[1].x + (1-q)*focus.x , q*ecb[1].y + (1-q)*focus.y )
                        , new Vec2D ( q*ecb[2].x + (1-q)*focus.x , q*ecb[2].y + (1-q)*focus.y )
                        , new Vec2D ( q*ecb[3].x + (1-q)*focus.x , q*ecb[3].y + (1-q)*focus.y )
                        ];
    const ecbSquashData = inflateECB (fullsizeecb, angularParameter, relevantSurfaces, stage, connectednessFunction);
    if (ecbSquashData !== null) {
      const squashedecb = squashECBAt(fullsizeecb, ecbSquashData);
      const newPosition = new Vec2D( position.x + squashedecb[0].x - ecb[0].x
                                   , position.y ); // + squashedecb[0].y - ecb[0].y);
      return [newPosition, touchingData, ecbSquashData, squashedecb];
    }
    else {
      return [position, touchingData, null, ecb];  
    }
  }
  else {
    return [position, touchingData, null, ecb];
  }
};


// this function initialises necessary data and then calls the main collision routine loop
export function runCollisionRoutine( ecb1 : ECB, ecbp : ECB, position : Vec2D, prevPosition : Vec2D
                                   , ecbSquashData : null | [null | number, number]
                                   , horizIgnore : string
                                   , stage : Stage
                                   , connectednessFunction : ConnectednessFunction
                                   ) : [ Vec2D // new position
                                       , null | [string, number] // collision surface type and index
                                       , null | [null | number, number] // ECB scaling data
                                       , ECB // final ECB to become next frame ECB1
                                       ] {
  pushoutSigns[0] = null;
  pushoutSigns[1] = null;

  // --------------------------------------------------------------
  // BELOW: this is recomputed every frame and should be avoided
  
  const stageWalls = zipLabels(stage.wallL,"l").concat( zipLabels(stage.wallR,"r") );
  const stageGrounds = zipLabels(stage.ground,"g");
  const stageCeilings = zipLabels(stage.ceiling,"c");
  const stagePlatforms = zipLabels(stage.platform, "p");

  // ABOVE: this is recomputed every frame and should be avoided
  // --------------------------------------------------------------

  const relevantVertSurfaces = stageWalls;

  let relevantHorizSurfaces = [];
  let relevantSurfacesMinusPlatforms = relevantVertSurfaces;

  switch (horizIgnore) {
    case "all":
      // do nothing, relevantHorizSurfaces stays empty
      break;
    case "platforms":
      relevantHorizSurfaces = stageGrounds.concat(stageCeilings);
      relevantSurfacesMinusPlatforms = relevantSurfacesMinusPlatforms.concat(relevantHorizSurfaces);
      break;
    case "none":
    default:
      relevantHorizSurfaces = stageGrounds.concat(stageCeilings).concat(stagePlatforms);
      relevantSurfacesMinusPlatforms = relevantSurfacesMinusPlatforms.concat(stageGrounds).concat(stageCeilings);
      break;
  }


  return collisionRoutine( ecb1, ecbp, position, prevPosition
                         , relevantHorizSurfaces
                         , relevantVertSurfaces
                         , relevantSurfacesMinusPlatforms
                         , "no" // start off not ignoring any pushouts
                         , [[],[]] // start off with empty ignore lists
                         , stage, connectednessFunction
                         , null // start off not touching anything
                         , ecbSquashData
                         , 1 // start off at pass number 1
                         );
};
