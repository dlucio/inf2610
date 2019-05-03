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
  // scene.background = new THREE.Color( 0xFFFFFF );

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

  camera.position.set( 0, 0, 7.0 );

}

function createControls() {

  controls = new THREE.OrbitControls( camera, container );
  controls.minDistance = 5;
  controls.maxDistance = 13.5;

}

function createLights() {

  const pointLight = new THREE.PointLight(0xffffff, 1.0);
  pointLight.position.set( 0, 0.0, 10.1 );

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
  const texture = textureLoader.load( materialInfo.bumpTex );

  uniforms.bumpTex = { 
    type: "t",
    value: texture 
  } 

  // Tip from: https://github.com/mrdoob/three.js/issues/8016#issuecomment-194935980
  uniforms = THREE.UniformsUtils.merge([uniforms, THREE.UniformsLib['lights']]);
  uniforms.bumpTex.value = texture;
  
  material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: document.getElementById("vs").textContent.trim(),
    fragmentShader: document.getElementById("fs").textContent.trim(),
    lights: true,
    vertexTangents: true, // https://threejs.org/docs/#api/en/materials/Material.vertexTangents
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
    // intensity: spotLight.intensity,
    // distance: spotLight.distance,
    // angle: spotLight.angle,
    // penumbra: spotLight.penumbra,
    // decay: spotLight.decay
  };

  // gui.addColor( params, 'light color' ).onChange( function ( val ) {
  //   spotLight.color.setHex( val );
  //   render();
  // } );

  // gui.add( params, 'intensity', 0, 2 ).onChange( function ( val ) {
  //   spotLight.intensity = val;
  //   render();
  // } );

  // gui.add( params, 'distance', 50, 200 ).onChange( function ( val ) {
  //   spotLight.distance = val;
  //   render();
  // } );

  // gui.add( params, 'angle', 0, Math.PI / 3 ).onChange( function ( val ) {
  //   spotLight.angle = val;
  //   render();
  // } );

  // gui.add( params, 'penumbra', 0, 1 ).onChange( function ( val ) {
  //   spotLight.penumbra = val;
  //   render();
  // } );

  // gui.add( params, 'decay', 1, 2 ).onChange( function ( val ) {
  //   spotLight.decay = val;
  //   render();
  // } );

  gui.open();
}

function generateTangent(bufferGeometry) {

  var positionAttributes = bufferGeometry.getAttribute('position');
  var uvAttributes = bufferGeometry.getAttribute('uv');

  var realVertices = [];
  var realUvs = [];

  for (var i = 0; i < positionAttributes.array.length; i += 3) {
    realVertices.push(new THREE.Vector3(positionAttributes.array[i + 0], positionAttributes.array[i + 1], positionAttributes.array[i + 2]));
  }

  for (var i = 0; i < uvAttributes.array.length; i += 2) {
    realUvs.push(new THREE.Vector2(uvAttributes.array[i], uvAttributes.array[i + 1]));
  }

  var tangents = new Float32Array(positionAttributes.array.length);
  var bitangents = new Float32Array(positionAttributes.array.length);


  var tangArray = [];
  var bitangentArray = [];

  for (var i = 0; i < realVertices.length; i += 3) {
    var v0 = realVertices[i + 0];
    var v1 = realVertices[i + 1];
    var v2 = realVertices[i + 2];

    var uv0 = realUvs[i + 0];
    var uv1 = realUvs[i + 1];
    var uv2 = realUvs[i + 2];


    var deltaPos1 = v1.sub(v0);
    var deltaPos2 = v2.sub(v0);

    var deltaUV1 = uv1.sub(uv0);
    var deltaUV2 = uv2.sub(uv0);

    var r = 1.0 / (deltaUV1.x * deltaUV2.y - deltaUV1.y * deltaUV2.x);
    var tangent = deltaPos1.multiplyScalar(deltaUV2.y).sub(deltaPos2.multiplyScalar(deltaUV1.y)).multiplyScalar(r); //p1 * uv2.y - p2 * uv1.y
    var bitangent = deltaPos2.multiplyScalar(deltaUV2.x).sub(deltaPos1.multiplyScalar(deltaUV2.x)).multiplyScalar(r);

    tangArray.push(tangent.x);
    tangArray.push(tangent.y);
    tangArray.push(tangent.z);
    tangArray.push(0.0);

    tangArray.push(tangent.x);
    tangArray.push(tangent.y);
    tangArray.push(tangent.z);
    tangArray.push(0.0);

    tangArray.push(tangent.x);
    tangArray.push(tangent.y);
    tangArray.push(tangent.z);
    tangArray.push(0.0);

    bitangentArray.push(bitangent.x);
    bitangentArray.push(bitangent.y);
    bitangentArray.push(bitangent.z);
    bitangentArray.push(0.0);

    bitangentArray.push(bitangent.x);
    bitangentArray.push(bitangent.y);
    bitangentArray.push(bitangent.z);
    bitangentArray.push(0.0);

    bitangentArray.push(bitangent.x);
    bitangentArray.push(bitangent.y);
    bitangentArray.push(bitangent.z);
    bitangentArray.push(0.0);
  }

  for (var i = 0; i < bitangentArray.length; i++) {
    tangents[i] = tangArray[i];
    bitangents[i] = bitangentArray[i];
  }


  bufferGeometry.addAttribute('tangent', new THREE.BufferAttribute(tangents, 4));
  bufferGeometry.addAttribute( 'bitangent',  new THREE.BufferAttribute( bitangents, 4 ) );
}

//
function loadModelAndMaterial() {

  const objLoader = new THREE.OBJLoader2();
  objLoader.setUseIndices(true);

  // A reusable function to set up the models. We're passing in a position parameter
  // so that they can be individually placed around the scene
  const onObjLoad = ( obj, position ) => {

    createMaterial();
    
    model = obj.detail.loaderRootNode.children[0];
    model.position.copy( position );
    model.material = material;

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

}

window.addEventListener( 'resize', onWindowResize );

// call the init function to set everything up
init();