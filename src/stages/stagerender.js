import {getTransparency} from "main/vfx/transparency";
import {bg1, bg2, fg1, fg2, layers, gameMode, holiday, snowCount} from "main/main";
import {targetDestroyed} from "target/targetplay";
import {rotateVector, twoPi} from "main/render";
import {activeStage} from "stages/activeStage";
import {Vec2D} from "../main/util/Vec2D";
import {euclideanDist} from "../main/linAlg";

/* eslint-disable */

const bgPos = [[-30, 500, 300, 500, 900, 500, 1230, 450, 358], [-30, 400, 300, 400, 900, 400, 1230, 350, 179]];
const direction = [[1, -1, 1, -1, 1, -1, 1, -1, 1], [-1, 1, -1, 1, -1, 1, -1, 1, -1]];
export let boxFill = "rgba(0, 0, 0, 0.1)";
export let boxFillBG = "rgba(0, 0, 0, 0.1)";


const bgStars = [];
for (var p = 0; p < 20; p++) {
    bgStars[p] = new bgStar();
    bgStars[p].pos = new Vec2D(600 + 100 * Math.random() * bgStars[p].velocity.x, 375 + 100 * Math.random() * bgStars[p].velocity.y);
}
let bgSparkle = 3;
let gridGrad = "rgba(94,173,255,0.2)";

const circleSize = [];
for (var i = 0; i < 5; i++) {
    circleSize[i] = i * 40;
}
let ang = 0;
export let backgroundType = 0;
export let snowMeltTime = 200;

let snowBalls = [];

const targetbauble = new Image();
targetbauble.src = "assets/christmas/targetbauble.png";

const scandypattern = new Image();
scandypattern.src = "assets/christmas/scandypattern.png";

const fabric = new Image();
fabric.src = "assets/christmas/fabric.png";

const randall = [new Image(),new Image(),new Image()];
randall[0].src = "assets/stage/randall1.png";
randall[1].src = "assets/stage/randall2.png";
randall[2].src = "assets/stage/randall3.png";

