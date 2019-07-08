"use strict";

// Important references
// https://threejs.org/docs/index.html#api/en/renderers/webgl/WebGLProgram
// https://threejs.org/docs/index.html#manual/en/introduction/How-to-use-WebGL2
// https://threejs.org/docs/index.html#api/en/constants/Textures
// http://paulbourke.net/dataformats/mtl/


import * as THREE from '../build/three.module.js';

import Stats from './jsm/libs/stats.module.js';
import {
    GUI
} from './jsm/libs/dat.gui.module.js';

import {
    EffectComposer
} from './jsm/postprocessing/EffectComposer.js';
import {
    SSAOPass
} from './jsm/postprocessing/SSAOPass.js';

import {
    MTLLoader
} from './jsm/loaders/MTLLoader.js';
import {
    OBJLoader2
} from './jsm/loaders/OBJLoader2.js';
import {
    BufferGeometryUtils
} from './jsm/utils/BufferGeometryUtils.js';
import {
    OrbitControls
} from './jsm/controls/OrbitControls.js';

var container, stats;
var camera, scene, renderer;
var composer;
var group;
let controls;

init();
animate();

function init() {

    if (WEBGL.isWebGL2Available() == false) {
        document.body.appendChild(WEBGL.getWebGL2ErrorMessage());
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');

    container = document.createElement('div');
    document.body.appendChild(container);

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        context: context
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Not used with webgl2 context
    // if ( ! renderer.extensions.get( 'WEBGL_depth_texture' ) ) {

    //   document.querySelector( '#error' ).style.display = 'block';
    //   return;

    // }

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(50, 70, 95.0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaaaaaa);

    scene.add(new THREE.DirectionalLight());
    scene.add(new THREE.HemisphereLight());

    loadModelAndMaterial();

    // group = new THREE.Group();
    // // scene.add( group );

    // var geometry = new THREE.BoxBufferGeometry(10, 10, 10);

    // for (var i = 0; i < 100; i++) {

    //     var material = new THREE.MeshLambertMaterial({
    //         color: Math.random() * 0xffffff
    //     });

    //     var mesh = new THREE.Mesh(geometry, material);
    //     mesh.position.x = Math.random() * 400 - 200;
    //     mesh.position.y = Math.random() * 400 - 200;
    //     mesh.position.z = Math.random() * 400 - 200;
    //     mesh.rotation.x = Math.random();
    //     mesh.rotation.y = Math.random();
    //     mesh.rotation.z = Math.random();

    //     mesh.scale.setScalar(Math.random() * 10 + 2);
    //     group.add(mesh);

    // }

    stats = new Stats();
    container.appendChild(stats.dom);

    var width = window.innerWidth;
    var height = window.innerHeight;

    composer = new EffectComposer(renderer);

    var ssaoPass = new SSAOPass(scene, camera, width, height);
    ssaoPass.kernelRadius = 16;
    ssaoPass.ssaoMaterial.vertexShader = document.getElementById('ssao-vs').textContent.trim();
    ssaoPass.ssaoMaterial.fragmentShader = document.getElementById('ssao-fs').textContent.trim();
    // This is needed because WebGL2 uses THREE.UnsignedShortType
    // Then, precision is reduced, generating weird artifacts
    ssaoPass.beautyRenderTarget.depthTexture.type = THREE.FloatType;

    composer.addPass(ssaoPass);

    // Init gui
    var gui = new GUI();

    gui.add(ssaoPass, 'output', {
        'Complete': SSAOPass.OUTPUT.Default,
        'SSAO Only': SSAOPass.OUTPUT.SSAO,
        'SSAO Only + Blur': SSAOPass.OUTPUT.Blur,
        'Lighting': SSAOPass.OUTPUT.Beauty,
        'Depth': SSAOPass.OUTPUT.Depth,
        'Normal': SSAOPass.OUTPUT.Normal
    }).onChange(function (value) {

        ssaoPass.output = parseInt(value);

    });
    gui.add(ssaoPass, 'kernelRadius').min(0).max(32);
    gui.add(ssaoPass, 'minDistance').min(0.001).max(0.02);
    gui.add(ssaoPass, 'maxDistance').min(0.01).max(0.3);
    gui.add(ssaoPass, 'width');;
    gui.add(ssaoPass, 'height');;

    window.addEventListener('resize', onWindowResize, false);

}

function onWindowResize() {

    var width = window.innerWidth;
    var height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    composer.setSize(width, height);

}

function animate() {

    requestAnimationFrame(animate);

    stats.begin();
    render();
    stats.end();

}

function render() {

    composer.render();

}

function loadModelAndMaterial() {

    // Load the model and generate its indices
    const objLoader = new OBJLoader2();
    objLoader.setUseIndices(true);


    // the loader will report the loading progress to this function
    const onProgress = () => {};

    // the loader will send any error messages to this function, and we'll log
    // them to to console
    const onError = (errorMessage) => {
        console.log(errorMessage);
    };

    // A reusable function to set up the models. We're passing in a position parameter
    // so that they can be individually placed around the scene
    const onObjLoad = (obj, position, scale) => {

        let model = obj.children;
        model = model[0];
        model.position.copy(position);
        model.scale.copy(scale);

        // https://github.com/mrdoob/three.js/issues/12402
        // https://threejs.org/docs/#examples/utils/BufferGeometryUtils
        BufferGeometryUtils.computeTangents(model.geometry);

        scene.add(model);

    };

    // load the first model. Each model is loaded asynchronously,
    // so don't make any assumption about which one will finish loading first

    // Modelo base para a implementação do SSAO
    // Scale factor
    let s = 0.1;
    const ponyCartoonPosition = new THREE.Vector3(0, 0, 0);
    const ponyCartoonScale = new THREE.Vector3(0.1, 0.1, 0.1);
    objLoader.load( 'models/pony_cartoon/Pony_cartoon.obj', obj => onObjLoad( obj, ponyCartoonPosition, ponyCartoonScale ), onProgress, onError );

    // Modelo adicional para testes com o SSAO
    s = 0.45;
    const superHumanPosition = new THREE.Vector3(0, 0, 0);
    const superHumanScale = new THREE.Vector3(s, s, s);
    // objLoader.load('models/super_human/super_human.obj', obj => onObjLoad(obj, superHumanPosition, superHumanScale), onProgress, onError);

    // Modelo adicional para testes com o SSAO
    s = 10.00;
    const mechM6kPosition = new THREE.Vector3(0, 20, 0);
    const mechM6kScale = new THREE.Vector3(s, s, s);
    // objLoader.load( 'models/mech-m-6k/mech-m-6k.obj', obj => onObjLoad( obj, mechM6kPosition, mechM6kScale ), onProgress, onError );

    // Modelo adicional para testes com o SSAO
    s = 8.00;
    const catterpillar789cPosition = new THREE.Vector3(0, 20, 0);
    const catterpillar789cScale = new THREE.Vector3(s, s, s);
    // objLoader.load( 'models/catterpillar-789c/catterpillar-789c.obj', obj => onObjLoad( obj, catterpillar789cPosition, catterpillar789cScale ), onProgress, onError );

    // Modelo adicional para testes com o SSAO
    s = 6.00;
    const utilitarianVericlePosition = new THREE.Vector3(0, 20, 0);
    const utilitarianVericleScale = new THREE.Vector3(s, s, s);
    // objLoader.load( 'models/utilitarian-vehicle/utilitarian-vehicle.obj', obj => onObjLoad( obj, utilitarianVericlePosition, utilitarianVericleScale ), onProgress, onError );

}