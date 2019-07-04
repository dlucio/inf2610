"use strict";

// Important references
// https://threejs.org/docs/index.html#api/en/renderers/webgl/WebGLProgram
// https://threejs.org/docs/index.html#manual/en/introduction/How-to-use-WebGL2
// https://threejs.org/docs/index.html#api/en/constants/Textures
// http://paulbourke.net/dataformats/mtl/

// these need to be accessed inside more than one function so we'll declare them first
let container;
let camera;
let postCamera;
let controls;
let renderer;
let gBufferRenderTarget;
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

// For SSAO 
let ssaoMaterial;
let ssaoUniforms;
let ssaoScene;
let ssaoRenderTarget;
let kernelRadius = 8;
let kernelSize = 32;
let kernel = [];
let noiseTexture = null;
let output = 0;
let minDistance = 0.005;
let maxDistance = 0.1;

let enableRotModel = false;

// Enable/Disable random light colors and light animations
let lightFX = false;


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

// Linear interpolation between a and b
Math.lerp = (t, a, b) => {
  return a + t * ( b - a );
}

function init() {

  injectTextIntoPage();
  clock = new THREE.Clock();

  container = document.querySelector( '#scene-container' );

  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xFFFFFF );

  ssaoScene = new THREE.Scene();
  ssaoScene.background = new THREE.Color( 0x000000 );

  postScene = new THREE.Scene();
  postScene.background = new THREE.Color( 0x000000 );

  createCamera();
  createControls();
  createLights();
  loadModelAndMaterial();
  createRenderer();
  createGui();

  prepareSSAO();

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
    1000, // far clipping plane
  );
  camera.position.set( 50, 70, 95.0 );

  postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

}

function createControls() {

  controls = new THREE.OrbitControls( camera, container );
  controls.minDistance = 1;
  // controls.maxDistance = 230.5;

}

