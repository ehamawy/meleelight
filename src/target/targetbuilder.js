
import {player,ui, changeGamemode, setCookie, layers, clearScreen} from "main/main";
import {sounds} from "main/sfx";
import {handGrab, handOpen} from "menus/css";
import {twoPi} from "main/render";
import {startTargetGame} from "target/targetplay";
import {boxFill, drawBackground} from "stages/stagerender";
import {deepCopyObject} from "main/util/deepCopyObject";
import {Vec2D} from "../main/util/Vec2D";
import {Box2D} from "../main/util/Box2D";
import {setCustomTargetStages, customTargetStages} from "../stages/activeStage";
import {intersectsAny, distanceToPolygon, distanceToLine} from "../stages/util/detectIntersections";
/* eslint-disable */

export let drawConnectIndicator = false;
export let connectIndicatorPos = new Vec2D(0,0);
export let crossHairPos = new Vec2D(0,0);
export let prevCrossHairPos = new Vec2D(0,0);
export let prevRealCrossHair = new Vec2D(0,0);
export let unGriddedCrossHairPos = new Vec2D(0,0);
export let targetBuilder = 0;
export let targetTool = 0;
export let wallType = "ground";
export let wallTypeIndex = 0;
export let wallTypeList = ["ground","ceiling","wallL","wallR"];
export let showingCode = false;
export let toolInfoTimer = 0;
export let toolInfo = ["Polygon","Platform","Wall","Ledge","Target","Move","Delete"];
export let holdingA = false;
export let amDrawingPolygon = false;
export let drawingWall = [new Vec2D(0,0),new Vec2D(0,0)];
export let drawingPolygon = [];
export let drawingPlatform = [new Vec2D(0,0),new Vec2D(0,0)];
export let editingStage = -1;

export let badAngleTimer = 0;
export let badAnglePos = new Vec2D(0,0);
export let tooSmallTimer = 0;
export let tooSmallPos = new Vec2D(0,0);

export var stageTemp = {
  box : [],
  polygon : [],
  polygonMap : [],
  platform : [],
  ground : [],
  ceiling : [],
  wallL : [],
  wallR : [],
  target : [],
  startingPoint : new Vec2D(0,0),
  ledge : [],
  blastzone : new Box2D([-250,-250],[250,250]),
  scale : 3,
  offset : [600,375],
  draw : {
    polygon : [],
    box : [],
    platform : [],
    ground : [],
    ceiling : [],
    wallL : [],
    wallR : [],
    target : [],
    startingPoint : new Vec2D(600,375),
    ledge : []
  }
};
let grabbedItem = 0;
let hoverItem = 0;
let ledgeHoverItem = 0;
let builderPaused = false;
let builderPauseSelected = 0;
const undoList = [];
let hoverToolbar = 1;
const gridSizes = [80, 40, 20, 10, 0];
let gridType = 1;

export function createTargetCode (){
    let tCode = "";
    tCode += stageTemp.startingPoint.x+","+stageTemp.startingPoint.y+"~";
    for (let i=0;i<stageTemp.box.length;i++){
        tCode += stageTemp.box[i].min.x+","+stageTemp.box[i].min.y+","+stageTemp.box[i].max.x+","+stageTemp.box[i].max.y;
        if (i != stageTemp.box.length - 1){
            tCode += "#";
        }
    }
    tCode += "~";
    for (let i=0;i<stageTemp.platform.length;i++){
        tCode += stageTemp.platform[i][0].x+","+stageTemp.platform[i][1].x+","+stageTemp.platform[i][0].y;
        if (i != stageTemp.platform.length - 1){
            tCode += "#";
        }
    }
    tCode += "~";
    for (let i=0;i<stageTemp.ledge.length;i++){
        tCode += stageTemp.ledge[i][0]+","+stageTemp.ledge[i][1];
        if (i != stageTemp.ledge.length - 1){
            tCode += "#";
        }
    }
    tCode += "~";
    for (let i=0;i<stageTemp.target.length;i++){
        tCode += stageTemp.target[i].x+","+stageTemp.target[i].y;
        if (i != stageTemp.target.length - 1){
            tCode += "#";
        }
    }
    tCode += "~"+stageTemp.scale;
    return tCode;
}
export function undo (){
  let num = undoList.length-1;
  if (num >= 0){
    let item = undoList[num];
    stageTemp[item].pop();
    stageTemp.draw[item].pop();
    if (item == "box") {
      stageTemp.ground.pop();
      stageTemp.ceiling.pop();
      stageTemp.wallL.pop();
      stageTemp.wallR.pop();
      stageTemp.draw.ground.pop();
      stageTemp.draw.ceiling.pop();
      stageTemp.draw.wallL.pop();
      stageTemp.draw.wallR.pop();
    }
    undoList.pop();
  }
}

export function createStageCode (){
  let tCode = "s";
  tCode += stageTemp.startingPoint.x.toFixed(2)+","+stageTemp.startingPoint.y.toFixed(2)+"&b";
  for (let i=0;i<stageTemp.box.length;i++){
    tCode += stageTemp.box[i].min.x.toFixed(2)+","+stageTemp.box[i].min.y.toFixed(2)+","+stageTemp.box[i].max.x.toFixed(2)+","+stageTemp.box[i].max.y.toFixed(2);
    if (i != stageTemp.box.length - 1){
      tCode += ",";
    }
  }
  /*tCode += "&";
  for (let i=0;i<stageTemp.ground.length;i++){
    tCode += "[new Vec2D("+stageTemp.ground[i][0].x+","+stageTemp.ground[i][0].y+"),new Vec2D("+stageTemp.ground[i][1].x+","+stageTemp.ground[i][1].y+")]";
    if (i != stageTemp.ground.length - 1){
      tCode += ",";
    }
  }
  tCode += "],ceiling:[";
  for (let i=0;i<stageTemp.ceiling.length;i++){
    tCode += "[new Vec2D("+stageTemp.ceiling[i][0].x+","+stageTemp.ceiling[i][0].y+"),new Vec2D("+stageTemp.ceiling[i][1].x+","+stageTemp.ceiling[i][1].y+")]";
    if (i != stageTemp.ceiling.length - 1){
      tCode += ",";
    }
  }
  tCode += "],wallL:[";
  for (let i=0;i<stageTemp.wallL.length;i++){
    tCode += "[new Vec2D("+stageTemp.wallL[i][0].x+","+stageTemp.wallL[i][0].y+"),new Vec2D("+stageTemp.wallL[i][1].x+","+stageTemp.wallL[i][1].y+")]";
    if (i != stageTemp.wallL.length - 1){
      tCode += ",";
    }
  }
  tCode += "],wallR:[";
  for (let i=0;i<stageTemp.wallR.length;i++){
    tCode += "[new Vec2D("+stageTemp.wallR[i][0].x+","+stageTemp.wallR[i][0].y+"),new Vec2D("+stageTemp.wallR[i][1].x+","+stageTemp.wallR[i][1].y+")]";
    if (i != stageTemp.wallR.length - 1){
      tCode += ",";
    }
  }*/
  tCode += "&p";
  for (let i=0;i<stageTemp.platform.length;i++){
    tCode += stageTemp.platform[i][0].x.toFixed(2)+","+stageTemp.platform[i][0].y.toFixed(2)+","+stageTemp.platform[i][1].x.toFixed(2)+","+stageTemp.platform[i][1].y.toFixed(2);
    if (i != stageTemp.platform.length - 1){
      tCode += ",";
    }
  }
  tCode += "&l";
  for (let i=0;i<stageTemp.ledge.length;i++){
    tCode += stageTemp.ledge[i][0]+","+stageTemp.ledge[i][1];
    if (i != stageTemp.ledge.length - 1){
      tCode += ",";
    }
  }
  tCode += "&t";
  for (let i=0;i<stageTemp.target.length;i++){
    tCode += stageTemp.target[i].x.toFixed(2)+","+stageTemp.target[i].y.toFixed(2);
    if (i != stageTemp.target.length - 1){
      tCode += ",";
    }
  }
  //tCode += "],scale:"+stageTemp.scale+",blastzone:new Box2D([-250,-250],[250,250]),offset:[600,375]}";
  return tCode;
}

