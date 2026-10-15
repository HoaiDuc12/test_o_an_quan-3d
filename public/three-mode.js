import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

/** Optional, lazy-loaded 3D preview. Gameplay and legality remain server-authoritative.
 * Optimized for mobile: one instanced stone draw call, no realtime shadows or post-processing.
 */
export async function makeThreeView(host,onSelect){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.15:1.65));
 host.appendChild(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#305246');
 const camera=new THREE.PerspectiveCamera(37,1,.1,100);camera.position.set(0,12.2,14);
 const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,0,0);orbit.enableDamping=true;orbit.enablePan=false;orbit.maxPolarAngle=1.32;orbit.minPolarAngle=.18;orbit.minDistance=10;orbit.maxDistance=25;
 scene.add(new THREE.HemisphereLight(0xe0f1e7,0x422c1f,2.3));
 const key=new THREE.DirectionalLight(0xffd3a0,3.1);key.position.set(-9,13,7);scene.add(key);
 const fill=new THREE.PointLight(0xffac61,29,25,2);fill.position.set(7,6,-6);scene.add(fill);
 let seed=2161;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const c=document.createElement('canvas');c.width=512;c.height=256;const cx=c.getContext('2d');cx.fillStyle='#835438';cx.fillRect(0,0,512,256);
 for(let i=0;i<210;i++){const y=rnd()*256;cx.strokeStyle=rnd()<.5?'#50291a53':'#d0a47743';cx.lineWidth=.35+rnd()*2.1;cx.beginPath();cx.moveTo(0,y);cx.bezierCurveTo(120,y+rnd()*8,330,y-rnd()*8,512,y);cx.stroke();}
 const grain=new THREE.CanvasTexture(c);grain.colorSpace=THREE.SRGBColorSpace;
 const materials={base:new THREE.MeshStandardMaterial({color:0x442819,roughness:.82}),wood:new THREE.MeshStandardMaterial({map:grain,color:0xe6c5a4,roughness:.59,metalness:.02}),gold:new THREE.MeshStandardMaterial({color:0xd6a368,roughness:.37,metalness:.42}),inside:new THREE.MeshStandardMaterial({color:0x493020,roughness:1}),stone:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.68}),jade:new THREE.MeshPhysicalMaterial({color:0x8fc4a6,roughness:.24,clearcoat:.6,clearcoatRoughness:.25})};
 function block(w,h,d,x,y,z,m){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);scene.add(mesh);return mesh;}
 block(17.3,.72,7.65,0,-.42,0,materials.base);block(17.1,.30,7.45,0,-.05,0,materials.wood);
 for(const z of [-3.71,3.71])block(17.5,.15,.16,0,.13,z,materials.gold);
 for(const x of [-8.58,8.58])block(.17,.15,7.55,x,.13,0,materials.gold);
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0x284839,roughness:1}));plane.rotation.x=-Math.PI/2;plane.position.y=-.85;scene.add(plane);
 const positions=[];
 for(let i=0;i<5;i++)positions.push(new THREE.Vector3(-5.34+i*2.67,.13,1.73));
 positions.push(new THREE.Vector3(7.48,.13,0));
 for(let i=0;i<5;i++)positions.push(new THREE.Vector3(5.34-i*2.67,.13,-1.73));
 positions.push(new THREE.Vector3(-7.48,.13,0));
 const rings=[],hits=[],labels=[];
 for(let i=0;i<12;i++){
  const quan=i===5||i===11,r=quan?1.06:.89,p=positions[i];
  const floor=new THREE.Mesh(new THREE.CircleGeometry(r,40),materials.inside);floor.rotation.x=-Math.PI/2;floor.position.set(p.x,.109,p.z);scene.add(floor);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.085,8,56),materials.gold.clone());ring.rotation.x=Math.PI/2;ring.position.set(p.x,.17,p.z);scene.add(ring);rings.push(ring);
  const marker=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.2,32),new THREE.MeshBasicMaterial({visible:false}));marker.position.set(p.x,.17,p.z);marker.userData.pit=i;scene.add(marker);hits.push(marker);
  const text=document.createElement('div');text.className='count-3d';text.setAttribute('aria-hidden','true');host.appendChild(text);labels.push(text);
 }
 block(12,.016,.02,0,.128,0,materials.gold);
 const stoneGeo=new THREE.IcosahedronGeometry(.18,1);
 const stoneMesh=new THREE.InstancedMesh(stoneGeo,materials.stone,165);stoneMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);stoneMesh.frustumCulled=false;scene.add(stoneMesh);
 const mandarinGeo=new THREE.DodecahedronGeometry(.44,1);
 const mandarinMesh=new THREE.InstancedMesh(mandarinGeo,materials.jade,2);mandarinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mandarinMesh.frustumCulled=false;scene.add(mandarinMesh);
 const dummy=new THREE.Object3D();const shades=[0x93ad9b,0xc6a18c,0xd7d4b7,0x8b9a8c,0xaec6bb].map(c=>new THREE.Color(c));
 let active=false,raf=0,selected=-1,seat=null,cells=Array(12).fill(null),canSelect=()=>false,lastDraw=0;
 function update(){
  let n=0,q=0;
  for(let i=0;i<12;i++){
   const cell=cells[i];if(!cell)continue;const p=positions[i];
   const num=Math.min(cell.n,12),larger=i===5||i===11;
   for(let k=0;k<num&&n<165;k++){
    const a=k*2.399963+i*.27;const rad=Math.sqrt((k+.4)/Math.max(9,num+2))*(larger?.66:.57);
    dummy.position.set(p.x+Math.cos(a)*rad,.22+Math.floor(k/9)*.26,p.z+Math.sin(a)*rad);
    const s=.86+((k*17+i*11)%5)*.06;dummy.scale.set(s,.73+s*.06,s);dummy.rotation.set(k*.45,k*.71,k*.19);dummy.updateMatrix();stoneMesh.setMatrixAt(n,dummy.matrix);stoneMesh.setColorAt(n,shades[(k+i*2)%5]);n++;
   }
   if(cell.q&&q<2){dummy.position.set(p.x,.45,p.z);dummy.scale.setScalar(.9);dummy.rotation.set(i,.4,i*.2);dummy.updateMatrix();mandarinMesh.setMatrixAt(q++,dummy.matrix);}
   const chosen=selected===i,valid=canSelect(i);
   rings[i].material.color.set(chosen?0xffe5a4:valid?0xe5c184:0xa17c55);
   rings[i].material.emissive=new THREE.Color(chosen?0x7a460e:valid?0x2f1e08:0x0a0907);
   rings[i].material.emissiveIntensity=chosen?.7:valid?.35:.08;
   labels[i].textContent=[5,11].includes(i)?(cell.q?cell.q+' Quan':String(cell.n)):String(cell.n);
  }
  stoneMesh.count=n;mandarinMesh.count=q;stoneMesh.instanceMatrix.needsUpdate=true;if(stoneMesh.instanceColor)stoneMesh.instanceColor.needsUpdate=true;mandarinMesh.instanceMatrix.needsUpdate=true;
 }
 function reposition(){const r=host.getBoundingClientRect();if(!r.width||!r.height)return;
  camera.updateMatrixWorld();positions.forEach((p,i)=>{const v=p.clone();v.y=1.03;v.project(camera);labels[i].style.left=(v.x*.5+.5)*r.width+'px';labels[i].style.top=(-v.y*.5+.5)*r.height+'px';labels[i].style.display=v.z<1?'':'none';});
 }
 function render(time){if(!active)return;raf=requestAnimationFrame(render);if(document.hidden || time-lastDraw<33)return;lastDraw=time;orbit.update();reposition();renderer.render(scene,camera);}
 let down;
 renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});
 renderer.domElement.addEventListener('pointerup',e=>{
  if(!down || Math.hypot(e.clientX-down.x,e.clientY-down.y)>10)return;
  const rect=renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(hits,false)[0];if(hit)onSelect(hit.object.userData.pit);
 });
 const api={
  start(){active=true;cancelAnimationFrame(raf);api.resize();raf=requestAnimationFrame(render);},
  stop(){active=false;cancelAnimationFrame(raf);},
  reset(){camera.position.set(0,12.2,14);orbit.target.set(0,0,0);orbit.update();},
  resize(){if(host.hidden)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();reposition();},
  setState(nextCells,nextSelected,nextSeat,nextCanSelect){cells=nextCells;selected=nextSelected;seat=nextSeat;canSelect=nextCanSelect;update();},
  dispose(){api.stop();labels.forEach(e=>e.remove());renderer.dispose();orbit.dispose();renderer.domElement.remove();}
 };
 return api;
}
