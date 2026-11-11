import{test}from'node:test';import assert from'node:assert/strict';import{volcanoHeight as h}from'../volcano.js';
test('bounded deterministic volcano has a depressed crater and continuous flank',()=>{
 for(let z=-570;z<=570;z+=9)for(let x=-570;x<=570;x+=9){assert(Number.isFinite(h(x,z)));assert(h(x,z)>=-3&&h(x,z)<170);assert.equal(h(x,z),h(x,z));}
 assert(h(0,20)>h(0,0));assert(h(0,80)>h(0,180));assert(h(0,180)>h(0,300));
 for(let x=-300;x<300;x++){assert(Math.abs(h(x+.01,180)-h(x,180))<.1);}
});
