import {characterSelections, player} from "main/main";
import {actionStates} from "physics/actionStateShortcuts";
import {sounds} from "main/sfx";
import {framesData} from 'main/characters';
import {drawVfx} from "main/vfx/drawVfx";
import {getHorizontalDecay, getVerticalDecay} from "physics/hitDetection";
import {add, reflect, norm} from "main/linAlg";

export default {
  name : "WALLDAMAGE",
  canPassThrough : false,
  canGrabLedge : [false,false],
  wallJumpAble : false,
  canBeGrabbed : true,
  headBonk : true,
  landType : 2,
  init : function(p,input,normal){
    player[p].actionState = "WALLDAMAGE";
    player[p].timer = 0;
    sounds.bounce.play();

    const currentVel = add(player[p].phys.cVel,player[p].phys.kVel);
    const reflectedVel = reflect(currentVel, normal);

    /* bogus follows
    let currentKVelMagnitude = Math.sqrt(Math.pow(player[p].phys.kVel.x,2),Math.pow(player[p].phys.kVel.y,2));
    currentKVelMagnitude *= 0.8;
    player[p].phys.kVel.x = newVelAngle*Math.cos(currentKVelMagnitude);
    player[p].phys.kVel.y = newVelAngle*Math.sin(currentKVelMagnitude);
    player[p].phys.kDec.x = Math.round(0.051 * Math.cos(newVelAngle) * 100000) / 100000;
    player[p].phys.kDec.y = Math.round(0.051 * Math.sin(newVelAngle) * 100000) / 100000;
    */

    actionStates[characterSelections[p]].WALLDAMAGE.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (player[p].hit.hitstun % 10 === 0){
      drawVfx("flyingDust",player[p].phys.pos);
    }
    if (!actionStates[characterSelections[p]].WALLDAMAGE.interrupt(p,input)){
      player[p].hit.hitstun--;
      player[p].phys.cVel.y -= player[p].charAttributes.gravity;
      if (player[p].phys.cVel.y < -player[p].charAttributes.terminalV){
        player[p].phys.cVel.y = -player[p].charAttributes.terminalV;
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > framesData[characterSelections[p]].WALLDAMAGE){
      actionStates[characterSelections[p]].DAMAGEFALL.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};