export function drawStageInit() {
    fg1.strokeStyle = (holiday == 1) ? "white" : "#db80cc";
    fg1.lineWidth = 1;
    
    for (var j = 0; j < activeStage.ground.length; j++) {
        fg1.beginPath();
        fg1.moveTo((activeStage.ground[j][0].x * activeStage.scale) + activeStage.offset[0], (activeStage.ground[j][0].y * -activeStage.scale) + activeStage.offset[1]);
        fg1.lineTo((activeStage.ground[j][1].x * activeStage.scale) + activeStage.offset[0], (activeStage.ground[j][1].y * -activeStage.scale) + activeStage.offset[1]);
        fg1.closePath();
        fg1.stroke();
    }
    fg1.strokeStyle = (holiday == 1) ? "white" : "#ed6767";
    for (var j = 0; j < activeStage.ceiling.length; j++) {
        fg1.beginPath();
        fg1.moveTo((activeStage.ceiling[j][0].x * activeStage.scale) + activeStage.offset[0], (activeStage.ceiling[j][0].y * -activeStage.scale) + activeStage.offset[1]);
        fg1.lineTo((activeStage.ceiling[j][1].x * activeStage.scale) + activeStage.offset[0], (activeStage.ceiling[j][1].y * -activeStage.scale) + activeStage.offset[1]);
        fg1.closePath();
        fg1.stroke();
    }

    if (holiday == 1){
      if (activeStage.box !== null && activeStage.box !== undefined) {
        fg1.save();
        fg1.globalAlpha = 1;
        fg1.beginPath();
        for (var j = 0; j < activeStage.box.length; j++) {
          fg1.rect((activeStage.box[j].min.x * activeStage.scale) + activeStage.offset[0], (activeStage.box[j].max.y * -activeStage.scale) + activeStage.offset[1], (activeStage.box[j].max.x - activeStage.box[j].min.x) * activeStage.scale, (activeStage.box[j].max.y - activeStage.box[j].min.y) * activeStage.scale);
        }
        fg1.clip();
        fg1.drawImage(scandypattern,0,0,1200,750);
        fg1.restore();
      }
      fg1.save();
      fg1.beginPath();
      for (var j = 0; j < activeStage.platform.length; j++) {
        if (j != activeStage.movingPlat){
          var x1 = (activeStage.platform[j][0].x * activeStage.scale) + activeStage.offset[0];
          var x2 = (activeStage.platform[j][1].x * activeStage.scale) + activeStage.offset[0];
          fg1.rect(x1, (activeStage.platform[j][0].y * -activeStage.scale) + activeStage.offset[1], x2-x1,2*activeStage.scale);
        }
      }
      fg1.clip();
      fg1.lineWidth = 6;
      fg1.fillStyle = "white";
      fg1.fillRect(0,0,1200,750);
      fg1.strokeStyle = "red";
      fg1.beginPath();
      for (var j=0;j<110;j++){ 
        fg1.moveTo(j*20,0);
        fg1.lineTo(j*20-750,750);
      }
      fg1.stroke();
      fg1.restore();
    } else {
      fg1.strokeStyle = "#4794c6";
      for (var j = 0; j < activeStage.platform.length; j++) {
        if (j != activeStage.movingPlat){
          fg1.beginPath();
          fg1.moveTo((activeStage.platform[j][0].x * activeStage.scale) + activeStage.offset[0], (activeStage.platform[j][0].y * -activeStage.scale) + activeStage.offset[1]);
          fg1.lineTo((activeStage.platform[j][1].x * activeStage.scale) + activeStage.offset[0], (activeStage.platform[j][1].y * -activeStage.scale) + activeStage.offset[1]);
          fg1.closePath();
          fg1.stroke();
        }
      }
    }
    
    fg1.strokeStyle = (holiday == 1) ? "white" : "#47c648";
    for (var k = 0; k < activeStage.wallL.length; k++) {
        fg1.beginPath();
        fg1.moveTo((activeStage.wallL[k][0].x * activeStage.scale) + activeStage.offset[0], (activeStage.wallL[k][0].y * -activeStage.scale) + activeStage.offset[1]);
        fg1.lineTo((activeStage.wallL[k][1].x * activeStage.scale) + activeStage.offset[0], (activeStage.wallL[k][1].y * -activeStage.scale) + activeStage.offset[1]);
        fg1.closePath();
        fg1.stroke();
    }
    fg1.strokeStyle = (holiday == 1) ? "white" : "#9867de";
    for (var l = 0; l < activeStage.wallR.length; l++) {
        fg1.beginPath();
        fg1.moveTo((activeStage.wallR[l][0].x * activeStage.scale) + activeStage.offset[0], (activeStage.wallR[l][0].y * -activeStage.scale) + activeStage.offset[1]);
        fg1.lineTo((activeStage.wallR[l][1].x * activeStage.scale) + activeStage.offset[0], (activeStage.wallR[l][1].y * -activeStage.scale) + activeStage.offset[1]);
        fg1.closePath();
        fg1.stroke();
    }

    if (holiday == 1){
      /*var ex1 = 0;
      var ex2 = 0;
      fg1.save();
      fg1.lineCap="round";
      for (var n = 0; n < 2; n++){
        if (n == 0){
          ex1 = 0;
          ex2 = Math.floor(1.5*activeStage.scale);
          fg1.beginPath();
        }
        else {
          ex1 = Math.floor(1*activeStage.scale);
          ex2 = Math.floor(-1*activeStage.scale);
          fg1.setLineDash([Math.floor(1.5*activeStage.scale), Math.floor(3.5*activeStage.scale)]);          
        }
        for (var j = 0; j < activeStage.ledge.length; j++) {
          var e = activeStage.ledge[j];
          if (n == 1){
            fg1.lineWidth = Math.floor(0.8*activeStage.scale)+1;
            fg1.strokeStyle = "#43401D";
            fg1.beginPath();
          }
          if (e[1]) {
              fg1.moveTo(activeStage.box[e[0]].max.x * activeStage.scale + activeStage.offset[0] -ex1, (activeStage.box[e[0]].max.y - Math.min(10, (activeStage.box[e[0]].max.y - activeStage.box[e[0]].min.y) / 2)) * -activeStage.scale + activeStage.offset[1] +ex2);
              fg1.lineTo(activeStage.box[e[0]].max.x * activeStage.scale + activeStage.offset[0] -ex1, activeStage.box[e[0]].max.y * -activeStage.scale + activeStage.offset[1] +ex1);
              fg1.lineTo((activeStage.box[e[0]].max.x - Math.min(10, (activeStage.box[e[0]].max.x - activeStage.box[e[0]].min.x) / 2)) * activeStage.scale + activeStage.offset[0] -ex2, activeStage.box[e[0]].max.y * -activeStage.scale + activeStage.offset[1] +ex1);
          }
          else {
              fg1.moveTo(activeStage.box[e[0]].min.x * activeStage.scale + activeStage.offset[0] +ex1, (activeStage.box[e[0]].max.y - Math.min(10, (activeStage.box[e[0]].max.y - activeStage.box[e[0]].min.y) / 2)) * -activeStage.scale + activeStage.offset[1] +ex2);
              fg1.lineTo(activeStage.box[e[0]].min.x * activeStage.scale + activeStage.offset[0] +ex1, activeStage.box[e[0]].max.y * -activeStage.scale + activeStage.offset[1] +ex1);
              fg1.lineTo((activeStage.box[e[0]].min.x + Math.min(10, (activeStage.box[e[0]].max.x - activeStage.box[e[0]].min.x) / 2)) * activeStage.scale + activeStage.offset[0] +ex2, activeStage.box[e[0]].max.y * -activeStage.scale + activeStage.offset[1] +ex1);
          }
          if (n == 1) {
            fg1.closePath();
            fg1.stroke();
            fg1.lineWidth = Math.floor(0.8*activeStage.scale);
            fg1.strokeStyle = "white";
            fg1.stroke();
          }   
        }
        if (n == 0) {
          fg1.closePath();
          fg1.save();
          fg1.clip();
          fg1.drawImage(fabric,0,0);
          fg1.restore();
        }  
      
      }
      fg1.restore();
      fg1.lineCap = "butt";
      fg1.lineWidth = 1;*/
    } else {
      fg1.strokeStyle = "#E7A44C";
      fg1.lineWidth = 2;
      for (let i=0;i<activeStage.ledge.length;i++){
        let e = activeStage.ledge[i];
        let pA = activeStage[e[0]][e[1]][e[2]];
        let pB = activeStage[e[0]][e[1]][1-e[2]];
        let ang = Math.atan2((pB.y - pA.y) , (pB.x - pA.x));
        let magnitude = euclideanDist(pA, pB);
        let length = Math.min(0.4 * magnitude, 20 / activeStage.scale);
        let pC = new Vec2D(pA.x + length * Math.cos(ang), pA.y + length * Math.sin(ang));
        fg1.beginPath();
        fg1.moveTo((pA.x * activeStage.scale) + activeStage.offset[0], (pA.y * -activeStage.scale) + activeStage.offset[1]);
        fg1.lineTo((pC.x * activeStage.scale) + activeStage.offset[0], (pC.y * -activeStage.scale) + activeStage.offset[1]);
        fg1.closePath();
        fg1.stroke();
      }
    }
};