export function createStageObject (s){
  let tCode = "{startingPoint:new Vec2D(";
  tCode += targetStages[s].startingPoint.x.toFixed(1)+","+targetStages[s].startingPoint.y.toFixed(1)+"),box:[";
  for (let i=0;i<targetStages[s].box.length;i++){
    tCode += "new Box2D(["+targetStages[s].box[i].min.x.toFixed(1)+","+targetStages[s].box[i].min.y.toFixed(1)+"],["+targetStages[s].box[i].max.x.toFixed(1)+","+targetStages[s].box[i].max.y.toFixed(1)+"])";
    if (i != targetStages[s].box.length - 1){
      tCode += ",";
    }
  }
  tCode += "],ground:[";
  for (let i=0;i<targetStages[s].ground.length;i++){
    tCode += "[new Vec2D("+targetStages[s].ground[i][0].x.toFixed(1)+","+targetStages[s].ground[i][0].y.toFixed(1)+"),new Vec2D("+targetStages[s].ground[i][1].x.toFixed(1)+","+targetStages[s].ground[i][1].y.toFixed(1)+")]";
    if (i != targetStages[s].ground.length - 1){
      tCode += ",";
    }
  }
  tCode += "],ceiling:[";
  for (let i=0;i<targetStages[s].ceiling.length;i++){
    tCode += "[new Vec2D("+targetStages[s].ceiling[i][0].x.toFixed(1)+","+targetStages[s].ceiling[i][0].y.toFixed(1)+"),new Vec2D("+targetStages[s].ceiling[i][1].x.toFixed(1)+","+targetStages[s].ceiling[i][1].y.toFixed(1)+")]";
    if (i != targetStages[s].ceiling.length - 1){
      tCode += ",";
    }
  }
  tCode += "],wallL:[";
  for (let i=0;i<targetStages[s].wallL.length;i++){
    tCode += "[new Vec2D("+targetStages[s].wallL[i][0].x.toFixed(1)+","+targetStages[s].wallL[i][0].y.toFixed(1)+"),new Vec2D("+targetStages[s].wallL[i][1].x.toFixed(1)+","+targetStages[s].wallL[i][1].y.toFixed(1)+")]";
    if (i != targetStages[s].wallL.length - 1){
      tCode += ",";
    }
  }
  tCode += "],wallR:[";
  for (let i=0;i<targetStages[s].wallR.length;i++){
    tCode += "[new Vec2D("+targetStages[s].wallR[i][0].x.toFixed(1)+","+targetStages[s].wallR[i][0].y.toFixed(1)+"),new Vec2D("+targetStages[s].wallR[i][1].x.toFixed(1)+","+targetStages[s].wallR[i][1].y.toFixed(1)+")]";
    if (i != targetStages[s].wallR.length - 1){
      tCode += ",";
    }
  }
  tCode += "],platform:[";
  for (let i=0;i<targetStages[s].platform.length;i++){
    tCode += "[new Vec2D("+targetStages[s].platform[i][0].x.toFixed(1)+","+targetStages[s].platform[i][0].y.toFixed(1)+"),new Vec2D("+targetStages[s].platform[i][1].x.toFixed(1)+","+targetStages[s].platform[i][1].y.toFixed(1)+")]";
    if (i != targetStages[s].platform.length - 1){
      tCode += ",";
    }
  }
  tCode += "],ledge:[";
  for (let i=0;i<targetStages[s].ledge.length;i++){
    tCode += "["+targetStages[s].ledge[i][0].toFixed(1)+","+targetStages[s].ledge[i][1].toFixed(1)+"]";
    if (i != targetStages[s].ledge.length - 1){
      tCode += ",";
    }
  }
  tCode += "],target:[";
  for (let i=0;i<targetStages[s].target.length;i++){
    tCode += "new Vec2D("+targetStages[s].target[i].x.toFixed(1)+","+targetStages[s].target[i].y.toFixed(1)+")";
    if (i != targetStages[s].target.length - 1){
      tCode += ",";
    }
  }
  tCode += "],scale:" + targetStages[s].scale + ",blastzone:new Box2D([-250,-250],[250,250]),offset:[600,375]}";
  return tCode;
}

let currentPolygonLines = [];
let denied = false;

