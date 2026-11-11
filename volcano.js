/* An illustrative ash-and-lava flank, not surveyed topography or a live eruption.
   Morphology reference: Smithsonian GVP Asunción 284150, checked 2026-11-11. */
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
export function volcanoHeight(x,z){
 const a=Math.atan2(z,x),r=Math.hypot(x*.94,z*1.06),edge=245*(1+.11*Math.sin(a-.7)+.055*Math.sin(a*3)+.018*Math.sin(a*7));
 const radial=Math.max(0,1-r/edge),cone=165*Math.pow(radial,1.06);
 const rough=(Math.sin(x*.23+z*.19)*Math.sin(z*.31-x*.13)*1.5+Math.sin(x*.73+z*.59)*.35)*smooth(20,70,r)*(1-smooth(220,300,r));
 const grooves=(Math.sin(a*41+Math.sin(r*.045))*.5+Math.sin(a*73+r*.012)*.2)*3.2*smooth(16,80,r)*(1-smooth(245,290,r));
 const crater=22*(1-smooth(5,25,r));
 const scar=10*Math.exp(-Math.pow((a-1.1)/.25,2))*smooth(35,90,r)*(1-smooth(200,270,r));
 return Math.max(-3,cone+grooves+rough-crater-scar+1.5-5*smooth(300,365,r)+(Math.sin(x*.065)*Math.sin(z*.047))*.9*smooth(30,100,r));
}
export function createVolcanoWorld(T){
 const group=new T.Group();group.visible=false;
 const N=300,R=430,p=[],idx=[],colors=[];
 for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=(i/N*2-1)*R,z=(j/N*2-1)*R;p.push(x,volcanoHeight(x,z),z);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;idx.push(a,a+N+1,a+1,a+1,a+N+1,a+N+2)}
 g.setIndex(idx);g.computeVertexNormals();const normals=g.attributes.normal;
 const ash=new T.Color('#89867f'),lava=new T.Color('#363b3c'),c=new T.Color();
 for(let i=0;i<p.length/3;i++){const x=p[i*3],y=p[i*3+1],z=p[i*3+2],a=Math.atan2(z,x),noise=.5+.18*Math.sin(x*.37+z*.29)+.17*Math.sin(x*.91-z*.73)+.15*Math.sin(x*2.7+z*1.89),flow=Math.pow(.5+.5*Math.sin(a*23+Math.sin(Math.hypot(x,z)*.025)*.9),5);
 c.copy(ash).lerp(lava,.25+flow*.5).multiplyScalar((.8+noise*.28)*(.6+.6*Math.max(0,normals.getX(i)*-.45+normals.getY(i)*.75+normals.getZ(i)*.3)));colors.push(c.r,c.g,c.b);}
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));group.add(new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true})));
 // A quiet ocean gives every turn a continuous horizon.
 const seaMat=new T.MeshBasicMaterial({color:'#638a8b'});
 seaMat.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vSea;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSea=position;');shader.fragmentShader='varying vec3 vSea;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float ripple=sin(vSea.x*.14+sin(vSea.y*.1)*1.8)*sin(vSea.y*.8+vSea.x*.09);
 float glint=pow(max(0.,sin(vSea.y*.43+sin(vSea.x*.06)*3.)),16.);
 diffuseColor.rgb*=.96+ripple*.025+glint*.075;`);};
 const ocean=new T.Mesh(new T.CircleGeometry(1400,192),seaMat);ocean.rotation.x=-Math.PI/2;ocean.position.y=-.8;group.add(ocean);
 let seed=8817;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const rock=new T.IcosahedronGeometry(1,1),v=rock.attributes.position;for(let i=0;i<v.count;i++){const k=.8+rand()*.3;v.setXYZ(i,v.getX(i)*k,v.getY(i)*k*.7,v.getZ(i)*k)}rock.computeVertexNormals();
 const count=1100,batch=new T.InstancedMesh(rock,new T.MeshBasicMaterial({color:'#4b443b'}),count),d=new T.Object3D();
 for(let i=0;i<count;i++){const a=rand()*6.28,r=40+Math.sqrt(rand())*270,x=Math.cos(a)*r,z=Math.sin(a)*r,s=.15+Math.pow(rand(),3)*2.5;d.position.set(x,volcanoHeight(x,z)+s*.2,z);d.scale.set(s,s,s*(.7+rand()*.6));d.rotation.set(rand(),rand()*6.28,rand());d.updateMatrix();batch.setMatrixAt(i,d.matrix);batch.setColorAt(i,new T.Color().setHSL(.08,.08,.5+rand()*.25));}batch.computeBoundingSphere();group.add(batch);
 return{group,heightAt:volcanoHeight,update(){}};
}