let swirlTimer = 0;
let swirlSwitch = false;

let randallTimer = 0;

export function drawStage() {
    if (activeStage.movingPlat > -1) {
        /*fg2.strokeStyle = (holiday == 1) ? "white" : "#4794c6";
        fg2.beginPath();
        fg2.moveTo((activeStage.platform[activeStage.movingPlat][0].x * activeStage.scale) + activeStage.offset[0], (activeStage.platform[activeStage.movingPlat][0].y * -activeStage.scale) + activeStage.offset[1]);
        fg2.lineTo((activeStage.platform[activeStage.movingPlat][1].x * activeStage.scale) + activeStage.offset[0], (activeStage.platform[activeStage.movingPlat][1].y * -activeStage.scale) + activeStage.offset[1]);
        fg2.closePath();
        fg2.stroke();*/
        randallTimer++;
        if (randallTimer === 30){
          randallTimer = 0;
        }
        bg2.drawImage(randall[Math.floor(randallTimer/10)],(activeStage.platform[activeStage.movingPlat][0].x * activeStage.scale) + activeStage.offset[0]-20, (activeStage.platform[activeStage.movingPlat][0].y * -activeStage.scale) + activeStage.offset[1]-20,100,100);
    }
    fg2.fillStyle = boxFill;

    if (holiday != 1){
      if (activeStage.box !== null && activeStage.box !== undefined) {
        for (var j = 0; j < activeStage.box.length; j++) {
          fg2.fillRect((activeStage.box[j].min.x * activeStage.scale) + activeStage.offset[0], (activeStage.box[j].max.y * -activeStage.scale) + activeStage.offset[1], (activeStage.box[j].max.x - activeStage.box[j].min.x) * activeStage.scale, (activeStage.box[j].max.y - activeStage.box[j].min.y) * activeStage.scale);
        }
      }
      if (activeStage.polygon !== null && activeStage.polygon !== undefined) {
        for (let j=0;j<activeStage.polygon.length;j++){
          let p = activeStage.polygon[j];
          fg2.beginPath();
          fg2.moveTo(p[0].x* activeStage.scale + activeStage.offset[0], p[0].y* -activeStage.scale + activeStage.offset[1]);
          for (let n=1;n<p.length;n++) {
            fg2.lineTo(p[n].x * activeStage.scale + activeStage.offset[0], p[n].y* -activeStage.scale + activeStage.offset[1]);
          }
          fg2.closePath();
          fg2.fill();
        }
      }
      if (activeStage.background !== null && activeStage.background !== undefined) {
        if (activeStage.background.polygon !== null && activeStage.background.polygon !== undefined) {
          bg2.save();
          bg2.fillStyle = boxFillBG;
          for (let i=0;i<activeStage.background.polygon.length;i++) {   
            let p = activeStage.background.polygon[i];
            bg2.beginPath();
            bg2.moveTo(p[0].x * activeStage.scale + activeStage.offset[0],p[0].y * -activeStage.scale + activeStage.offset[1]);
            for (let n=1;n<p.length;n++) {
              bg2.lineTo(p[n].x * activeStage.scale + activeStage.offset[0],p[n].y * -activeStage.scale + activeStage.offset[1]);
            }
            bg2.closePath();
            bg2.fill();
          }
        }
        if (activeStage.background.line !== null && activeStage.background.line !== undefined) {
          bg2.lineWidth = 3;
          bg2.strokeStyle = boxFillBG;
          for (let i=0;i<activeStage.background.line.length;i++){
            let lL = activeStage.background.line[i][0];
            let lR = activeStage.background.line[i][1];
            bg2.beginPath();
            bg2.moveTo(lL.x * activeStage.scale + activeStage.offset[0], lL.y * -activeStage.scale + activeStage.offset[1]);
            bg2.lineTo(lR.x * activeStage.scale + activeStage.offset[0], lR.y * -activeStage.scale + activeStage.offset[1]);
            bg2.closePath();
            bg2.stroke();
          }
          bg2.restore();
        }
      }
    }

    fg2.strokeStyle = "#e7a44c";
    
    var ex = 0;
    /*if (holiday != 1){
      for (var j = 0; j < activeStage.ledge.length; j++) {
        var e = activeStage.ledge[j];   
        fg2.beginPath();
        if (e[1]) {
            fg2.moveTo(activeStage.box[e[0]].max.x * activeStage.scale + activeStage.offset[0] -ex, (activeStage.box[e[0]].max.y - Math.min(10, (activeStage.box[e[0]].max.y - activeStage.box[e[0]].min.y) / 2)) * -activeStage.scale + activeStage.offset[1] +ex);
            fg2.lineTo(activeStage.box[e[0]].max.x * activeStage.scale + activeStage.offset[0] -ex, activeStage.box[e[0]].max.y * -activeStage.scale + activeStage.offset[1] +ex);
            fg2.lineTo((activeStage.box[e[0]].max.x - Math.min(10, (activeStage.box[e[0]].max.x - activeStage.box[e[0]].min.x) / 2)) * activeStage.scale + activeStage.offset[0] -ex, activeStage.box[e[0]].max.y * -activeStage.scale + activeStage.offset[1] +ex);
        }
        else {
            fg2.moveTo(activeStage.box[e[0]].min.x * activeStage.scale + activeStage.offset[0] +ex, (activeStage.box[e[0]].max.y - Math.min(10, (activeStage.box[e[0]].max.y - activeStage.box[e[0]].min.y) / 2)) * -activeStage.scale + activeStage.offset[1] +ex);
            fg2.lineTo(activeStage.box[e[0]].min.x * activeStage.scale + activeStage.offset[0] +ex, activeStage.box[e[0]].max.y * -activeStage.scale + activeStage.offset[1] +ex);
            fg2.lineTo((activeStage.box[e[0]].min.x + Math.min(10, (activeStage.box[e[0]].max.x - activeStage.box[e[0]].min.x) / 2)) * activeStage.scale + activeStage.offset[0] +ex, activeStage.box[e[0]].max.y * -activeStage.scale + activeStage.offset[1] +ex);
        }
        fg2.closePath();
        fg2.stroke();
        fg2.fill();
        fg2.fill();
      }
    }*/
      
    if (typeof activeStage.target != "undefined") {
        fg2.strokeStyle = "rgba(255,255,255,0.4)";
        fg2.lineWidth = 1;
        for (var k = 0; k < activeStage.target.length; k++) {
            if (!targetDestroyed[k]) {
                var x = activeStage.target[k].x * activeStage.scale + activeStage.offset[0];
                var y = activeStage.target[k].y * -activeStage.scale + activeStage.offset[1];
                if (holiday == 1){
                  fg2.drawImage(targetbauble,x-17,y-25,35,43);
                  fg2.beginPath();
                  fg2.moveTo(x,y-23);
                  fg2.lineTo(x,0);
                  fg2.closePath();
                  fg2.stroke();
                } else {
                  for (var j = 0; j < 5; j++) {
                    fg2.fillStyle = (j % 2) ? "white" : "red";
                    fg2.beginPath();
                    fg2.arc(x, y, (25 - j * 5) * (activeStage.scale / 4.5), 0, twoPi);
                    fg2.closePath();
                    fg2.fill();
                  }
                }
            }
        }
    }
};