function createLights() {

  const pi = Math.PI;
  const numLights = 32;
  lights = new Array();
  for (let index = 0; index < numLights; index++) {

    // TODO: Colocar as luzes em volta do cenário, usando coordenadas esféricas

    // calculate slightly random offsets
    const time = Date.now() * 0.0005;
    const x = Math.sin(getRandomArbitrary(-pi, pi)) * getRandomArbitrary(-450.0, 450.0);
    const y = Math.cos(getRandomArbitrary(-pi, pi)) * getRandomArbitrary(-450.0, 450.0);
    const z = Math.cos(getRandomArbitrary(-pi, pi)) * getRandomArbitrary(-450.0, 450.0);

    let r = 1.0;
    let g = 1.0;
    let b = 1.0;
    if (lightFX) {
      // also calculate random color
      r = getRandomArbitrary(0.1, 1.0); // between 0.1 and 1.0
      g = getRandomArbitrary(0.1, 1.0); // between 0.1 and 1.0
      b = getRandomArbitrary(0.1, 1.0); // between 0.1 and 1.0
    }

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
  gBufferUniforms.kd.value = new THREE.Vector4(1.0, 1.0, 1.0, 1.0);
  gBufferUniforms.maskColor.value = new THREE.Vector4(0.0, 0.0, 0.0, 1.0);

  gBufferMaterial = new THREE.ShaderMaterial({
    uniforms: gBufferUniforms,
    vertexShader: document.getElementById("gvs").textContent.trim(),
    fragmentShader: document.getElementById("gfs").textContent.trim(),
    lights: false,
    vertexTangents: true, // https://threejs.org/docs/#api/en/materials/Material.vertexTangents
  });


  // MRT (Multiple Render Target)
  postUniforms = {
    tColor: {
      value: gBufferRenderTarget.textures[0]
    },
    tNormalMap: {
      value: gBufferRenderTarget.textures[1]
    },
    tPosition: {
      value: gBufferRenderTarget.textures[2]
    },
    tNormal: {
      value: gBufferRenderTarget.textures[3]
    },
    tDepth: {
      value: gBufferRenderTarget.depthTexture 
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
  postUniforms.useSpecular = new THREE.Uniform();
  
  
  // Tip from: https://github.com/mrdoob/three.js/issues/8016#issuecomment-194935980
  postUniforms = THREE.UniformsUtils.merge([postUniforms, THREE.UniformsLib['lights']]);
  postUniforms.tColor.value = gBufferRenderTarget.textures[0];
  postUniforms.tNormalMap.value = gBufferRenderTarget.textures[1];
  postUniforms.tPosition.value = gBufferRenderTarget.textures[2];
  postUniforms.tNormal.value = gBufferRenderTarget.textures[3];
  postUniforms.tDepth.value = gBufferRenderTarget.depthTexture;
  postUniforms.ka.value = new THREE.Vector4(0.0,0.0,0.0,0.0); //(mi.ka[0], mi.ka[1], mi.ka[2], 1.0);
  postUniforms.kd.value = new THREE.Vector4(1.0,1.0,1.0,1.0); //(mi.kd[0], mi.kd[1], mi.kd[2], 1.0);
  postUniforms.ks.value = new THREE.Vector4(1.0, 1.0, 1.0, 1.0);
  postUniforms.shi.value = 200.0; //materialInfo.ns/0.4;
  postUniforms.cameraPos.value = camera.position;
  postUniforms.gBufferToShow.value = 0;
  postUniforms.maskColor.value = new THREE.Vector4(0.0, 0.0, 0.0, 1.0);
  postUniforms.backgroundColor.value = new THREE.Vector4(1.0, 1.0, 1.0, 1.0);
  postUniforms.useMaskColor.value = true;
  postUniforms.useSpecular.value = false;

  postMaterial = new THREE.ShaderMaterial({
    vertexShader: document.getElementById('ssao-vs').textContent.trim(),
    fragmentShader: document.getElementById('render-frag').textContent.trim(),
    uniforms: postUniforms,
    lights: true
  });

  const mesh = new THREE.Mesh( new THREE.PlaneGeometry(2,2), postMaterial );
  postScene.add(mesh);
}

function createSSAOMaterial() {

  // const textureLoader = new THREE.TextureLoader();
  // const texture = textureLoader.load( materialInfo.bumpTex );
  // texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  gBufferUniforms = {}
  gBufferUniforms.kd = new THREE.Uniform();
  gBufferUniforms.bumpTex = new THREE.Uniform();
  gBufferUniforms.maskColor = new THREE.Uniform();

  // Tip from: https://github.com/mrdoob/three.js/issues/8016#issuecomment-194935980
  gBufferUniforms.maskColor.value = new THREE.Vector4(0.0, 0.0, 0.0, 1.0);

  gBufferMaterial = new THREE.ShaderMaterial({
    uniforms: gBufferUniforms,
    vertexShader: document.getElementById("geometry_vs").textContent.trim(),
    fragmentShader: document.getElementById("geometry_fs").textContent.trim(),
    lights: false,
    vertexTangents: true, // https://threejs.org/docs/#api/en/materials/Material.vertexTangents
  });


  
   // MRT (Multiple Render Target)
   ssaoUniforms = {
    gPosition: {
      value: gBufferRenderTarget.textures[1]
    },
    gNormal: {
      value: gBufferRenderTarget.textures[2]
    },
    texNoise: {
      value: noiseTexture
    },
    tDepth: {
      value: gBufferRenderTarget.depthTexture 
    },
    kernel: {
      type: "v3v",
      value: kernel
    },
    resolution: {
      type: "v2",
      value: new THREE.Vector2()
    },
    cameraNear: {
      value: 0.1
    },
    cameraFar: {
      value: 1000
    },
    cameraProjectionMatrix: {
      value: new THREE.Matrix4()
    },
    cameraInverseProjectionMatrix: {
      value: new THREE.Matrix4()
    },
    kernelRadius: {
      value: 8
    },
    minDistance: {
      value: 0.005
    },
    maxDistance: {
      value: 0.05
    }
  }
  // Tip from: https://github.com/mrdoob/three.js/issues/8016#issuecomment-194935980
  ssaoUniforms.gPosition.value = gBufferRenderTarget.textures[1];
  ssaoUniforms.gNormal.value = gBufferRenderTarget.textures[2];
  ssaoUniforms.tDepth.value = gBufferRenderTarget.depthTexture;
  ssaoUniforms.texNoise.value = noiseTexture;
  ssaoUniforms.kernel.value = kernel;
  ssaoUniforms.resolution.value.x = container.clientWidth;
  ssaoUniforms.resolution.value.y = container.clientHeight;
  ssaoUniforms.cameraNear.value = camera.near;
  ssaoUniforms.cameraFar.value = camera.far;
  ssaoUniforms.cameraProjectionMatrix.value = camera.projectionMatrix;
  ssaoUniforms.cameraInverseProjectionMatrix.value.getInverse( camera.projectionMatrix );
  ssaoUniforms.kernelRadius.value = 8;
  ssaoUniforms.minDistance.value = 0.005;
  ssaoUniforms.maxDistance.value = 0.05;

  ssaoMaterial = new THREE.ShaderMaterial({
    vertexShader: document.getElementById('ssao-vs').textContent.trim(),
    fragmentShader: document.getElementById('ssao-fs').textContent.trim(),
    uniforms: ssaoUniforms,
    lights: false,
    defines: {
      PERSPECTIVE_CAMERA: 1,
      KERNEL_SIZE: 32,
    }
  });
  const ssaoMesh = new THREE.Mesh( new THREE.PlaneGeometry(2,2), ssaoMaterial );
  ssaoScene.add(ssaoMesh);  





  // MRT (Multiple Render Target)
  postUniforms = {
    tColor: {
      value: gBufferRenderTarget.textures[0]
    },
    tPosition: {
      value: gBufferRenderTarget.textures[1]
    },
    tNormal: {
      value: gBufferRenderTarget.textures[2]
    },
    tDepth: {
      value: gBufferRenderTarget.depthTexture 
    },
    ssao: {
      value: ssaoRenderTarget.texture[0]
    }

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
  postUniforms.useSpecular = new THREE.Uniform();
  
  
  // Tip from: https://github.com/mrdoob/three.js/issues/8016#issuecomment-194935980
  postUniforms = THREE.UniformsUtils.merge([postUniforms, THREE.UniformsLib['lights']]);
  postUniforms.tColor.value = gBufferRenderTarget.textures[0];
  // postUniforms.tNormalMap.value = gBufferRenderTarget.textures[1]; FIXME
  postUniforms.tPosition.value = gBufferRenderTarget.textures[1];
  postUniforms.tNormal.value = gBufferRenderTarget.textures[2];
  postUniforms.tDepth.value = gBufferRenderTarget.depthTexture;
  postUniforms.ssao.value = ssaoRenderTarget.texture[0];
  // postUniforms.ssao.value = gBufferRenderTarget.textures[2];
  postUniforms.ka.value = new THREE.Vector4(0.0,0.0,1.0,1.0);
  postUniforms.kd.value = new THREE.Vector4(1.0,1.0,1.0,1.0); 
  postUniforms.ks.value = new THREE.Vector4(1.0, 1.0, 1.0, 1.0);
  postUniforms.shi.value = 200.0;
  postUniforms.cameraPos.value = camera.position;
  postUniforms.gBufferToShow.value = 0;
  postUniforms.maskColor.value = new THREE.Vector4(0.0, 0.0, 0.0, 1.0);
  postUniforms.backgroundColor.value = new THREE.Vector4(1.0, 1.0, 1.0, 1.0);
  postUniforms.useMaskColor.value = true;
  postUniforms.useSpecular.value = false;

  postMaterial = new THREE.ShaderMaterial({
    vertexShader: document.getElementById('ssao-vs').textContent.trim(),
    fragmentShader: document.getElementById('render-frag').textContent.trim(),
    uniforms: postUniforms,
    lights: true
  });

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
  ssaoRenderTarget = new THREE.WebGLMultiRenderTarget(
    container.clientWidth, container.clientHeight, 1);
  ssaoRenderTarget.texture.format = THREE.RGBAFormat;
  ssaoRenderTarget.texture.minFilter = THREE.NearestFilter;
  ssaoRenderTarget.texture.magFilter = THREE.NearestFilter;
  ssaoRenderTarget.texture.type = THREE.FloatType;
  ssaoRenderTarget.texture.generateMipmaps = false;
  ssaoRenderTarget.stencilBuffer = false;
  ssaoRenderTarget.depthBuffer = true;
  ssaoRenderTarget.depthTexture = new THREE.DepthTexture();
  ssaoRenderTarget.depthTexture.format = THREE.DepthFormat;
  ssaoRenderTarget.depthTexture.type = THREE.FloatType;

  // Name SSAO attachments for debugging
  ssaoRenderTarget.textures[0].name = 'occlusion';


  // Create a multi render target with Float buffers
  gBufferRenderTarget = new THREE.WebGLMultiRenderTarget(
    container.clientWidth, container.clientHeight, 3);
  gBufferRenderTarget.texture.format = THREE.RGBAFormat;
  gBufferRenderTarget.texture.minFilter = THREE.NearestFilter;
  gBufferRenderTarget.texture.magFilter = THREE.NearestFilter;
  gBufferRenderTarget.texture.type = THREE.FloatType;
  gBufferRenderTarget.texture.generateMipmaps = false;
  gBufferRenderTarget.stencilBuffer = false;
  gBufferRenderTarget.depthBuffer = true;
  gBufferRenderTarget.depthTexture = new THREE.DepthTexture();
  gBufferRenderTarget.depthTexture.format = THREE.DepthFormat;
  gBufferRenderTarget.depthTexture.type = THREE.FloatType;

  // Name G-Buffer attachments for debugging
  gBufferRenderTarget.textures[0].name = 'diffuse';
  gBufferRenderTarget.textures[1].name = 'normal';
  gBufferRenderTarget.textures[2].name = 'position';

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
  
  if (lightFX) {
    const time = Date.now() * 0.0005;
    lights.forEach(light => {
      
      light.position.x = Math.sin(time * 0.7) * light.startPos.x;
      light.position.y = Math.cos(time * 0.5) * light.startPos.y;
      light.position.z = Math.cos(time * 0.4) * light.startPos.z;
      
    });
  }
  
  
}

// render, or 'draw a still image', of the scene
function render() {
  
  // render scene into target
  renderer.setRenderTarget(gBufferRenderTarget);
  renderer.render(scene, camera);

  // render scene into ssao
  renderer.setRenderTarget(null);
  renderer.render(ssaoScene, postCamera);
  
  // render post FX
  // renderer.setRenderTarget(null);
  // renderer.render(postScene, postCamera);
  
}

// SSAO
// TODO: Colocar o código no lugar certo!
function prepareSSAO() {
  // Configure G-Buffer framebuffer
  // Probably already:
  //  - position color buffer
  //  - normal color buffer
  //  - color + specular color buffer (maybe will not used)
  //  - create and attach depth buffer

  // Also create framebuffer to hold processing stage
  //  - SSAO color buffer
  //  - buffer for blur stage (maybe will not used)

  // Generate sample kernel
  function generateSampleKernel() {
    for (let i = 0; i < kernelSize; i++) {

      const sample = new THREE.Vector3();
      sample.x = getRandomArbitrary(-1, 1);
      sample.y = getRandomArbitrary(-1, 1);
      sample.z = Math.random();

      sample.normalize();

      let scale = i / kernelSize;
      scale = Math.lerp(0.1, 1, scale * scale);
      sample.multiplyScalar(scale);

      kernel.push(sample);

    }

  }
  

  function generateRandomKernelRotations() {

    const width = 4;
    const height = 4;

    if (SimplexNoise === undefined) {

      console.error('The pass relies on SimplexNoise.');

    }

    const simplex = new SimplexNoise();

    const size = width * height;
    let data = new Float32Array(size * 4);

    for (let i = 0; i < size; i++) {

      const stride = i * 4;

      const x = getRandomArbitrary(-1, 1);
      const y = getRandomArbitrary(-1, 1);
      const z = 0;

      const noise = simplex.noise3d(x, y, z);

      data[stride] = noise;
      data[stride + 1] = noise;
      data[stride + 2] = noise;
      data[stride + 3] = 1;

    }

    noiseTexture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    noiseTexture.wrapS = THREE.RepeatWrapping;
    noiseTexture.wrapT = THREE.RepeatWrapping;
    noiseTexture.needsUpdate = true;

  }

  generateSampleKernel();
  generateRandomKernelRotations();
  //createSSAOMaterial();
}

// 
function createGui() {
  
  let gui = new dat.GUI();

  let params = {
    'Show': 0,
    'Rotate': false,
    'Use Mask': true,
    'Use Specular': false,
    'Mask' : "#000000",
    'Background': "#FFFFFF",
    'Shiness': 250.0,
    'Intensity': 0.11125,
  };  
  
  
  let gBufferToShow = gui.add(params, 'Show', { 
    'SSAO' : 100,
    'Final color': 0, 
    'Position': 1,
    'Normal map': 2,
    'Vertex normal': 3,
    'Vertex color (mask)': 4,
    'Depth': 5 
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
  
  gui.add(params, 'Use Specular', true).onChange( function (val) {
    postUniforms.useSpecular.value = val;
  });

  let ssaoFolder = gui.addFolder("SSAO");
}

//
function loadModelAndMaterial() {

  // Load the model and generate its indices
  const objLoader = new THREE.OBJLoader2();
  objLoader.setUseIndices(true);

  // A reusable function to set up the models. We're passing in a position parameter
  // so that they can be individually placed around the scene
  const onObjLoad = ( obj, position, scale ) => {

    createSSAOMaterial();
    // createMaterial(); 
    
    
    model = obj.detail.loaderRootNode.children[0];
    model.position.copy( position );
    model.material = gBufferMaterial;

    model.scale.copy(scale);
    
    // https://github.com/mrdoob/three.js/issues/12402
    // https://threejs.org/docs/#examples/utils/BufferGeometryUtils
    THREE.BufferGeometryUtils.computeTangents( model.geometry );

    scene.add( model );

  };

  const mtlLoader = new THREE.MTLLoader();
  const onMTLLoad = (mtl) => {
    const info = mtl.materialsInfo.Default;
    console.log("Material Info: ", mtl);
    

    materialInfo = {
      bumpTex: mtl.baseUrl + "Body_dDo_n.jpg",
      // d: info.d,    // halo factor: dissolve = 1.0 - (N*v)(1.0-factor)
      // ka: info.ka,  // ambient
      // kd: info.kd,  // diffuse
      // ke: info.ke,  // ???
      // ks: info.ks,  // specular
      // ns: info.ns   // Specular expoent
    }

    // load the first model. Each model is loaded asynchronously,
    // so don't make any assumption about which one will finish loading first


    // Modelo base para a implementação do SSAO
    // Scale factor
    let s = 0.1;
    const ponyCartoonPosition = new THREE.Vector3( 0, 0, 0 );
    const ponyCartoonScale = new THREE.Vector3( 0.1, 0.1, 0.1 );
    objLoader.load( 'models/pony_cartoon/Pony_cartoon.obj', obj => onObjLoad( obj, ponyCartoonPosition, ponyCartoonScale ), onProgress, onError );

    // Modelo adicional para testes com o SSAO
    s = 0.45;
    const superHumanPosition = new THREE.Vector3( 0, 0, 0 );
    const superHumanScale = new THREE.Vector3( s, s, s );
    // objLoader.load( 'models/super_human/super_human.obj', obj => onObjLoad( obj, superHumanPosition, superHumanScale ), onProgress, onError );

    // Modelo adicional para testes com o SSAO
    s = 10.00;
    const mechM6kPosition = new THREE.Vector3( 0, 20, 0 );
    const mechM6kScale = new THREE.Vector3( s, s, s );
    // objLoader.load( 'models/mech-m-6k/mech-m-6k.obj', obj => onObjLoad( obj, mechM6kPosition, mechM6kScale ), onProgress, onError );

  }

  // the loader will report the loading progress to this function
  const onProgress = () => {};

  // the loader will send any error messages to this function, and we'll log
  // them to to console
  const onError = ( errorMessage ) => { console.log( errorMessage ); };

  mtlLoader.load( 'models/pony_cartoon/Pony_cartoon.mtl', mtl => onMTLLoad( mtl ), onProgress, onError );

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
  gBufferRenderTarget.setSize( container.clientWidth, container.clientHeight );
  ssaoRenderTarget.setSize( container.clientWidth, container.clientHeight );

}

window.addEventListener( 'resize', onWindowResize );

// call the init function to set everything up
init();