export function targetBuilderControls (p, input){
  drawConnectIndicator = false;
  if (!showingCode){
    if (!builderPaused){
      hoverItem = 0;
      ledgeHoverItem = 0;
      /*if (input[p].z[0] && !input[p].z[1]){
        // so i can create permanent stages
        let code = createStageCode();
        console.log(code);
      }*/
      //hoverButton = -1;
      let multi = (input[p][0].y || input[p][0].x)?1:5;
      unGriddedCrossHairPos.x += input[p][0].lsX*multi;
      unGriddedCrossHairPos.y += input[p][0].lsY*multi;
      if (gridType == 4){
        crossHairPos.x = unGriddedCrossHairPos.x;
        crossHairPos.y = unGriddedCrossHairPos.y;
      } else {
        if (unGriddedCrossHairPos.x == 0) {
          crossHairPos.x = (600 % gridSizes[gridType]) / 3;
        } else {
          crossHairPos.x = (Math.round(unGriddedCrossHairPos.x / (gridSizes[gridType] / 3)) * gridSizes[gridType] / 3) +
            (600 % gridSizes[gridType]) / 3;
        }
        if (unGriddedCrossHairPos.y == 0) {
          crossHairPos.y = (375 % gridSizes[gridType]) / 3;
        } else {
          crossHairPos.y = (Math.round(unGriddedCrossHairPos.y / (gridSizes[gridType] / -3)) * gridSizes[gridType] /
            -3) + (375 % gridSizes[gridType]) / 3;
        }
      }
      let realCrossHair = new Vec2D(crossHairPos.x*3+600,crossHairPos.y*-3+375)
      /*if (realCrossHair.x >= 700 && realCrossHair.x <= 1110 && realCrossHair.y >= 650 && realCrossHair.y <= 710){
        hoverButton = Math.floor((realCrossHair.x-695)/70);
      }*/
      if (crossHairPos.x > 200){
        crossHairPos.x = 200;
        realCrossHair.x = 1200;
      }
      if (crossHairPos.x < -200) {
        crossHairPos.x = -200;
        realCrossHair.x = 0;
      }
      if (crossHairPos.y > 125) {
        crossHairPos.y = 125;
        realCrossHair.y = 0;
      }
      if (crossHairPos.y < -125) {
        crossHairPos.y = -125;
        realCrossHair.y = 750;
      }
      if (realCrossHair.x > 670 && realCrossHair.y > 630) {
        hoverToolbar = 0.3;
      } else {
        hoverToolbar = 1;
      }
      if (input[p][0].z && !input[p][1].z) {
        gridType++;
        if (gridType > 4) {
          gridType = 0;
        }
      }
      if ((input[p][0].l && !input[p][1].l) || (input[p][0].dl && !input[p][1].dl)) {
        sounds.menuSelect.play();
        targetTool--;
        if (targetTool == -1) {
          targetTool = 6;
        }
        toolInfoTimer = 120;
      } else if ((input[p][0].r && !input[p][1].r) || (input[p][0].dr && !input[p][1].dr)) {
        sounds.menuSelect.play();
        targetTool++;
        if (targetTool == 7) {
          targetTool = 0;
        }
        toolInfoTimer = 120;
      } else if (targetTool === 2) {
        if (input[p][0].du && !input[p][1].du) {
          sounds.menuSelect.play();
          wallTypeIndex++;
          if (wallTypeIndex === 4) {
            wallTypeIndex = 0;
          }
          wallType = wallTypeList[wallTypeIndex];
          toolInfoTimer = 120;
        } else if (input[p][0].dd && !input[p][1].dd) {
          sounds.menuSelect.play();
          wallTypeIndex--;
          if (wallTypeIndex === -1) {
            wallTypeIndex = 3;
          }
          wallType = wallTypeList[wallTypeIndex];
          toolInfoTimer = 120;
        }
      }
      switch (targetTool) {
        case 0:
          //POLYGON
          if (input[p][0].a && !input[p][1].a && !input[p][0].z) {
            // initiate build
            if (!amDrawingPolygon) {
              if (stageTemp.polygon.length < 120) {
                currentPolygonLines = [];
                drawingPolygon = [new Vec2D(realCrossHair.x, realCrossHair.y), new Vec2D(realCrossHair.x, realCrossHair.y)];
                amDrawingPolygon = true;
                sounds.blunthit.play();
              } else {
                sounds.deny.play();
                break;
              }
            } else {
              //RELEASE
              const lg = drawingPolygon.length;
              const canClosePolygon = Math.abs(realCrossHair.x-drawingPolygon[0].x) < 2 && Math.abs(realCrossHair.y-drawingPolygon[0].y) < 2;
              if (lg > 3 && !denied) {
                currentPolygonLines.push([drawingPolygon[lg-4],drawingPolygon[lg-3]]);
              }
              const nextLine = [drawingPolygon[lg-2], new Vec2D(realCrossHair.x,realCrossHair.y)];
              const relevantPolygonLines = canClosePolygon? currentPolygonLines.slice(1) : currentPolygonLines;
              if (intersectsAny(nextLine, relevantPolygonLines) || (nextLine[0].x === nextLine[1].x && nextLine[0].y === nextLine[1].y)) {
                sounds.deny.play();
                denied = true;
              }
              else {
                drawingPolygon[lg-1] = new Vec2D(realCrossHair.x,realCrossHair.y);
                sounds.blunthit.play();
                denied = false;
                // if close enough to start of polygon
                if (canClosePolygon) {
                  amDrawingPolygon = false;
                  // if has enough sides, start building walls
                  if (drawingPolygon.length >= 3){
                    var topPoint = 0;
                    // find top point, also make polygon objects while we are looping
                    stageTemp.draw.polygon.push([]);
                    stageTemp.polygon.push([]);
                    stageTemp.polygonMap.push([]);
                    for (let i=0;i<drawingPolygon.length-1;i++){
                      if (drawingPolygon[i].y > drawingPolygon[topPoint].y) {
                        topPoint = i;
                      }
                      stageTemp.draw.polygon[stageTemp.draw.polygon.length-1][i] = new Vec2D(drawingPolygon[i].x,drawingPolygon[i].y);
                      stageTemp.polygon[stageTemp.polygon.length-1][i] = new Vec2D(drawingPolygon[i].x,drawingPolygon[i].y);
                    }
                    let direction = 1;
                    // find index direction of clockwise
                    // if point before top point is further right than the point after, change direction
                    if (drawingPolygon[(topPoint === 0) ? drawingPolygon.length-1 : (topPoint-1)].x > drawingPolygon[(topPoint === drawingPolygon.length-1) ? 0 : (topPoint+1)].x) {
                      direction = -1;
                    }
                    // loop through polygon and determine type
                    let curIndex = (direction === 1) ? 0 : drawingPolygon.length - 1;

                    for (let i=0;i<drawingPolygon.length-1;i++){
                      let nextIndex = curIndex + direction;
                      if (nextIndex === -1) {
                        nextIndex = drawingPolygon.length - 1;
                      } else if (nextIndex === drawingPolygon.length){
                        nextIndex = 0;
                      }

                      let drawLine = [new Vec2D(drawingPolygon[curIndex].x, drawingPolygon[curIndex].y), new Vec2D(drawingPolygon[nextIndex].x, drawingPolygon[nextIndex].y)];
                      let realLine = [new Vec2D((drawLine[0].x-600)/3, (drawLine[0].y-375)/-3),new Vec2D((drawLine[1].x-600)/3, (drawLine[1].y-375)/-3)];
                      let angle = Math.atan2(realLine[1].y - realLine[0].y , realLine[1].x - realLine[0].x);
                      if (Math.sign(angle) === -1) {
                        angle += twoPi;
                      }
                      
                      if (angle <= Math.PI/6 || angle >= Math.PI*11/6) {
                        // is ceiling
                        stageTemp.draw.ceiling.push([new Vec2D(drawLine[0].x, drawLine[0].y), new Vec2D(drawLine[1].x, drawLine[1].y)]);
                        stageTemp.ceiling.push([new Vec2D(realLine[0].x, realLine[0].y), new Vec2D(realLine[1].x, realLine[1].y)]);
                        stageTemp.polygonMap[stageTemp.polygonMap.length-1].push(["ceiling",stageTemp.ceiling.length-1]);
                      } else if (angle >= Math.PI*5/6 && angle <= Math.PI*7/6) {
                        // is ground
                        stageTemp.draw.ground.push([new Vec2D(drawLine[0].x, drawLine[0].y), new Vec2D(drawLine[1].x, drawLine[1].y)]);
                        stageTemp.ground.push([new Vec2D(realLine[0].x, realLine[0].y), new Vec2D(realLine[1].x, realLine[1].y)]);
                        stageTemp.polygonMap[stageTemp.polygonMap.length-1].push(["ground",stageTemp.ground.length-1]);
  
                      } else if (angle > Math.PI) {
                        // is wallL
                        stageTemp.draw.wallL.push([new Vec2D(drawLine[0].x, drawLine[0].y), new Vec2D(drawLine[1].x, drawLine[1].y)]);
                        stageTemp.wallL.push([new Vec2D(realLine[0].x, realLine[0].y), new Vec2D(realLine[1].x, realLine[1].y)]);
                        stageTemp.polygonMap[stageTemp.polygonMap.length-1].push(["wallL",stageTemp.wallL.length-1]);
                      } else {
                        // is wallR
                        stageTemp.draw.wallR.push([new Vec2D(drawLine[0].x, drawLine[0].y), new Vec2D(drawLine[1].x, drawLine[1].y)]);
                        stageTemp.wallR.push([new Vec2D(realLine[0].x, realLine[0].y), new Vec2D(realLine[1].x, realLine[1].y)]);
                        stageTemp.polygonMap[stageTemp.polygonMap.length-1].push(["wallR",stageTemp.wallR.length-1]);
                      }
  
                      curIndex = nextIndex;
                    }
                    drawingPolygon = [];
                    console.log(stageTemp);
                    //undoList.push("box");
                  } else {
                    tooSmallTimer = 60;
                    tooSmallPos = new Vec2D(realCrossHair.x, realCrossHair.y);
                  }
                } else {
                  // continue drawing more points
                  drawingPolygon.push(new Vec2D(realCrossHair.x, realCrossHair.y));
                }
              }
            }
          } else {
            if (amDrawingPolygon){
              drawingPolygon[drawingPolygon.length-1] = new Vec2D(realCrossHair.x, realCrossHair.y);
              const canClosePolygon = Math.abs(realCrossHair.x-drawingPolygon[0].x) < 2 && Math.abs(realCrossHair.y-drawingPolygon[0].y) < 2;
              if (canClosePolygon && drawingPolygon.length >= 3) {
                drawConnectIndicator = true;
                connectIndicatorPos = new Vec2D(drawingPolygon[0].x,drawingPolygon[0].y);
              }
            }
          }
          break;
        case 1:
          //PLATFORM
          if (!holdingA) {
            if (input[p][0].a && !input[p][1].a && !input[p][0].z) {
              // initiate build
              if (stageTemp.platform.length < 120) {
                drawingPlatform[0] = new Vec2D(realCrossHair.x, realCrossHair.y);
                drawingPlatform[1] = new Vec2D(realCrossHair.x, realCrossHair.y);
                holdingA = true;
              } else {
                sounds.deny.play();
              }
            }
          } else {
            if (input[p][0].a) {
              // stretch
              drawingPlatform[1] = new Vec2D(realCrossHair.x, realCrossHair.y);
            } else {
              //RELEASE
              drawingPlatform[1] = new Vec2D(realCrossHair.x, realCrossHair.y);
              if (Math.abs(drawingPlatform[0].x - drawingPlatform[1].x) >= 10) {
                let left = (drawingPlatform[0].x - drawingPlatform[1].x < 0) ? 0 : 1;
                let right = 1 - left;
                let convertedLeft = new Vec2D((drawingPlatform[left].x - 600) / 3 , (drawingPlatform[left].y - 375) / -3);
                let convertedRight = new Vec2D((drawingPlatform[right].x - 600) / 3 , (drawingPlatform[right].y - 375) / -3);
                let angle = Math.atan2(convertedRight.y - convertedLeft.y, convertedRight.x - convertedLeft.x);
                if (Math.abs(angle) <= Math.PI/6) {
                  stageTemp.draw.platform.push([new Vec2D(drawingPlatform[left].x, drawingPlatform[left].y), new Vec2D(drawingPlatform[right].x, drawingPlatform[right].y)]);
                  stageTemp.platform.push([new Vec2D(convertedLeft.x, convertedLeft.y), new Vec2D(convertedRight.x, convertedRight.y)]);
                  if (stageTemp.platform[stageTemp.platform.length - 1][0].x > stageTemp.platform[stageTemp.platform.length -
                      1][1].x) {
                    console.log("wtf")
                  }
                } else {
                  badAngleTimer = 60;
                  badAnglePos = new Vec2D(realCrossHair.x, realCrossHair.y);
                }
                //undoList.push("platform");
              } else {
                tooSmallTimer = 60;
                tooSmallPos = new Vec2D(realCrossHair.x, realCrossHair.y);
              }
              holdingA = false;
              sounds.blunthit.play();
            }
          }
          break;
        case 2:
          // WALL
          if (!holdingA) {
            if (input[p][0].a && !input[p][1].a && !input[p][0].z) {
              // initiate build
              if (stageTemp.platform.length < 120) {
                drawingWall[0] = new Vec2D(realCrossHair.x, realCrossHair.y);
                drawingWall[1] = new Vec2D(realCrossHair.x, realCrossHair.y);
                holdingA = true;
              } else {
                sounds.deny.play();
              }
            }
          } else {
            if (input[p][0].a) {
              // stretch
              drawingWall[1] = new Vec2D(realCrossHair.x, realCrossHair.y);
            } else {
              //RELEASE
              drawingWall[1] = new Vec2D(realCrossHair.x, realCrossHair.y);
              // if magnitude is less than 10, say too small
              if (Math.pow(drawingWall[0].x - drawingWall[1].x,2) + Math.pow(drawingWall[0].y - drawingWall[1].y,2) >= 100) {
                let left = (drawingWall[0].x - drawingWall[1].x < 0) ? 0 : 1;
                let right = 1 - left;
                let convertedLeft = new Vec2D((drawingWall[left].x - 600) / 3 , (drawingWall[left].y - 375) / -3);
                let convertedRight = new Vec2D((drawingWall[right].x - 600) / 3 , (drawingWall[right].y - 375) / -3);
                let angle = Math.atan2(convertedRight.y - convertedLeft.y, convertedRight.x - convertedLeft.x);
                if (((wallType === "ground" || wallType === "ceiling") && Math.abs(angle) <= Math.PI/6) || ((wallType === "wallL" || wallType === "wallR") && Math.abs(angle) != 0 && Math.abs(angle) != Math.PI)) {
                  stageTemp.draw[wallType].push([new Vec2D(drawingWall[left].x, drawingWall[left].y), new Vec2D(drawingWall[right].x, drawingWall[right].y)]);
                  stageTemp[wallType].push([new Vec2D(convertedLeft.x, convertedLeft.y), new Vec2D(convertedRight.x, convertedRight.y)]);
                  if (stageTemp[wallType][stageTemp[wallType].length - 1][0].x > stageTemp[wallType][stageTemp[wallType].length -
                      1][1].x) {
                    console.log("wtf")
                  }
                } else {
                  badAngleTimer = 60;
                  badAnglePos = new Vec2D(realCrossHair.x, realCrossHair.y);
                }
                //undoList.push("platform");
              } else {
                tooSmallTimer = 60;
                tooSmallPos = new Vec2D(realCrossHair.x, realCrossHair.y);
              }
              holdingA = false;
              sounds.blunthit.play();
            }
          }
          break;
        case 3:
          //LEDGE
          ledgeHoverItem = 0;
          for (let i=0;i<stageTemp.box.length;i++){
            if (realCrossHair.x >= stageTemp.draw.box[i].min.x-5 && realCrossHair.x <= stageTemp.draw.box[i].max.x+5 && realCrossHair.y >= stageTemp.draw.box[i].max.y-5 && realCrossHair.y <= stageTemp.draw.box[i].min.y+5){
              ledgeHoverItem = ["box",i];
              break;
            }
          }
          if (ledgeHoverItem != 0) {
            let i = ledgeHoverItem[1];
            if (Math.abs(realCrossHair.x - stageTemp.draw.box[i].min.x) < Math.abs(realCrossHair.x - stageTemp.draw.box[
                i].max.x)) {
              ledgeHoverItem.push(0);
            } else {
              ledgeHoverItem.push(1);
            }
            if (input[p][0].a && !input[p][1].a && !input[p][0].z){
              let alreadyExist = false;
              for (let j=0;j<stageTemp.ledge.length;j++){
                if (stageTemp.ledge[j][0] == ledgeHoverItem[1] && stageTemp.ledge[j][1] == ledgeHoverItem[2]){
                  stageTemp.ledge.splice(j,1);
                  alreadyExist = true;
                  break;
                }
              }
              if (!alreadyExist) {
                stageTemp.ledge.push([ledgeHoverItem[1], ledgeHoverItem[2]]);
                undoList.push("ledge");
              }
              sounds.blunthit.play();
            }
          }
          break;
        case 4:
          //TARGET
          if (input[p][0].a && !input[p][1].a && !input[p][0].z) {
            if (stageTemp.target.length < 20) {
              stageTemp.draw.target.push(new Vec2D(realCrossHair.x, realCrossHair.y));
              stageTemp.target.push(new Vec2D(crossHairPos.x, crossHairPos.y));
              undoList.push("target");
              sounds.blunthit.play();
            } else {
              sounds.deny.play();
            }
          }
          break;
        case 5:
          //MOVE
          if (grabbedItem == 0) {
            if (Math.abs(realCrossHair.x - stageTemp.draw.startingPoint.x) <= 30 && Math.abs(realCrossHair.y -
                stageTemp.draw.startingPoint.y) <= 30) {
              hoverItem = ["startingPoint", 0];
            } else {
              if (!findTarget(realCrossHair)) {
                if (!findPolygon(realCrossHair)) {
                  if (!findLine(realCrossHair)) {
                    hoverItem = 0;
                  }
                }
              }
            }
          } else {
            hoverItem = grabbedItem;
          }
          if (hoverItem != 0) {
            if (!holdingA) {
              if (input[p][0].a && !input[p][1].a && !input[p][0].z) {
                // initiate build
                centerItem(hoverItem, realCrossHair);
                grabbedItem = hoverItem;
                holdingA = true;
              }
            } else {
              if (input[p][0].a) {
                //MOVING
                centerItem(hoverItem, realCrossHair);
              } else {
                //RELEASE
                centerItem(hoverItem, realCrossHair);
                holdingA = false;
                grabbedItem = 0;
                sounds.blunthit.play();
              }
            }
          }

          break;
        case 6:
          //DELETE
          if (Math.abs(realCrossHair.x - stageTemp.draw.startingPoint.x) <= 30 && Math.abs(realCrossHair.y -
              stageTemp.draw.startingPoint.y) <= 30) {
            hoverItem = ["startingPoint", 0];
          } else {
            if (!findTarget(realCrossHair)) {
              if (!findPolygon(realCrossHair)) {
                if (!findLine(realCrossHair)) {
                  hoverItem = 0;
                }
              }
            }
          }
          if (hoverItem != 0) {
            if (input[p][0].a && !input[p][1].a && !input[p][0].z) {
              switch (hoverItem[0]) {
                case "startingPoint":
                  sounds.deny.play();
                  break;
                case "platform":
                case "target":
                  stageTemp.draw[hoverItem[0]].splice(hoverItem[1], 1);
                  stageTemp[hoverItem[0]].splice(hoverItem[1], 1);
                  sounds.menuBack.play();
                  break;
                case "ground":
                case "ceiling":
                case "wallL":
                case "wallR":
                  stageTemp.draw[hoverItem[0]].splice(hoverItem[1], 1);
                  stageTemp[hoverItem[0]].splice(hoverItem[1], 1);
                  for (let p=0;p<stageTemp.polygonMap.length;p++){
                    for (let k=0;k<stageTemp.polygonMap[p].length;k++){
                      if (stageTemp.polygonMap[p][k][0] === hoverItem[0] && stageTemp.polygonMap[p][k][1] > hoverItem[1]){
                        stageTemp.polygonMap[p][k][1]--;
                      }
                    }
                  }
                  sounds.menuBack.play();
                  break;
                case "polygon":
                  /*let ledgeDeleteQueue = [];
                  for (let j=0;j<stageTemp.ledge.length;j++){
                    if (stageTemp.ledge[j][0] == hoverItem[1]){
                      ledgeDeleteQueue.push(j);
                    }
                  }
                  for (let k=0;k<ledgeDeleteQueue.length;k++){
                    stageTemp.ledge.splice(ledgeDeleteQueue[k]-k,1);
                  }
                  for (let n=0;n<stageTemp.ledge.length;n++){
                    if (stageTemp.ledge[n][0] > hoverItem[1]){
                      stageTemp.ledge[n][0]--;
                    }
                  }*/

                  for (let j=0;j<stageTemp.polygonMap[hoverItem[1]].length;j++){
                    let type = stageTemp.polygonMap[hoverItem[1]][j][0];
                    let index = stageTemp.polygonMap[hoverItem[1]][j][1];
                    stageTemp.draw[type].splice(index, 1);
                    stageTemp[type].splice(index, 1);
                    for (let p=0;p<stageTemp.polygonMap.length;p++){
                      for (let k=0;k<stageTemp.polygonMap[p].length;k++){
                        if (stageTemp.polygonMap[p][k][0] === type && stageTemp.polygonMap[p][k][1] > index){
                          stageTemp.polygonMap[p][k][1]--;
                        }
                      }
                    }
                  }
                  stageTemp.polygon.splice(hoverItem[1], 1);
                  stageTemp.draw.polygon.splice(hoverItem[1], 1);
                  stageTemp.polygonMap.splice(hoverItem[1], 1);
                  sounds.menuBack.play();
                  break;
                default:
                  break;
              }
              hoverItem = 0;
            }
          }
          break;
        default:
          break;
      }
      if (input[p][0].s && !input[p][1].s) {
        builderPaused = true;
        sounds.pause.play();
      }
      prevRealCrossHair = new Vec2D(realCrossHair.x,realCrossHair.y);
      prevCrossHairPos = new Vec2D(crossHairPos.x,crossHairPos.y);
    } else {
      if (input[p][0].lsY >= 0.7 && input[p][1].lsY < 0.7) {
        builderPauseSelected--;
        if (builderPauseSelected < 0) {
          builderPauseSelected = 2;
        }
        sounds.menuSelect.play();
      } else if (input[p][0].lsY <= -0.7 && input[p][1].lsY > -0.7) {
        builderPauseSelected++;
        if (builderPauseSelected > 2) {
          builderPauseSelected = 0;
        }
        sounds.menuSelect.play();
      }
      if (input[p][0].a && !input[p][1].a) {
        switch (builderPauseSelected) {
          case 0:
            sounds.menuForward.play();
            startTargetGame(targetBuilder, true);
            break;
          case 1:
            sounds.menuForward.play();
            showingCode = true;
            let code = createStageCode();
            $("#customStageContainer").show();
            $("#cStageEdit").select().val(code);
            $("#cStageTitleEdit").empty().append("Share this code");

            // deep copy temp stage into custom stage array
            if (editingStage > -1){
              setCookie("custom"+editingStage,code,36500);
                setCustomTargetStages(customTargetStages[editingStage],{});
                setCustomTargetStages(customTargetStages[editingStage],deepCopyObject(true,customTargetStages[editingStage],stageTemp));
              $("#cStageInfoEdit").empty().append("Custom stage "+(editingStage+1)+" updated!");
            }
            else {
              if (customTargetStages.length < 10){
                setCookie("custom"+customTargetStages.length,code,36500);
                customTargetStages.push({});
                setCustomTargetStages(customTargetStages.length - 1,deepCopyObject(true,customTargetStages[customTargetStages.length - 1],stageTemp));
                $("#cStageInfoEdit").empty().append("Saved as Custom stage "+customTargetStages.length);
              }
              else {
                // limit reached
                $("#cStageInfoEdit").empty().append(
                  "Stage Limit Reached! Delete stages on the target test select to free space");
              }
            }
            //console.log(customTargetStages);
            break;
          case 2:
            sounds.menuForward.play();
            changeGamemode(1);
            break;
          default:
            break;
        }
      } else if (input[p][0].s && !input[p][1].s) {
        builderPaused = false;
        builderPauseSelected = 0;
        sounds.menuBack.play();
      }
    }
  } else {
    if (input[p][0].a && !input[p][1].a) {
      showingCode = false;
      $("#customStageContainer").hide();
      sounds.menuForward.play();
    }
  }

}

