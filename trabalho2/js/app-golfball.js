"use strict";

// Important references
// https://threejs.org/docs/index.html#api/en/renderers/webgl/WebGLProgram
// https://threejs.org/docs/index.html#manual/en/introduction/How-to-use-WebGL2
// http://paulbourke.net/dataformats/mtl/

// these need to be accessed inside more than one function so we'll declare them first
let container;
let camera;
let postCamera;
let controls;
let renderer;
let renderTarget;
let scene;
let postScene;
let gui;
let gBufferMaterial;
let materialInfo;
let postMaterial;
let model;
let postModel;
let lights;
let clock;
let postUniforms;
let gBufferUniforms

let enableRotModel = false;

// FIXME: Remove when everything is working
const useOnlyGBufferFS = false;


// Injecting text code inside the element
function injectTextIntoPage() {

  let tgvs = document.getElementById("gvs").textContent;
  let gvsContainer = document.getElementById("gbuffer-vertex-shader-code");
  gvsContainer.textContent = tgvs;

  let tgfs = document.getElementById("gfs").textContent;
  let gfsContainer = document.getElementById("gbuffer-fragment-shader-code");
  gfsContainer.textContent = tgfs;

  let tlvs = document.getElementById("render-vert").textContent;
  let lvsContainer = document.getElementById("lighting-vertex-shader-code");
  lvsContainer.textContent = tlvs;

  let tlfs = document.getElementById("render-frag").textContent;
  let lfsContainer = document.getElementById("lighting-fragment-shader-code");
  lfsContainer.textContent = tlfs;

}

// Next random functions come from:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random

// Getting a random number between two_values
function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

// Getting a random integer between two values, inclusive
// The maximum is inclusive and the minimum is inclusive 
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function init() {

  injectTextIntoPage();
  clock = new THREE.Clock();

  container = document.querySelector( '#scene-container' );

  scene = new THREE.Scene();
  // scene.background = new THREE.Color( 0x8FBCD4 );
  scene.background = new THREE.Color( 0xFFFFFF );
  // scene.background = new THREE.Color( 0x000000 );

  postScene = new THREE.Scene();
  postScene.background = new THREE.Color( 0x000000 );

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
  camera.position.set( 0, 0, 12.0 );

  postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

}

function createControls() {

  controls = new THREE.OrbitControls( camera, container );
  controls.minDistance = 5;
  controls.maxDistance = 13.5;

}

function createLights() {

  const pi = Math.PI;
  const numLights = 32;
  lights = new Array();
  for (let index = 0; index < numLights; index++) {

    // calculate slightly random offsets
    const time = Date.now() * 0.0005;
    const x = Math.sin(getRandomArbitrary(-pi, pi)) * getRandomArbitrary(-50.0, 50.0);
    const y = Math.cos(getRandomArbitrary(-pi, pi)) * getRandomArbitrary(-50.0, 50.0);
    const z = Math.cos(getRandomArbitrary(-pi, pi)) * getRandomArbitrary(-50.0, 50.0);

    // also calculate random color
    const r = getRandomArbitrary(0.1, 1.0); // between 0.1 and 1.0
    const g = getRandomArbitrary(0.1, 1.0); // between 0.1 and 1.0
    const b = getRandomArbitrary(0.1, 1.0); // between 0.1 and 1.0

    const color = new THREE.Color(r,g,b);

    const intensity = 0.08 + 1.0/numLights;
    const pointLight = new THREE.PointLight(color, intensity);
    pointLight.position.set( x, y, z);
    pointLight.startPos = { x:x, y:y, z:z }

    lights.push(pointLight);
    scene.add( pointLight.clone() );
    postScene.add( pointLight );
    
  }

}

