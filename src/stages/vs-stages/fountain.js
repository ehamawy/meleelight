import {Box2D} from "../../main/util/Box2D";
import {Vec2D} from "../../main/util/Vec2D";

/*eslint indent:0*/ 

const platL = 21;
const platR = 49.5;
const platYMin = 12.375;
const platMax = 27.375;

export default {
  box: [],
  polygon : [ [ new Vec2D(-63.35, 0.62), new Vec2D(-53.5, 0.62), new Vec2D(-51.25, 0),new Vec2D(51.25, 0), new Vec2D(53.5, 0.62), new Vec2D(63.35, 0.62)
              , new Vec2D(63.35, -4.5), new Vec2D(59.33, -15), new Vec2D(56.9, -19.5)
              , new Vec2D(55, -27), new Vec2D(52, -32), new Vec2D(48, -38), new Vec2D(41, -42)
              , new Vec2D(19, -49.5), new Vec2D(13, -54.5), new Vec2D(10, -62), new Vec2D(8.8, -72)
              , new Vec2D(8.8, -150), new Vec2D(-8.8, -150)
              , new Vec2D(-8.8, -72), new Vec2D(-10, -62), new Vec2D(-13, -54.5), new Vec2D(-19, -49.5)
              , new Vec2D(-41, -42), new Vec2D(-48, -38), new Vec2D(-52, -32), new Vec2D(-55, -27)
              , new Vec2D(-56.9, -19.5), new Vec2D(-59.33, -15), new Vec2D(-63.35, -4.5)
              ] ],
  platform: [[new Vec2D(-14.25,42.75 ), new Vec2D(14.25, 42.75)]],
  ground: [ [new Vec2D(-63.33, 0.62), new Vec2D(-53.5, 0.62)], [new Vec2D(-53.5, 0.62), new Vec2D(-51, 0) ]
          , [new Vec2D(-51, 0), new Vec2D(51, 0)]
          , [new Vec2D(51, 0), new Vec2D(53.5, 0.62)], [new Vec2D(53.5, 0.62), new Vec2D(63.33, 0.62)] 
          ],
  ceiling: [[new Vec2D(-19, -49.5),new Vec2D(-41, -42)],[new Vec2D(19, -49.5),new Vec2D(41, -42)]],
  wallL: [[new Vec2D(-63.35, 0.62),new Vec2D(-63.35, -4.5)],[new Vec2D(-63.35, -4.5),new Vec2D(-59.33, -15)],[new Vec2D(-59.33, -15),new Vec2D(-56.9, -19.5)]
         ,[new Vec2D(-56.9, -19.5),new Vec2D(-55, -27)], [new Vec2D(-55, -27), new Vec2D(-52, -32)], [new Vec2D(-52, -32),new Vec2D(-48, -38)]
         ,[new Vec2D(-48, -38), new Vec2D(-41, -42)], [new Vec2D(-19, -49.5),new Vec2D(-13, -54.5)], [new Vec2D(-13, -54.5), new Vec2D(-10, -62)]
         ,[new Vec2D(-10, -62), new Vec2D(-8.8, -72)], [new Vec2D(-8.8, -72), new Vec2D(-8.8, -150)]],
  wallR: [[new Vec2D(63.35, 0.62),new Vec2D(63.35, -4.5)],[new Vec2D(63.35, -4.5),new Vec2D(59.33, -15)],[new Vec2D(59.33, -15),new Vec2D(56.9, -19.5)]
         ,[new Vec2D(56.9, -19.5),new Vec2D(55, -27)], [new Vec2D(55, -27), new Vec2D(52, -32)], [new Vec2D(52, -32),new Vec2D(48, -38)]
         ,[new Vec2D(48, -38), new Vec2D(41, -42)], [new Vec2D(19, -49.5),new Vec2D(13, -54.5)], [new Vec2D(13, -54.5), new Vec2D(10, -62)]
         ,[new Vec2D(10, -62), new Vec2D(8.8, -72)], [new Vec2D(8.8, -72), new Vec2D(8.8, -150)]],
  startingPoint: [new Vec2D(-41.25, 21), new Vec2D(41.25, 27), new Vec2D(0, 5.25), new Vec2D(0, 48)],
  startingFace: [1, -1, -1, 1],
  respawnPoints: [new Vec2D(0, 63.75), new Vec2D(0, 63.75), new Vec2D(0, 63.75), new Vec2D(0, 63.75)],
  respawnFace: [1, 1, 1, 1],
  blastzone: new Box2D([-198.75, -146.25], [198.75, 202.5]),
  ledge: [["ground", 0, 0], ["ground", 4, 1]],
  ledgePos: [new Vec2D(-66.35, 0.62), new Vec2D(66.35, 0.62)],
  scale: 5,
  offset: [600, 450],
  connected : [ [ ["g",0],["g",1],["g",2],["g",3],["g",4]]],
  movingPlat: -1,
  movingPlatforms: function () {
  }
};