export function drawTargetStage (){
  for (let i=0;i<stageTemp.draw.polygon.length;i++){
  ui.fillStyle = (hoverItem[0] === "polygon" && hoverItem[1] === i) ? "rgba(255,255,255,0.5)" : boxFill;
    let p = stageTemp.draw.polygon[i];
    ui.beginPath();
    ui.moveTo(p[0].x,p[0].y);
    for (let n=1;n<p.length;n++) {
      ui.lineTo(p[n].x,p[n].y);
    }
    ui.closePath();
    ui.fill();
  }
  for (let i=0;i<stageTemp.draw.target.length;i++){
    let x = stageTemp.draw.target[i].x;
    let y = stageTemp.draw.target[i].y;
    for (let j=0;j<5;j++){
      if (hoverItem[0] == "target" && hoverItem[1] == i){
        ui.fillStyle = (j%2)?"white":"rgb(241, 111, 111)";
      }
      else {
        ui.fillStyle = (j%2)?"white":"red";
      }
      ui.beginPath();
      ui.arc(x, y, 25 - j * 5, 0, twoPi);
      ui.closePath();
      ui.fill();
    }
  }

  ui.strokeStyle = "#db80cc";
  ui.lineWidth = 1;
  for (let i=0;i<stageTemp.draw.ground.length;i++){
    let g = stageTemp.draw.ground[i];
    ui.beginPath();
    ui.moveTo(g[0].x, g[0].y);
    ui.lineTo(g[1].x, g[1].y);
    ui.closePath();
    ui.stroke();
  }
  ui.strokeStyle = "#4794c6";
  for (let i=0;i<stageTemp.draw.platform.length;i++){
    let p = stageTemp.draw.platform[i];
    ui.beginPath();
    ui.moveTo(p[0].x, p[0].y);
    ui.lineTo(p[1].x, p[1].y);
    ui.closePath();
    ui.stroke();
  }
  ui.strokeStyle = "#47c648";
  for (let i=0;i<stageTemp.draw.wallL.length;i++){
    let w = stageTemp.draw.wallL[i];
    ui.beginPath();
    ui.moveTo(w[0].x, w[0].y);
    ui.lineTo(w[1].x, w[1].y);
    ui.closePath();
    ui.stroke();
  }
  ui.strokeStyle = "#9867de";
  for (let i=0;i<stageTemp.draw.wallR.length;i++){
    let w = stageTemp.draw.wallR[i];
    ui.beginPath();
    ui.moveTo(w[0].x, w[0].y);
    ui.lineTo(w[1].x, w[1].y);
    ui.closePath();
    ui.stroke();
  }
  ui.strokeStyle = "#f04c4c";
  for (let i=0;i<stageTemp.draw.ceiling.length;i++){
    let ce = stageTemp.draw.ceiling[i];
    ui.beginPath();
    ui.moveTo(ce[0].x, ce[0].y);
    ui.lineTo(ce[1].x, ce[1].y);
    ui.closePath();
    ui.stroke();
  }
  ui.strokeStyle = "#e7a44c";
  ui.lineWidth = 1;
  for (let i=0;i<stageTemp.ledge.length;i++){
    let e = stageTemp.ledge[i];
    ui.beginPath();
    if (e[1]) {
      ui.moveTo(stageTemp.draw.box[e[0]].max.x, stageTemp.draw.box[e[0]].max.y + Math.min(30, (stageTemp.draw.box[e[0]]
        .min.y - stageTemp.draw.box[e[0]].max.y) / 2));
      ui.lineTo(stageTemp.draw.box[e[0]].max.x, stageTemp.draw.box[e[0]].max.y);
      ui.lineTo(stageTemp.draw.box[e[0]].max.x - Math.min(30, (stageTemp.draw.box[e[0]].max.x - stageTemp.draw.box[e[
        0]].min.x) / 2), stageTemp.draw.box[e[0]].max.y);
    } else {
      ui.moveTo(stageTemp.draw.box[e[0]].min.x, stageTemp.draw.box[e[0]].max.y + Math.min(30, (stageTemp.draw.box[e[0]]
        .min.y - stageTemp.draw.box[e[0]].max.y) / 2));
      ui.lineTo(stageTemp.draw.box[e[0]].min.x, stageTemp.draw.box[e[0]].max.y);
      ui.lineTo(stageTemp.draw.box[e[0]].min.x + Math.min(30, (stageTemp.draw.box[e[0]].max.x - stageTemp.draw.box[e[
        0]].min.x) / 2), stageTemp.draw.box[e[0]].max.y);
    }
    ui.closePath();
    ui.stroke();
  }
}

