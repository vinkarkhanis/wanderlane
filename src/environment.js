import * as THREE from 'three';

// Sky dome, sun/hemisphere/ambient lights, and day/night transitions.
export class Environment {
  constructor(scene) {
    this.scene = scene; this.isDay = true;
    this.skyU = { top:{ value:new THREE.Color(0x3a78c8) }, bot:{ value:new THREE.Color(0xbfe0f0) } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2000,32,16), new THREE.ShaderMaterial({ side:THREE.BackSide, uniforms:this.skyU,
      vertexShader:`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 p;uniform vec3 top,bot;void main(){float h=normalize(p).y*.5+.5;gl_FragColor=vec4(mix(bot,top,clamp(h,0.,1.)),1.);}` }));
    scene.add(sky);
    this.sun = new THREE.DirectionalLight(0xfff2d8,2.2); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048,2048);
    const c = this.sun.shadow.camera; c.left=-70; c.right=70; c.top=70; c.bottom=-70; this.sun.shadow.bias=-.0003;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfe0f0,0x4b6a3a,.9); scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff,.25); scene.add(this.amb);
  }
  toggle() { this.isDay = !this.isDay; return this.isDay; }
  update(px, pz, fogHex) {
    this.sun.position.set(px+80, this.isDay?180:70, pz-120); this.sun.target.position.set(px,0,pz);
    this.sun.intensity = this.isDay?2.2:.4; this.sun.color.setHex(this.isDay?0xfff2d8:0x6688cc);
    this.hemi.intensity = this.isDay?.9:.25; this.amb.intensity = this.isDay?.25:.12;
    const sk = new THREE.Color(fogHex);
    if (this.isDay) { this.skyU.top.value.setHex(0x3a78c8); this.skyU.bot.value.copy(sk); }
    else { this.skyU.top.value.setHex(0x05080f); this.skyU.bot.value.setHex(0x1a2230); }
    this.scene.fog = new THREE.Fog(this.isDay?sk.getHex():0x10141c, 60, this.isDay?900:420);
  }
}