export function setBackgroundType(val) {
    backgroundType = val;
};
export function bgStar() {
    var vSeed = Math.random();
    this.velocity = new Vec2D(5 * vSeed * Math.sign(0.5 - Math.random()), 5 * (1 - vSeed) * Math.sign(0.5 - Math.random()));
    if (getTransparency()) {
        this.colour = "hsl(" + 358 * Math.random() + ", 100%, 50%)";
    }
    else {
        this.colour = "hsl(" + 358 * Math.random() + ",100%,15%)";
    }
    this.pos = new Vec2D(0, 0);
    this.life = 0;
};
export function drawBackgroundInit() {
    var bgGrad = bg1.createLinearGradient(0, 0, 0, 500);
    bgGrad.addColorStop(0, (holiday == 1) ? "rgb(46, 100, 147)" : "rgb(24, 17, 66)");
    bgGrad.addColorStop(1, "black");
    bg1.fillStyle = bgGrad;
    bg1.fillRect(-100, -100, layers.BG1.width + 200, layers.BG1.height + 200);
    ;
    if (backgroundType == 1 || holiday == 1) {
        let gridGrad = bg2.createRadialGradient(600, 375, 1, 600, 375, 800);
        gridGrad.addColorStop(0, "rgba(94, 173, 255, 0)");
        gridGrad.addColorStop(1, "rgba(94, 173, 255, 0.2)");
        bg2.strokeStyle = gridGrad;
        boxFill = "rgba(94, 173, 255, 0.3)";
        boxFillBG = "rgba(94, 173, 255, 0.25)";
    }
};

