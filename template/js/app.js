// Important references
// https://threejs.org/docs/index.html#api/en/renderers/webgl/WebGLProgram
// https://threejs.org/docs/index.html#manual/en/introduction/How-to-use-WebGL2

// these need to be accessed inside more than one function so we'll declare them first
let container;
let camera;
let controls;
let renderer;
let scene;
let material;
let mesh;

function init() {

  container = document.querySelector( '#scene-container' );

  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0x8FBCD4 );

  createCamera();
  createControls();
  createLights();
  createMaterial();
  createMeshes();
  createRenderer();

  // start the animation loop
  renderer.setAnimationLoop( () => {

    update();
    render();

  } );

}

function createCamera() {

  camera = new THREE.PerspectiveCamera(
    35, // FOV
    container.clientWidth / container.clientHeight, // aspect
    0.1, // near clipping plane
    100, // far clipping plane
  );

  camera.position.set( -4, 4, 10 );

}

function createControls() {

  controls = new THREE.OrbitControls( camera, container );

}

function createLights() {

  const ambientLight = new THREE.HemisphereLight(
    0xddeeff, // sky color
    0x202020, // ground color
    5, // intensity
  );

  const mainLight = new THREE.DirectionalLight( 0xffffff, 5 );
  mainLight.position.set( 10, 10, 10 );

  scene.add( ambientLight, mainLight );

}

function createMaterial() {

  const uniforms = {}
  uniforms.ka = new THREE.Uniform(new THREE.Vector4(0.21, 0.13, 0.05, 1.0));
  uniforms.kd = new THREE.Uniform(new THREE.Vector4(0.71, 0.43, 0.18, 1.0));
  uniforms.ks = new THREE.Uniform(new THREE.Vector4(1.0, 1.0, 1.0, 1.0));

  uniforms.shi = {
    type: 'float',
    value: 100
  }

  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load( 'textures/uv_test_bw.png' );
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 16;

  uniforms.mytexture = { 
    type: "t",
    value: texture 
  }

  
  material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([ 
      uniforms, 
      THREE.UniformsLib['lights']
    ]),
    vertexShader: document.getElementById("vs").textContent.trim(),
    fragmentShader: document.getElementById("fs").textContent.trim(),
    lights: true,
    defines: { USE_MAP: ''},
  });
}

function createMeshes() {

  const geometry = new THREE.BoxBufferGeometry( 2, 2, 2 );

  const textureLoader = new THREE.TextureLoader();

  const texture = textureLoader.load( 'textures/uv_test_bw.png' );

  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 16;

  // const material = new THREE.MeshStandardMaterial( {
  //   map: texture,
  // } );

  mesh = new THREE.Mesh( geometry, material );

  scene.add( mesh );

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

}

// render, or 'draw a still image', of the scene
function render() {

  renderer.render( scene, camera );

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
