import * as THREE from "three";

let Colors = {
    red: 0xf25346,
    white: 0xd8d0d1,
    brown: 0x59332e,
    pink: 0xf5986e,
    brownDark: 0x23190f,
    blue: 0x68c3c0,
};

window.addEventListener("load", init, false);

function init() {
    // set up the scene, the camera and the renderer
    createScene();

    // add the lights
    createLights();

    // add the objects
    createPlane();
    createSea();
    createSky();

    // start a loop that will update the objects' positions
    // and render the scene on each frame
    loop();
}
