"use strict";

// Important references
// https://threejs.org/docs/index.html#api/en/renderers/webgl/WebGLProgram
// https://threejs.org/docs/index.html#manual/en/introduction/How-to-use-WebGL2
// http://paulbourke.net/dataformats/mtl/

// these need to be accessed inside more than one function so we'll declare them first
let container;
let camera;
let controls;
let renderer;
let scene;
let gui;
let material;
let materialInfo;
let model;

function init() {

  container = document.querySelector( '#scene-container' );

  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0x8FBCD4 );

  createCamera();
  createControls();
  createLights();
  loadModelAndMaterial();
  createRenderer();
  createGui();

  // start the animation loop
  renderer.setAnimationLoop( () => {

    update();
    render();

  } );

}

function createCamera() {

  camera = new THREE.PerspectiveCamera(
    45, // FOV
    container.clientWidth / container.clientHeight, // aspect
    0.1, // near clipping plane
    100, // far clipping plane
  );

  camera.position.set( 0, 0, 1.0 );

}

function createControls() {

  controls = new THREE.OrbitControls( camera, container );
  controls.minDistance = 1;
  controls.maxDistance = 3.5;

}

function createLights() {

  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set( 0.0, 0.0, 10.1 );

  const pointLightHelper = new THREE.PointLightHelper(pointLight);

  scene.add( pointLight, pointLightHelper );

}

function createMaterial() {


  let uniforms = {}
  const mi = materialInfo;
  uniforms.ka = new THREE.Uniform(new THREE.Vector4(mi.ka[0], mi.ka[1], mi.ka[2], 1.0));
  uniforms.kd = new THREE.Uniform(new THREE.Vector4(mi.kd[0], mi.kd[1], mi.kd[2], 1.0));
  uniforms.ks = new THREE.Uniform(new THREE.Vector4(mi.ks[0], mi.ks[1], mi.ks[2], 1.0));

  uniforms.shi = {
    type: 'float',
    value: mi.ns
  }

  const textureLoader = new THREE.TextureLoader();
  
  const bumpTex = textureLoader.load( materialInfo.bumpTex );
  const diffuseTex = textureLoader.load( materialInfo.diffuseTex );

  uniforms.bumpTex = { 
    type: "t",
    value: bumpTex 
  } 

  uniforms.diffuseTex = { 
    type: "t",
    value: diffuseTex 
  } 

  // Tip from: https://github.com/mrdoob/three.js/issues/8016#issuecomment-194935980
  uniforms = THREE.UniformsUtils.merge([uniforms, THREE.UniformsLib['lights']]);
  uniforms.bumpTex.value = bumpTex;
  uniforms.diffuseTex.value = diffuseTex;
  

  material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: document.getElementById("vs").textContent.trim(),
    fragmentShader: document.getElementById("fs").textContent.trim(),
    lights: true,
  });

}

function createRenderer() {

  if (WEBGL.isWebGL2Available() == false) {
    document.body.appendChild(WEBGL.getWebGL2ErrorMessage());
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2');

  renderer = new THREE.WebGLRenderer( { 
    antialias: true,
    canvas: canvas,
    context: context
  } );

  renderer.setSize( container.clientWidth, container.clientHeight );

  renderer.setPixelRatio( window.devicePixelRatio );

  renderer.gammaFactor = 2.2;
  renderer.gammaOutput = true;

  renderer.physicallyCorrectLights = true;

  container.appendChild( renderer.domElement );

}

// perform any updates to the scene, called once per frame
// avoid heavy computation here
function update() {

  // Don't delete this function!

  if (typeof(model) !== 'undefined') {
    // model.rotation.y += 0.01;
  }
}

// render, or 'draw a still image', of the scene
function render() {

  renderer.render( scene, camera );

}

// 
function createGui() {
  
  gui = new dat.GUI();
  const params = {
    // 'light color': spotLight.color.getHex(),
  };

  gui.open();
}

//
function loadModelAndMaterial() {

  const objLoader = new THREE.OBJLoader();

  // A reusable function to set up the models. We're passing in a position parameter
  // so that they can be individually placed around the scene
  const onObjLoad = ( obj, position ) => {

    createMaterial();
    
    model = obj.children[0];
    model.position.copy( position );
    model.material = material;

    scene.add( model );

  };

  const mtlLoader = new THREE.MTLLoader();
  const onMTLLoad = (mtl) => {
    const info = mtl.materialsInfo.Default;

    materialInfo = {
      bumpTex: mtl.baseUrl + info.map_bump,
      ambientTex: mtl.baseUrl + info.map_ka,
      diffuseTex: mtl.baseUrl + info.map_kd,
      d: info.d,    // halo factor: dissolve = 1.0 - (N*v)(1.0-factor)
      ka: info.ka,  // ambient
      kd: info.kd,  // diffuse
      ke: info.ke,  // ???
      ks: info.ks,  // specular
      ns: info.ns   // Specular expoent
    }

    // load the first model. Each model is loaded asynchronously,
    // so don't make any assumption about which one will finish loading first
    const stonesPosition = new THREE.Vector3( -0.5, -0.5, 0 );
    objLoader.load( 'models/stones/stones.obj', obj => onObjLoad( obj, stonesPosition ), onProgress, onError );
  }

  // the loader will report the loading progress to this function
  const onProgress = () => {};

  // the loader will send any error messages to this function, and we'll log
  // them to to console
  const onError = ( errorMessage ) => { console.log( errorMessage ); };

  mtlLoader.load( 'models/stones/stones.mtl', mtl => onMTLLoad( mtl ), onProgress, onError );

}


// a function that will be called every time the window gets resized.
// It can get called a lot, so don't put any heavy computation in here!
function onWindowResize() {

  // set the aspect ratio to match the new browser window aspect ratio
  camera.aspect = container.clientWidth / container.clientHeight;

  // update the camera's frustum
  camera.updateProjectionMatrix();

  // update the size of the renderer AND the canvas
  renderer.setSize( container.clientWidth, container.clientHeight );

}

window.addEventListener( 'resize', onWindowResize );

// call the init function to set everything up
init();