export function renderTargetBuilder (){
  clearScreen();
  drawBackground();
  ui.strokeStyle = "rgba(255, 255, 255, 0.17)";
  ui.lineWidth = 2;
  if (gridType != 4) {
    ui.beginPath();
    for (let i=0;i<1200/gridSizes[gridType];i++){
      ui.moveTo(i*gridSizes[gridType],0);
      ui.lineTo(i*gridSizes[gridType],750);
    }
    for (let i=0;i<750/gridSizes[gridType];i++){
      ui.moveTo(0,i*gridSizes[gridType]);
      ui.lineTo(1200,i*gridSizes[gridType]);
    }
    ui.closePath();
    ui.stroke();
  }
  drawTargetStage();
  if (amDrawingPolygon){
    ui.strokeStyle = "white";
    ui.lineWidth = 4;
    ui.beginPath();
    ui.moveTo(drawingPolygon[0].x,drawingPolygon[0].y);
    for (let n=1;n<drawingPolygon.length;n++){
      ui.lineTo(drawingPolygon[n].x,drawingPolygon[n].y);
    }
    ui.stroke();
  }
  if (holdingA) {
    switch (targetTool) {
      case 0:
        //BOX
        /*ui.strokeStyle = "white";
        ui.lineWidth = 4;
        ui.strokeRect(Math.min(drawingBox.min.x, drawingBox.max.x), Math.min(drawingBox.min.y, drawingBox.max.y),
          Math.abs(drawingBox.min.x - drawingBox.max.x), Math.abs(drawingBox.min.y - drawingBox.max.y));*/
        break;
      case 1:
        //PLATFORM
        ui.strokeStyle = "rgb(79, 244, 255)";
        ui.lineWidth = 4;
        ui.beginPath();
        ui.moveTo(drawingPlatform[0].x, drawingPlatform[0].y);
        ui.lineTo(drawingPlatform[1].x, drawingPlatform[1].y);
        ui.stroke();
        ui.closePath();
        break;
      case 2:
        //WALL
        ui.strokeStyle = "rgb(255,255,255)";
        ui.lineWidth = 4;
        ui.beginPath();
        ui.moveTo(drawingWall[0].x, drawingWall[0].y);
        ui.lineTo(drawingWall[1].x, drawingWall[1].y);
        ui.stroke();
        ui.closePath();
        break;
      case 3:
        //LEDGE
        break;
      case 4:
        //TARGET
        break;
      case 5:
        //MOVE
        break;
      case 6:
        //DELETE
        break;
      default:
        break;
    }
  }
  ui.textAlign = "center";
  ui.lineWidth = 2;
  let spCol = ["rgb(0, 0, 0)","rgb(110, 255, 66)"];
  if (hoverItem[0] == "startingPoint"){
    spCol = ["rgb(82, 82, 82)","rgb(171, 255, 145)"];
  }
  ui.fillStyle = spCol[0];
  ui.fillRect(stageTemp.draw.startingPoint.x - 4, stageTemp.draw.startingPoint.y - 12, 8, 24);
  ui.fillRect(stageTemp.draw.startingPoint.x - 12, stageTemp.draw.startingPoint.y - 4, 24, 8);
  ui.fillRect(stageTemp.draw.startingPoint.x - 27, stageTemp.draw.startingPoint.y - 23, 54, 13);
  ui.fillStyle = spCol[1];
  ui.fillRect(stageTemp.draw.startingPoint.x - 2, stageTemp.draw.startingPoint.y - 10, 4, 20);
  ui.fillRect(stageTemp.draw.startingPoint.x - 10, stageTemp.draw.startingPoint.y - 2, 20, 4);
  ui.font = "900 14px Arial";
  ui.fillText("START", stageTemp.draw.startingPoint.x, stageTemp.draw.startingPoint.y - 12);
  //ui.strokeText("START",stageTemp.draw.startingPoint.x,stageTemp.draw.startingPoint.y-12);
  let i = hoverItem[1];
  if (hoverItem[0] == "box"){
    ui.strokeStyle = "#e9bee2";
    ui.lineWidth = 3;
    let g = stageTemp.draw.ground[i];
    ui.beginPath();
    ui.moveTo(g[0].x, g[0].y);
    ui.lineTo(g[1].x, g[1].y);
    ui.closePath();
    ui.stroke();

    ui.strokeStyle = "#86df87";
    let w = stageTemp.draw.wallL[i];
    ui.beginPath();
    ui.moveTo(w[0].x, w[0].y);
    ui.lineTo(w[1].x, w[1].y);
    ui.closePath();
    ui.stroke();

    ui.strokeStyle = "#b99fde";
     w = stageTemp.draw.wallR[i];
    ui.beginPath();
    ui.moveTo(w[0].x, w[0].y);
    ui.lineTo(w[1].x, w[1].y);
    ui.closePath();
    ui.stroke();

    ui.strokeStyle = "#fa9292";
    let ce = stageTemp.draw.ceiling[i];
    ui.beginPath();
    ui.moveTo(ce[0].x, ce[0].y);
    ui.lineTo(ce[1].x, ce[1].y);
    ui.closePath();
    ui.stroke();

    ui.strokeStyle = "#e8bd84";
    for (let j=0;j<stageTemp.ledge.length;j++){
      let e = stageTemp.ledge[j];
      if (e[0] == i){
        ui.beginPath();
        if (e[1]) {
          ui.moveTo(stageTemp.draw.box[e[0]].max.x, stageTemp.draw.box[e[0]].max.y + Math.min(30, (stageTemp.draw.box[
            e[0]].min.y - stageTemp.draw.box[e[0]].max.y) / 2));
          ui.lineTo(stageTemp.draw.box[e[0]].max.x, stageTemp.draw.box[e[0]].max.y);
          ui.lineTo(stageTemp.draw.box[e[0]].max.x - Math.min(30, (stageTemp.draw.box[e[0]].max.x - stageTemp.draw.box[
            e[0]].min.x) / 2), stageTemp.draw.box[e[0]].max.y);
        } else {
          ui.moveTo(stageTemp.draw.box[e[0]].min.x, stageTemp.draw.box[e[0]].max.y + Math.min(30, (stageTemp.draw.box[
            e[0]].min.y - stageTemp.draw.box[e[0]].max.y) / 2));
          ui.lineTo(stageTemp.draw.box[e[0]].min.x, stageTemp.draw.box[e[0]].max.y);
          ui.lineTo(stageTemp.draw.box[e[0]].min.x + Math.min(30, (stageTemp.draw.box[e[0]].max.x - stageTemp.draw.box[
            e[0]].min.x) / 2), stageTemp.draw.box[e[0]].max.y);
        }
        ui.closePath();
        ui.stroke();
      }
    }
  } else if (hoverItem[0] === "platform" || hoverItem[0] === "ground" || hoverItem[0] === "ceiling" || hoverItem[0] === "wallL" || hoverItem[0] === "wallR") {
    ui.lineWidth = 3;
    ui.strokeStyle = "rgba(255,255,255,0.7)";
    let p = stageTemp.draw[hoverItem[0]][i];
    ui.beginPath();
    ui.moveTo(p[0].x, p[0].y);
    ui.lineTo(p[1].x, p[1].y);
    ui.closePath();
    ui.stroke();
  }

  if (ledgeHoverItem != 0) {
    ui.fillStyle = "rgb(255, 148, 70)";
    ui.beginPath();
    if (ledgeHoverItem[2]) {
      // if right side
      ui.arc(stageTemp.draw.box[ledgeHoverItem[1]].max.x, stageTemp.draw.box[ledgeHoverItem[1]].max.y, 10, 0, twoPi);
    } else {
      ui.arc(stageTemp.draw.box[ledgeHoverItem[1]].min.x, stageTemp.draw.box[ledgeHoverItem[1]].max.y, 10, 0, twoPi);
    }
    ui.closePath();
    ui.fill();
  }

  if (drawConnectIndicator) {
    ui.strokeStyle = "rgb(128, 255, 98)";
    ui.lineWidth = 3;
    ui.beginPath();
    ui.arc(connectIndicatorPos.x,connectIndicatorPos.y,15,0,twoPi);
    ui.arc(connectIndicatorPos.x,connectIndicatorPos.y,20,0,twoPi);
    ui.closePath();
    ui.stroke();
  }

  if (toolInfoTimer > 0) {
    toolInfoTimer--;
  }
  ui.fillStyle = "rgb(255,255,255)";
  ui.font = "13px Lucida Console, monaco, monospace";

  for (let i=0;i<7;i++){
    if (targetTool == i){
      if (toolInfoTimer > 0){
        ui.save();
        ui.globalAlpha = 1 * hoverToolbar;
        ui.fillStyle = "rgba(0,0,0," + Math.min(toolInfoTimer / 60, 1) + ")";
        ui.fillRect(620 + i * 70, 715, 80, 30);
        ui.fillStyle = "rgba(255,255,255," + Math.min(toolInfoTimer / 60, 1) + ")";
        ui.fillText(toolInfo[targetTool], 660 + i * 70, 733);
        ui.restore();
      }
      ui.globalAlpha = 0.6 * hoverToolbar;
      if (targetTool === 2 && toolInfoTimer > 0) {
        ui.save();
        ui.fillStyle = "rgba(255,255,255," + Math.min(toolInfoTimer / 60, 1) + ")";
        ui.strokeStyle = "rgba(0,0,0," + Math.min(toolInfoTimer / 60, 1) + ")";
        ui.lineWidth = 4;
        for (let n=0;n<3;n++) {
          let index = wallTypeIndex + n + 1;
          if (index > 3) {
            index -= 4;
          }
          ui.beginPath();
          ui.moveTo(630 + i * 70, 660 - (n+1) * 70);
          ui.arc(640 + i * 70, 660 - (n+1) * 70, 10, Math.PI, Math.PI * 1.5);
          ui.lineTo(680 + i * 70, 650 - (n+1) * 70);
          ui.arc(680 + i * 70, 660 - (n+1) * 70, 10, Math.PI * 1.5, twoPi);
          ui.lineTo(690 + i * 70, 710 - (n+1) * 70);
          ui.arc(680 + i * 70, 700 - (n+1) * 70, 10, 0, Math.PI / 2);
          ui.lineTo(640 + i * 70, 710 - (n+1) * 70);
          ui.arc(640 + i * 70, 700 - (n+1) * 70, 10, Math.PI / 2, Math.PI);
          ui.closePath();
          ui.fill();
          ui.beginPath();
          switch (wallTypeList[index]) {
            case "ground":
              ui.moveTo(788, 687 - (n+1) * 70);
              ui.lineTo(812, 679 - (n+1) * 70);
              break;
            case "ceiling":
              ui.moveTo(788, 679 - (n+1) * 70);
              ui.lineTo(812, 687 - (n+1) * 70);
              break;
            case "wallL":
              ui.moveTo(804, 671 - (n+1) * 70);
              ui.lineTo(796, 695 - (n+1) * 70);
              break;
            case "wallR":
              ui.moveTo(796, 671 - (n+1) * 70);
              ui.lineTo(804, 695 - (n+1) * 70);
              break;
            default:
              break;
          }
          ui.stroke();
        }
        ui.restore();
      }
    } else {
      ui.globalAlpha = 0.2 * hoverToolbar;
    }
    ui.beginPath();
    ui.moveTo(630 + i * 70, 660);
    ui.arc(640 + i * 70, 660, 10, Math.PI, Math.PI * 1.5);
    ui.lineTo(680 + i * 70, 650);
    ui.arc(680 + i * 70, 660, 10, Math.PI * 1.5, twoPi);
    ui.lineTo(690 + i * 70, 710);
    ui.arc(680 + i * 70, 700, 10, 0, Math.PI / 2);
    ui.lineTo(640 + i * 70, 710);
    ui.arc(640 + i * 70, 700, 10, Math.PI / 2, Math.PI);
    ui.closePath();
    ui.fill();
  }
  ui.lineWidth = 4;
  ui.globalAlpha = 1;
  ui.save();
  ui.globalAlpha = 1 * hoverToolbar;
  ui.fillStyle = "rgba(0,0,0,0.8)";
  ui.strokeStyle = "rgba(0,0,0,0.8)";
  ui.font = "600 14px Lucida Console, monaco, monospace";
  //ui.fillText(120 - stageTemp.box.length, 745, 707); 
  ui.beginPath();
  ui.moveTo(660,670);
  ui.lineTo(672,690);
  ui.lineTo(648,690);
  ui.closePath();
  ui.stroke();
  //ui.fillText(120 - stageTemp.platform.length, 815, 707);
  ui.beginPath();
  ui.moveTo(718, 680);
  ui.lineTo(742, 680);
  ui.stroke();
  ui.beginPath();
  switch (wallType) {
    case "ground":
      ui.moveTo(788, 687);
      ui.lineTo(812, 679);
      break;
    case "ceiling":
      ui.moveTo(788, 679);
      ui.lineTo(812, 687);
      break;
    case "wallL":
      ui.moveTo(804, 671);
      ui.lineTo(796, 695);
      break;
    case "wallR":
      ui.moveTo(796, 671);
      ui.lineTo(804, 695);
      break;
    default:
      break;
  }
  ui.stroke();
  ui.closePath();
  ui.save();
  ui.scale(0.8,1);
  ui.fillText(wallType, 800/0.8, 665);
  ui.restore();
  ui.beginPath();
  ui.moveTo(860, 690);
  ui.lineTo(860, 670);
  ui.lineTo(880, 670);
  ui.stroke();
  ui.closePath();
  ui.fillText(20 - stageTemp.target.length, 955, 707);
  ui.fillStyle = "rgba(255,0,0,0.8)";
  ui.beginPath();
  ui.arc(940, 680, 15, 0, twoPi);
  ui.closePath();
  ui.fill();
  ui.fillStyle = "rgba(255,255,255,0.8)";
  ui.beginPath();
  ui.arc(940, 680, 10, 0, twoPi);
  ui.closePath();
  ui.fill();
  ui.fillStyle = "rgba(255,0,0,0.8)";
  ui.beginPath();
  ui.arc(940, 680, 5, 0, twoPi);
  ui.closePath();
  ui.fill();
  ui.drawImage(handOpen, 997, 663, 29, 38);
  ui.font = "900 30px Arial";
  ui.fillStyle = "rgba(252, 45, 45, 0.8)";
  ui.fillText("X", 1080, 692);
  ui.restore();
  ui.font = "13px Lucida Console, monaco, monospace";
  if (tooSmallTimer > 0) {
    tooSmallTimer--;
    ui.fillStyle = "rgba(0,0,0," + Math.min(tooSmallTimer / 60, 1) + ")";
    ui.fillRect(tooSmallPos.x + 30, tooSmallPos.y, 80, 25);
    ui.fillStyle = "rgba(255,255,255," + Math.min(tooSmallTimer / 60, 1) + ")";
    ui.fillText("Too small", tooSmallPos.x + 70, tooSmallPos.y + 17);
  }
  if (badAngleTimer > 0) {
    badAngleTimer--;
    ui.fillStyle = "rgba(0,0,0," + Math.min(badAngleTimer / 60, 1) + ")";
    ui.fillRect(badAnglePos.x + 30, badAnglePos.y, 80, 25);
    ui.fillStyle = "rgba(255,255,255," + Math.min(badAngleTimer / 60, 1) + ")";
    ui.fillText("Bad angle", badAnglePos.x + 70, badAnglePos.y + 17);
  }
  if (targetTool == 5) {
    if (grabbedItem == 0) {
      ui.drawImage(handOpen, crossHairPos.x * 3 + 600 - 18, crossHairPos.y * -3 + 375 - 24, 36, 48);
    } else {
      ui.drawImage(handGrab, crossHairPos.x * 3 + 600 - 18, crossHairPos.y * -3 + 375 - 24, 36, 48);
    }
  } else if (targetTool == 6) {
    ui.font = "900 40px Arial";
    ui.fillStyle = "rgb(255, 83, 83)";
    ui.strokeStyle = "black";
    ui.fillText("X", crossHairPos.x * 3 + 600, crossHairPos.y * -3 + 375 + 10);
    ui.strokeText("X", crossHairPos.x * 3 + 600, crossHairPos.y * -3 + 375 + 10);
  } else {
    ui.fillStyle = "#ffffff";
    ui.fillRect(crossHairPos.x * 3 + 600 - 2, crossHairPos.y * -3 + 375 - 10, 4, 20);
    ui.fillRect(crossHairPos.x * 3 + 600 - 10, crossHairPos.y * -3 + 375 - 2, 20, 4);
  }

  if (builderPaused) {
    ui.fillStyle = "rgba(0,0,0,0.4)";
    ui.fillRect(0,0,layers.UI.width,layers.UI.height);
    for (let i=0;i<3;i++){
      if (builderPauseSelected == i){
        ui.fillStyle = "rgba(255,255,255,0.9)";
      } else {
        ui.fillStyle = "rgba(255,255,255,0.2)";
      }
      ui.fillRect(400, 150 + i * 150, 400, 100);
    }
    ui.font = "900 50px Arial";
    ui.fillStyle = "rgba(0,0,0,0.8)";
    ui.fillText("Test stage", 600, 220);
    ui.fillText("Save stage", 600, 370);
    ui.fillText("Quit", 600, 520);
  }
}