export function drawBackground() {
  if (holiday == 1){
    if (gameMode != 4){
        drawSnow();
    }
  }
  else {
    if (backgroundType == 0) {
      drawStars();
    }
    else {
      drawTunnel();
    }
  }
};

export function drawTunnel() {
    bg2.lineWidth = 2;
    ang += 0.005;
    var angB = ang;
    bg2.beginPath();
    for (var i = 0; i < 16; i++) {
        var v = rotateVector(0, 800, angB);
        bg2.moveTo(600, 375);
        bg2.lineTo(600 + v.x, 375 + v.y);
        angB += Math.PI / 8;
    }
    bg2.stroke();
    for (var i = 0; i < circleSize.length; i++) {
        circleSize[i]++;
        if (circleSize[i] > 200) {
            circleSize[i] = 0;
        }
        bg2.lineWidth = Math.max(1, Math.round(3 * (circleSize[i] / 60)));
        bg2.beginPath();
        bg2.arc(600, 375, circleSize[i] * 4, 0, twoPi);
        bg2.closePath();
        bg2.stroke();
    }
};

export function drawStars() {
    bgSparkle--;
    for (var p = 0; p < 20; p++) {
        if (bgStars[p].pos.x > 1250 || bgStars[p].pos.y > 800 || bgStars[p].pos.x < -50 || bgStars[p].pos.y < -50) {
            bgStars[p].pos = new Vec2D(600, 375);
            bgStars[p].life = 0;
            var vSeed = Math.random();
            bgStars[p].velocity = new Vec2D(5 * vSeed * Math.sign(0.5 - Math.random()), 5 * (1 - vSeed) * Math.sign(0.5 - Math.random()));
        }
        bgStars[p].pos.x += bgStars[p].velocity.x;
        bgStars[p].pos.y += bgStars[p].velocity.y;

        bgStars[p].life++;

        if (bgSparkle == 0) {
            bg2.fillStyle = bgStars[p].colour;
            if (getTransparency()) {
                bg2.globalAlpha = Math.min(bgStars[p].life / 300, 1);
            }
            bg2.beginPath();
            bg2.arc(bgStars[p].pos.x, bgStars[p].pos.y, 5, twoPi, 0);
            ;
            bg2.fill();

        }
    }
    if (bgSparkle == 0) {
        bgSparkle = 2;
    }
    bg2.globalAlpha = 1;
    for (var k = 1; k > -1; k--) {
        for (var j = 0; j < 9; j++) {
            //bgPos[j] += direction[j]*5*Math.random();
            if (j == 8) {
                bgPos[k][j] += direction[k][j] * 0.2 * Math.random();
            }
            else {
                bgPos[k][j] += direction[k][j] * 1 * Math.random();
            }
            switch (j) {
                case 0:
                    if ((direction[k][j] == 1 && bgPos[k][j] > -10) || (direction[k][j] == -1 && bgPos[k][j] < -200)) {
                        direction[k][j] *= -1;
                    }
                    break;
                case 1:
                    if ((direction[k][j] == 1 && bgPos[k][j] > 550 - k * 100) || (direction[k][j] == -1 && bgPos[k][j] < 450 - k * 100)) {
                        direction[k][j] *= -1;
                    }
                    break;
                case 2:
                    if ((direction[k][j] == 1 && bgPos[k][j] > 550) || (direction[k][j] == -1 && bgPos[k][j] < 0)) {
                        direction[k][j] *= -1;
                    }
                    break;
                case 3:
                    if ((direction[k][j] == 1 && bgPos[k][j] > 550 - k * 100) || (direction[k][j] == -1 && bgPos[k][j] < 450 - k * 100)) {
                        direction[k][j] *= -1;
                    }
                    break;
                case 4:
                    if ((direction[k][j] == 1 && bgPos[k][j] > 1150) || (direction[k][j] == -1 && bgPos[k][j] < 600)) {
                        direction[k][j] *= -1;
                    }
                    break;
                case 5:
                    if ((direction[k][j] == 1 && bgPos[k][j] > 550 - k * 100) || (direction[k][j] == -1 && bgPos[k][j] < 450 - k * 100)) {
                        direction[k][j] *= -1;
                    }
                    break;
                case 6:
                    if ((direction[k][j] == 1 && bgPos[k][j] > 1400) || (direction[k][j] == -1 && bgPos[k][j] < 1210)) {
                        direction[k][j] *= -1;
                    }
                    break;
                case 7:
                    if ((direction[k][j] == 1 && bgPos[k][j] > 550 - k * 100) || (direction[k][j] == -1 && bgPos[k][j] < 450 - k * 100)) {
                        direction[k][j] *= -1;
                    }
                    break;
                case 8:
                    if ((direction[k][j] == 1 && bgPos[k][j] > 357) || (direction[k][j] == -1 && bgPos[k][j] < 1)) {
                        direction[k][j] *= -1;
                    }
                    break;
                default:
                    break;
            }
        }
        if (getTransparency()) {
            boxFill = "hsla(" + bgPos[k][8] + ", 100%, 50%, " + (0.15 - k * 0.07) + ")";
            boxFillBG = "hsla(" + bgPos[k][8] + ", 100%, 50%, " + (0.13 - k * 0.07) + ")";
        }
        else {
            boxFill = "hsl(" + bgPos[k][8] + ", 100%, 7%)";
            boxFillBG = "hsl(" + bgPos[k][8] + ", 50%, 7%)";
        }
        bg2.fillStyle = boxFill;
        bg2.beginPath();
        bg2.moveTo(bgPos[k][0], bgPos[k][1]);
        bg2.bezierCurveTo(bgPos[k][2], bgPos[k][3], bgPos[k][4], bgPos[k][5], bgPos[k][6], bgPos[k][7]);
        if (k == 1) {
            bg2.lineTo(bgPos[0][6], bgPos[0][7]);
            bg2.bezierCurveTo(bgPos[0][4], bgPos[0][5], bgPos[0][2], bgPos[0][3], bgPos[0][0], bgPos[0][1]);
        }
        else {
            bg2.lineTo(1200, 750);
            bg2.lineTo(0, 750);
        }
        bg2.closePath();
        bg2.fill();
    }
};

