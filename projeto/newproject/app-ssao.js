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

let container, stats;
let camera, scene, renderer;
let composer;
let controls;
let models;
let actualVisibleModel;

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

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(50, 60, 95.0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaaaaaa);

    scene.add(new THREE.DirectionalLight());
    scene.add(new THREE.HemisphereLight());

    loadModelAndMaterial();

    stats = new Stats();
    container.appendChild(stats.dom);

    let width = window.innerWidth;
    let height = window.innerHeight;

    composer = new EffectComposer(renderer);

    let ssaoPass = new SSAOPass(scene, camera, width, height);
    ssaoPass.kernelRadius = 16;
    ssaoPass.ssaoMaterial.vertexShader = document.getElementById('ssao-vs').textContent.trim();
    ssaoPass.ssaoMaterial.fragmentShader = document.getElementById('ssao-fs').textContent.trim();
    // This is needed because WebGL2 uses THREE.UnsignedShortType
    // Then, precision is reduced, generating weird artifacts
    ssaoPass.beautyRenderTarget.depthTexture.type = THREE.FloatType;

    composer.addPass(ssaoPass);

    // Init gui
    let gui = new GUI();

    gui.add(ssaoPass, 'output', {
        'Complete': SSAOPass.OUTPUT.Default,
        'SSAO Only': SSAOPass.OUTPUT.SSAO,
        'SSAO Only + Blur': SSAOPass.OUTPUT.Blur,
        'Lighting Only': SSAOPass.OUTPUT.Beauty,
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

    const modelMap = {
        0: "Pony Cartoon",
        1: "Catterpillar",
        2: "Utilitarian",
        3: "Mech-M-6k",
        4: "Super Human",
    }
    const modelsByName = {
        "Model": 0
    }
    gui.add(modelsByName, "Model", {
        
        "Pony Cartoon": 0,
        "Utilitarian": 1, 
        "Catterpillar": 2, 
        "Mech-M-6k": 3, 
        "Super Human": 4, 
        
    }).onChange(function (value) {
        
        const model = models[ modelMap[value] ]
        
        if (actualVisibleModel === undefined || actualVisibleModel == null) {
            // console.warn("MODEL", model);
            actualVisibleModel = models[ modelMap[0] ];
        }
        
        actualVisibleModel.visible = false;
        model.visible = true;
        actualVisibleModel = model;

    });

    window.addEventListener('resize', onWindowResize, false);

}

function onWindowResize() {

    let width = window.innerWidth;
    let height = window.innerHeight;

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

    // store references to models loaded
    models = {}

    // Load the model and generate its indices
    const objLoader = new OBJLoader2();
    // objLoader.setUseIndices(true);


    // the loader will report the loading progress to this function
    const onProgress = () => {};

    // the loader will send any error messages to this function, and we'll log
    // them to to console
    const onError = (errorMessage) => {
        console.log(errorMessage);
    };

    // A reusable function to set up the models. We're passing in a position parameter
    // so that they can be individually placed around the scene
    const onObjLoad = (name, obj, position, scale, visible=true) => {

        let model = obj.children;
        model = model[0];
        model.position.copy(position);
        model.scale.copy(scale);

        model.visible = visible;

        models[name] = model;

        // https://github.com/mrdoob/three.js/issues/12402
        // https://threejs.org/docs/#examples/utils/BufferGeometryUtils
        // BufferGeometryUtils.computeTangents(model.geometry);

        scene.add(model);

    };

    // load the first model. Each model is loaded asynchronously,
    // so don't make any assumption about which one will finish loading first

    // Modelo base para a implementação do SSAO
    // Scale factor
    let s = 0.1;
    const ponyCartoonPosition = new THREE.Vector3(0, 0, 0);
    const ponyCartoonScale = new THREE.Vector3(0.1, 0.1, 0.1);
    objLoader.load( 'models/pony_cartoon/Pony_cartoon.obj', 
        obj => onObjLoad( "Pony Cartoon", obj, ponyCartoonPosition, ponyCartoonScale, true ), onProgress, onError );

    // Modelo adicional para testes com o SSAO
    s = 0.45;
    const superHumanPosition = new THREE.Vector3(0, -4, 0);
    const superHumanScale = new THREE.Vector3(s, s, s);
    objLoader.load('models/super_human/super_human.obj', 
        obj => onObjLoad("Super Human", obj, superHumanPosition, superHumanScale, false), onProgress, onError);

    // Modelo adicional para testes com o SSAO
    s = 10.00;
    const mechM6kPosition = new THREE.Vector3(0, 20, 0);
    const mechM6kScale = new THREE.Vector3(s, s, s);
    objLoader.load( 'models/mech-m-6k/mech-m-6k.obj', 
        obj => onObjLoad( "Mech-M-6k", obj, mechM6kPosition, mechM6kScale, false ), onProgress, onError );

    // Modelo adicional para testes com o SSAO
    s = 7.00;
    const catterpillar789cPosition = new THREE.Vector3(0, 20, 0);
    const catterpillar789cScale = new THREE.Vector3(s, s, s);
    objLoader.load( 'models/catterpillar-789c/catterpillar-789c.obj', 
        obj => onObjLoad( "Catterpillar", obj, catterpillar789cPosition, catterpillar789cScale, false ), onProgress, onError );

    // Modelo adicional para testes com o SSAO
    s = 5.50;
    const utilitarianVericlePosition = new THREE.Vector3(0, 20, 0);
    const utilitarianVericleScale = new THREE.Vector3(s, s, s);
    objLoader.load( 'models/utilitarian-vehicle/utilitarian-vehicle.obj', 
        obj => onObjLoad( "Utilitarian", obj, utilitarianVericlePosition, utilitarianVericleScale, false ), onProgress, onError );

}