export function findTarget (realCrossHair){
  let found = false;
  for (let i=0;i<stageTemp.target.length;i++){
    if (Math.abs(realCrossHair.x - stageTemp.draw.target[i].x) <= 30 && Math.abs(realCrossHair.y - stageTemp.draw.target[i].y) <= 30){
      hoverItem = ["target",i];
      found = true;
      break;
    }
  }
  return found;
}

export function findLine (realCrossHair){
  let found = false;
  let types = ["platform","ground","ceiling","wallL","wallR"];
  for (let i=0;i<types.length;i++) {
    for (let j=0;j<stageTemp[types[i]].length;j++) {
      if (distanceToLine(realCrossHair, stageTemp.draw[types[i]][j]) <= 20){
        if (i === 0) {
          hoverItem = ["platform",j];
          found = true;
          break;
        } else {
          let partOfPolygon = false;
          for (let p=0;p<stageTemp.polygonMap.length;p++) {
            for (let k=0;k<stageTemp.polygonMap[p].length;k++) {
              if (stageTemp.polygonMap[p][k][0] === types[i] && stageTemp.polygonMap[p][k][1] === j) {
                partOfPolygon = true;
                break;
              }
            }
            if (partOfPolygon) {
              break;
            }
          }
          if (!partOfPolygon) {
            hoverItem = [types[i], j];
            found = true;
            break;
          }
        }
      }
    }
  }
  return found;
}