export function snowBall(){
  this.size = (Math.random() > 0.02) ? Math.floor(Math.random()*3)+1 : Math.floor(Math.random()*3)+5;
  this.velx = this.size/5*(1-Math.random()*0.5);
  this.vely = Math.max(1,this.size/6);
  this.landed = false;
  this.melted = 0;
  this.x = activeStage.blastzone.min.x+40+Math.random()*(activeStage.blastzone.max.x - activeStage.blastzone.min.x - 40)+(this.size >= 5 ? Math.random()*60 : 0);
  this.y = activeStage.blastzone.max.y-60;
  this.prevX = this.x;
  this.prevY = this.y;
}

export function createSnow(){
  snowBalls = [];
  for (var i=0;i<1500;i++){
    snowBalls.push(new snowBall());
    snowBalls[i].y = activeStage.blastzone.min.y+(activeStage.blastzone.max.y-activeStage.blastzone.min.y)*Math.random();
  }
}

export function snowCollision(i){
  var s = snowBalls[i];
  for (var j=0;j<activeStage.ground.length;j++){
    if (s.x >= activeStage.ground[j][0].x && s.x <= activeStage.ground[j][1].x && s.prevY > activeStage.ground[j][0].y && s.y <= activeStage.ground[j][0].y){
      s.y = activeStage.ground[j][0].y;
      return true;
    }
  }
  for (var j=0;j<activeStage.platform.length;j++){
    if (j != activeStage.movingPlat && s.x >= activeStage.platform[j][0].x && s.x <= activeStage.platform[j][1].x && s.prevY > activeStage.platform[j][0].y && s.y <= activeStage.platform[j][0].y){
      s.y = activeStage.platform[j][0].y;
      return true;
    }
  }
  for (var j=0;j<activeStage.wallR.length;j++){
    if (s.y <= activeStage.wallR[j][0].y && s.y >= activeStage.wallR[j][1].y && s.prevX > activeStage.wallR[j][0].x && s.x <= activeStage.wallR[j][0].x){
      s.x = activeStage.wallR[j][0].x;
      return true;
    }
  }
  return false;
}

