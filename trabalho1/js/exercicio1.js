/* global THREE */

//TODO: code is a mees, should probably take time to structure this & find a way to 'modularize' shaders
window.addEventListener('load', init)
let scene
let camera
let renderer
let cameraControls
let sceneObjects = []
let uniforms = {}

function init() {
  
  if (WEBGL.isWebGL2Available() == false) {
    document.body.appendChild(WEBGL.getWebGL2ErrorMessage());
  }
  
  let canvas = document.createElement('canvas');
  let context = canvas.getContext('webgl2');
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    context: context
  });
  
  renderer = new THREE.WebGLRenderer()
  renderer.setSize(window.innerWidth, window.innerHeight)
  
  scene = new THREE.Scene()
  
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.z = 5

  // CONTROLS
   cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
   cameraControls.target.set(0, 0, 0);
 
  document.body.appendChild(renderer.domElement)
  adjustLighting()
  addBasicCube()
  addExperimentalCube()
  //addExperimentalLightCube()
  animationLoop()
}

function adjustLighting() {
    let pointLight = new THREE.PointLight(0xdddddd)
    //pointLight.position.set(-5, -3, 3)
    pointLight.position.set(0, 0, 0)
    scene.add(pointLight)
  
    let ambientLight = new THREE.AmbientLight(0x505050)
    scene.add(ambientLight)
}

function addBasicCube() {
  let geometry = new THREE.BoxGeometry(1, 1, 1)
  let material = new THREE.MeshLambertMaterial()  
  
  let mesh = new THREE.Mesh(geometry, material)
  mesh.position.x = -2
  scene.add(mesh)
  sceneObjects.push(mesh)
}

function vs() {
  return `
    struct PointLight {
      vec3 color;
      vec3 position;
      float distance; 
    };

    uniform vec4 ka;
    uniform vec4 kd;
    uniform vec4 ks;
    uniform float shi;
    uniform PointLight pointLights[NUM_POINT_LIGHTS];

    varying vec4 color;
    varying vec4 color_s;

    void main() {
      mat4 mvp = projectionMatrix * modelViewMatrix;
      vec3 veye = vec3( modelViewMatrix * vec4(position, 1.0));
      vec3 light;
      for(int l = 0; l < NUM_POINT_LIGHTS; l++) {
        light = normalize(pointLights[l].position); 
        // if( leye.w == 0)
        //   light = normalize(vec3(leye)); 
        // else
        //   light = normalize(vec3(leye) - veye);
        
        vec3 _normal = normalize( normalMatrix * normal );
        float ndotl = dot(_normal, light);
        color = ka + max(0.0, ndotl)*kd;

        if(ndotl > 0.0) {
          vec3 refl = normalize(reflect(-light, _normal));
          //color_s = ks*pow( max( 0.0, dot( refl, normalize( -veye ) ) ), shi );
          // max( 0.0, dot( refl, normalize( -veye ) ) );
          max(0.0, 1.0);
        }
        else {
          color_s = vec4(0.0, 0.0, 0.0 ,1.0);
        }
    }

      gl_Position =  mvp * vec4( position, 1.0 );
    }
  `
}

function fs() {
  return `
    void main() {
      gl_FragColor = vec4(0.5, 0.5, 1.0, 1.0);
    }
  `
}

function vertexShader() {
  return `
    varying vec3 vUv; 
    varying vec4 modelViewPosition; 
    varying vec3 vecNormal;

    void main() {
      vUv = position; 
      vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
      vecNormal = (modelViewMatrix * vec4(normal, 0.0)).xyz; //????????
      gl_Position = projectionMatrix * modelViewPosition; 
    }
  `
}

function fragmentShader() {
  return `
      uniform vec3 colorA; 
      uniform vec3 colorB; 
      varying vec3 vUv;

      void main() {
        gl_FragColor = vec4(mix(colorA, colorB, vUv.z), 1.0);
      }
  `
}

function addExperimentalCube() {
  uniforms.colorA = {type: 'vec3', value: new THREE.Color(0x74ebd5)}
  uniforms.colorB = {type: 'vec3', value: new THREE.Color(0xACB6E5)}
  
  let geometry = new THREE.BoxGeometry(1, 1, 1)
  let material =  new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      uniforms,
      THREE.UniformsLib['lights']
    ]),
    vertexShader: document.getElementById("vs").textContent.trim(),
    fragmentShader: document.getElementById("fs").textContent.trim(),
    lights: true
  })
    
  let mesh = new THREE.Mesh(geometry, material)
  mesh.position.x = 2
  scene.add(mesh)
  sceneObjects.push(mesh)
}

function lambertLightFragmentShader() {
    return `
      struct PointLight {
        vec3 color;
        vec3 position;
        float distance; 
      };  

      uniform vec3 colorA; 
      uniform vec3 colorB; 
      uniform PointLight pointLights[NUM_POINT_LIGHTS];
      varying vec3 vUv;
      varying vec4 modelViewPosition; 
      varying vec3 vecNormal; 

      void main() {
        //I need to learn theory behind this right now my understanding is: looping through all the point light and than apply magic lol.
        //https://csantosbh.wordpress.com/2014/01/09/custom-shaders-with-three-js-uniforms-textures-and-lighting/
        vec4 addedLights = vec4(0.0, 0.0, 0.0, 1.0);

        for(int l = 0; l < NUM_POINT_LIGHTS; l++) {
            vec3 lightDirection = normalize(modelViewPosition.xyz - pointLights[l].position);
            addedLights.rgb += clamp(dot(-lightDirection, vecNormal), 0.0, 1.0) * pointLights[l].color
               * 1.0; //'light intensity' 
        }

        //tried a bunch of stuff but I'm not sure how to retrieve the ambient light from THREE.js which would be super neat 
        //logic at this point is: always add a constant float since ambient light is evenly distributed in the scene
        //something ain't it with the lighting overall, the direction is defintely not the same as the labert marial from three
        //time to learn the theory behind ligthing :') 

        vec3 redAndPoint = vec3(1.0 * addedLights.r, 0.0, 0.0);
        vec3 finalRed = vec3(redAndPoint.r + 0.3, 0.0, 0.0); 

        vec3 colorAndPointLight = mix(colorA, colorB, vUv.z) * addedLights.rgb;
        vec3 finalColor = vec3(colorAndPointLight.r + 0.3, colorAndPointLight.g + 0.3, colorAndPointLight.b + 0.3);

        gl_FragColor = vec4(finalRed, 1.0);
      }
  `
}

function addExperimentalLightCube() {
  uniforms.colorA = {type: 'vec3', value: new THREE.Color(0x74ebd5)}
  uniforms.colorB = {type: 'vec3', value: new THREE.Color(0xACB6E5)}
  uniforms = THREE.UniformsUtils.merge([
      uniforms,
      THREE.UniformsLib['lights']
    ])
  
  let geometry = new THREE.BoxGeometry(1, 1, 1)
  let material =  new THREE.ShaderMaterial({
    uniforms: uniforms,
    fragmentShader: lambertLightFragmentShader(),
    vertexShader: vertexShader(),
    lights: true
  })
  
  let mesh = new THREE.Mesh(geometry, material)
  mesh.position.x = 2
  scene.add(mesh)
  sceneObjects.push(mesh)
}


function animationLoop() {
  renderer.render(scene, camera)
  
//   for(let object of sceneObjects) {
//     object.rotation.x += 0.01
//     object.rotation.y += 0.03
//   }
  
  requestAnimationFrame(animationLoop)
}