export function findPolygon (realCrossHair){
  let found = false;
  for (let i=0;i<stageTemp.polygon.length;i++){
    const d = distanceToPolygon(new Vec2D(realCrossHair.x, realCrossHair.y), stageTemp.polygon[i]);
    if (d < 15) {
      hoverItem = ["polygon",i];
      found = true;
      break;
    }
  }
  return found;
}

export function centerItem (item,realCrossHair){
  let offset = new Vec2D(crossHairPos.x - prevCrossHairPos.x, crossHairPos.y - prevCrossHairPos.y);
  let offsetR = new Vec2D(realCrossHair.x - prevRealCrossHair.x, realCrossHair.y - prevRealCrossHair.y);
  switch (item[0]){
    case "startingPoint":
      stageTemp.draw.startingPoint = new Vec2D(realCrossHair.x, realCrossHair.y);
      stageTemp.startingPoint = new Vec2D(crossHairPos.x, crossHairPos.y);
      break;
    case "target":
      stageTemp.draw.target[item[1]] = new Vec2D(realCrossHair.x, realCrossHair.y);
      stageTemp.target[item[1]] = new Vec2D(crossHairPos.x, crossHairPos.y);
      break;
    case "platform":
    case "ground":
    case "ceiling":
    case "wallL":
    case "wallR":
      stageTemp.draw[item[0]][item[1]][0].x += offsetR.x;
      stageTemp.draw[item[0]][item[1]][1].x += offsetR.x;
      stageTemp.draw[item[0]][item[1]][0].y += offsetR.y;
      stageTemp.draw[item[0]][item[1]][1].y += offsetR.y;
      stageTemp[item[0]][item[1]][0].x += offset.x;
      stageTemp[item[0]][item[1]][1].x += offset.x;
      stageTemp[item[0]][item[1]][0].y += offset.y;
      stageTemp[item[0]][item[1]][1].y += offset.y;
      break;
    case "polygon":
      for (let i=0;i<stageTemp.polygon[item[1]].length;i++){
        stageTemp.draw.polygon[item[1]][i].x += offsetR.x;
        stageTemp.draw.polygon[item[1]][i].y += offsetR.y;
        stageTemp.polygon[item[1]][i].x += offsetR.x;
        stageTemp.polygon[item[1]][i].y += offsetR.y;
        stageTemp.draw[stageTemp.polygonMap[item[1]][i][0]][stageTemp.polygonMap[item[1]][i][1]][0].x += offsetR.x;
        stageTemp.draw[stageTemp.polygonMap[item[1]][i][0]][stageTemp.polygonMap[item[1]][i][1]][1].x += offsetR.x;
        stageTemp.draw[stageTemp.polygonMap[item[1]][i][0]][stageTemp.polygonMap[item[1]][i][1]][0].y += offsetR.y;
        stageTemp.draw[stageTemp.polygonMap[item[1]][i][0]][stageTemp.polygonMap[item[1]][i][1]][1].y += offsetR.y;
        stageTemp[stageTemp.polygonMap[item[1]][i][0]][stageTemp.polygonMap[item[1]][i][1]][0].x += offset.x;
        stageTemp[stageTemp.polygonMap[item[1]][i][0]][stageTemp.polygonMap[item[1]][i][1]][1].x += offset.x;
        stageTemp[stageTemp.polygonMap[item[1]][i][0]][stageTemp.polygonMap[item[1]][i][1]][0].y += offset.y;
        stageTemp[stageTemp.polygonMap[item[1]][i][0]][stageTemp.polygonMap[item[1]][i][1]][1].y += offset.y;
      }
      break;
    default:
      break;
  }

}
export function setEditingStage(val){
    editingStage = val;
}
export function setShowingCode(val){
  showingCode = val;
}
export function setTargetBuilder(val){
    targetBuilder = val;
}
export function resetStageTemp(){
  stageTemp = {};
}
export function setStageTemp(val){
  stageTemp = val;
}