export function drawSnow(){
  var melting = [];
  bg2.fillStyle = "white";
  fg2.fillStyle = "white";
  fg2.beginPath();
  bg2.beginPath();
  for (var i=0;i<snowCount;i++){
    if (snowBalls[i].landed){
      snowBalls[i].melted++;
      if (snowBalls[i].melted > snowMeltTime){
        snowBalls[i] = new snowBall();
      } else {
        melting.push(i);
      }
    }
    else {
      snowBalls[i].prevX = snowBalls[i].x;
      snowBalls[i].prevY = snowBalls[i].y;
      snowBalls[i].x -= snowBalls[i].velx;
      snowBalls[i].y -= snowBalls[i].vely;
      if (snowBalls[i].y < activeStage.blastzone.min.y+30){
        snowBalls[i] = new snowBall();
      }
      else if (snowBalls[i].x < activeStage.blastzone.min.x+40){
        snowBalls[i] = new snowBall();
      }
      else {
        if (snowBalls[i].size >= 2 && snowBalls[i].size < 5){
          if (snowCollision(i)){
            snowBalls[i].landed = true;
            snowBalls[i].size += 1;
          }
        }
      }
      var x = (snowBalls[i].x*activeStage.scale)+activeStage.offset[0];
      var y = (snowBalls[i].y*-activeStage.scale)+activeStage.offset[1];
      if (snowBalls[i].size >= 5){
        fg2.moveTo(x,y);
        fg2.arc(x,y,snowBalls[i].size,0,twoPi);
      }
      else {
        bg2.moveTo(x,y);
        bg2.arc(x,y,snowBalls[i].size,0,twoPi);
      }
    }
  }
  fg2.closePath();
  fg2.fill();
  bg2.closePath();
  bg2.fill();
  for (var i=0;i<melting.length;i++){
    bg2.fillStyle = "rgba(255,255,255,"+(1-(snowBalls[melting[i]].melted/snowMeltTime))+")";
    bg2.beginPath();
    bg2.arc((snowBalls[melting[i]].x*activeStage.scale)+activeStage.offset[0],(snowBalls[melting[i]].y*-activeStage.scale)+activeStage.offset[1],snowBalls[melting[i]].size,0,twoPi);
    bg2.closePath();
    bg2.fill();
  }
}