function createMaterial() {

  const mi = materialInfo;
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load( materialInfo.bumpTex );
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  gBufferUniforms = {}
  gBufferUniforms.kd = new THREE.Uniform();
  gBufferUniforms.bumpTex = new THREE.Uniform();
  gBufferUniforms.maskColor = new THREE.Uniform();

  // Tip from: https://github.com/mrdoob/three.js/issues/8016#issuecomment-194935980
  gBufferUniforms = THREE.UniformsUtils.merge([gBufferUniforms, THREE.UniformsLib['lights']]);
  gBufferUniforms.bumpTex.value = texture;
  gBufferUniforms.kd.value = new THREE.Vector4(mi.kd[0], mi.kd[1], mi.kd[2], 1.0);
  gBufferUniforms.maskColor.value = new THREE.Vector4(0.0, 0.0, 0.0, 1.0);

  gBufferMaterial = new THREE.ShaderMaterial({
    uniforms: gBufferUniforms,
    vertexShader: document.getElementById("gvs").textContent.trim(),
    fragmentShader: document.getElementById("gfs").textContent.trim(),
    // vertexShader: document.getElementById("gbuffer-vert").textContent.trim(),
    // fragmentShader: document.getElementById("gbuffer-frag").textContent.trim(),
    lights: useOnlyGBufferFS,
    vertexTangents: true, // https://threejs.org/docs/#api/en/materials/Material.vertexTangents
    defines: {
      TRY_ON_GBUFFER_FS: useOnlyGBufferFS,
    },
  });


  // MRT
  postUniforms = {
    tColor: {
      value: renderTarget.textures[0]
    },
    tNormalMap: {
      value: renderTarget.textures[1]
    },
    tPosition: {
      value: renderTarget.textures[2]
    },
    tNormal: {
      value: renderTarget.textures[3]
    },
    tDepth: {
      value: renderTarget.depthTexture 
    },
  }
  postUniforms.ka = new THREE.Uniform();
  postUniforms.kd = new THREE.Uniform();
  postUniforms.ks = new THREE.Uniform();
  postUniforms.shi = new THREE.Uniform();
  postUniforms.cameraPos = new THREE.Uniform();
  postUniforms.gBufferToShow = new THREE.Uniform();
  postUniforms.maskColor = new THREE.Uniform();
  postUniforms.backgroundColor = new THREE.Uniform();
  postUniforms.useMaskColor = new THREE.Uniform();
  
  
  // Tip from: https://github.com/mrdoob/three.js/issues/8016#issuecomment-194935980
  postUniforms = THREE.UniformsUtils.merge([postUniforms, THREE.UniformsLib['lights']]);
  postUniforms.tColor.value = renderTarget.textures[0];
  postUniforms.tNormalMap.value = renderTarget.textures[1];
  postUniforms.tPosition.value = renderTarget.textures[2];
  postUniforms.tNormal.value = renderTarget.textures[3];
  postUniforms.tDepth.value = renderTarget.depthTexture;
  postUniforms.ka.value = new THREE.Vector4(0.0,0.0,0.0,0.0); //(mi.ka[0], mi.ka[1], mi.ka[2], 1.0);
  postUniforms.kd.value = new THREE.Vector4(1.0,1.0,1.0,1.0); //(mi.kd[0], mi.kd[1], mi.kd[2], 1.0);
  postUniforms.ks.value = new THREE.Vector4(mi.ks[0], mi.ks[1], mi.ks[2], 1.0);
  postUniforms.shi.value = mi.ns/0.4;
  postUniforms.cameraPos.value = camera.position;
  postUniforms.gBufferToShow.value = 0;
  postUniforms.maskColor.value = new THREE.Vector4(0.0, 0.0, 0.0, 1.0);
  postUniforms.backgroundColor.value = new THREE.Vector4(1.0, 1.0, 1.0, 1.0);
  postUniforms.useMaskColor.value = true;

  postMaterial = new THREE.ShaderMaterial({
    vertexShader: document.getElementById('render-vert').textContent.trim(),
    fragmentShader: document.getElementById('render-frag').textContent.trim(),
    uniforms: postUniforms,
    lights: true
  });

  // FIXME: Create a function for that?
  const mesh = new THREE.Mesh( new THREE.PlaneGeometry(2,2), postMaterial );
  postScene.add(mesh);
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

  // Create a multi render target with Float buffers
  renderTarget = new THREE.WebGLMultiRenderTarget(
    container.clientWidth, container.clientHeight,
    4);
  renderTarget.texture.format = THREE.RGBAFormat;
  renderTarget.texture.minFilter = THREE.NearestFilter;
  renderTarget.texture.magFilter = THREE.NearestFilter;
  renderTarget.texture.type = THREE.FloatType;
  renderTarget.texture.generateMipmaps = false;
  renderTarget.stencilBuffer = false;
  renderTarget.depthBuffer = true;
  renderTarget.depthTexture = new THREE.DepthTexture();
  renderTarget.depthTexture.format = THREE.DepthFormat;
  renderTarget.depthTexture.type = THREE.FloatType;

  // Name G-Buffer attachments for debugging
  renderTarget.textures[0].name = 'diffuse';
  renderTarget.textures[1].name = 'normal';
  renderTarget.textures[2].name = 'position';

  container.appendChild( renderer.domElement );

}

// perform any updates to the scene, called once per frame
// avoid heavy computation here
function update() {

  // Don't delete this function!

  if (typeof(model) !== 'undefined') {
    if (enableRotModel) {
      model.rotation.y += 0.01;
    }
    postUniforms.cameraPos.value = camera.position;
  }
  
  const time = Date.now() * 0.0005;
  lights.forEach(light => {
    
    light.position.x = Math.sin(time * 0.7) * light.startPos.x;
    light.position.y = Math.cos(time * 0.5) * light.startPos.y;
    light.position.z = Math.cos(time * 0.4) * light.startPos.z;
    
  });
  
  
}

// render, or 'draw a still image', of the scene
function render() {
  
  if (useOnlyGBufferFS) {
    renderer.render( scene, camera );
  } else {
    // render scene into target
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    
    // render post FX
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }
  
}

// 
function createGui() {
  
  let gui = new dat.GUI();

  let params = {
    'Show': 0,
    'Rotate': false,
    'Use Mask': true,
    'Mask' : "#000000",
    'Background': "#FFFFFF",
    'Shiness': 250.0,
    'Intensity': 0.11125,
  };  
  
  // let gbFolder = gui.addFolder("G-Buffer");

  let gBufferToShow = gui.add(params, 'Show', { 
    'Final color': 0, 
    'Position': 1,
    'Normal map': 2,
    'Vertex normal':3,
    'Vertex color (mask)':4,
    'Depth':5 
  });

  gBufferToShow.onChange( function (val) {
    postUniforms.gBufferToShow.value = val;
  });

  gui.addColor(params, 'Mask', "#000000").onChange( function (color) {
    const c = new THREE.Color(color)
    const maskColor = new THREE.Vector4(c.r, c.g, c.b, c.a);
    gBufferUniforms.maskColor.value = maskColor;
    postUniforms.maskColor.value = maskColor;
    
  });

  gui.addColor(params, 'Background', "#FFFFFF").onChange( function (color) {
    const c = new THREE.Color(color)
    const backgroundColor = new THREE.Vector4(c.r, c.g, c.b, c.a);
    postUniforms.backgroundColor.value = backgroundColor;
    
  });

  gui.add(params, 'Shiness', 250.0).min(0).onChange( function (val) {
    postUniforms.shi.value = val;
  });

  gui.add(params, 'Intensity', 0.0, 1.0).step(0.01).onChange( function (val) {
    lights.forEach(light => {
      light.intensity = val;
    });
  });

  gui.add(params, 'Rotate', false).onChange( function (val) {
    enableRotModel = val;
  });

  gui.add(params, 'Use Mask', false).onChange( function (val) {
    postUniforms.useMaskColor.value = val;
  });
}

//
function loadModelAndMaterial() {

  // Load the model and generate its indices
  const objLoader = new THREE.OBJLoader2();
  objLoader.setUseIndices(true);

  // A reusable function to set up the models. We're passing in a position parameter
  // so that they can be individually placed around the scene
  const onObjLoad = ( obj, position ) => {

    createMaterial();
    
    model = obj.detail.loaderRootNode.children[0];
    model.position.copy( position );
    model.material = gBufferMaterial;
    
    // https://github.com/mrdoob/three.js/issues/12402
    // https://threejs.org/docs/#examples/utils/BufferGeometryUtils
    THREE.BufferGeometryUtils.computeTangents( model.geometry );

    scene.add( model );

  };

  const mtlLoader = new THREE.MTLLoader();
  const onMTLLoad = (mtl) => {
    const info = mtl.materialsInfo.Default;

    materialInfo = {
      bumpTex: mtl.baseUrl + info.map_bump,
      d: info.d,    // halo factor: dissolve = 1.0 - (N*v)(1.0-factor)
      ka: info.ka,  // ambient
      kd: info.kd,  // diffuse
      ke: info.ke,  // ???
      ks: info.ks,  // specular
      ns: info.ns   // Specular expoent
    }

    // load the first model. Each model is loaded asynchronously,
    // so don't make any assumption about which one will finish loading first
    const golfballPosition = new THREE.Vector3( 0, 0, 0 );
    objLoader.load( 'models/golfball/golfball.obj', obj => onObjLoad( obj, golfballPosition ), onProgress, onError );
  }

  // the loader will report the loading progress to this function
  const onProgress = () => {};

  // the loader will send any error messages to this function, and we'll log
  // them to to console
  const onError = ( errorMessage ) => { console.log( errorMessage ); };

  mtlLoader.load( 'models/golfball/golfball.mtl', mtl => onMTLLoad( mtl ), onProgress, onError );

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
  renderTarget.setSize( container.clientWidth, container.clientHeight );

}

window.addEventListener( 'resize', onWindowResize );

// call the init function to set everything up
init();