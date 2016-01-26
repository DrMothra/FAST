/**
 * Created by DrTone on 26/01/2016.
 */


//Init this app from base
function FastApp() {
    BaseApp.call(this);
}

FastApp.prototype = new BaseApp();

FastApp.prototype.init = function(container) {
    BaseApp.prototype.init.call(this, container);
    this.data = null;
};

FastApp.prototype.update = function() {
    var clicked = this.mouseDown;

    BaseApp.prototype.update.call(this);
};

FastApp.prototype.createScene = function() {
    BaseApp.prototype.createScene.call(this);

    //Create ground
    this.GROUND_DEPTH = 240;
    this.GROUND_WIDTH = 180;
    addGroundPlane(this.scene, this.GROUND_WIDTH, this.GROUND_DEPTH);
};

function addGroundPlane(scene, width, height) {
    // create the ground plane
    var planeGeometry = new THREE.PlaneGeometry(width,height,1,1);
    var texture = THREE.ImageUtils.loadTexture("images/pitch.jpg");
    var planeMaterial = new THREE.MeshLambertMaterial({map: texture, transparent: false, opacity: 0.5});
    var plane = new THREE.Mesh(planeGeometry,planeMaterial);

    //plane.receiveShadow  = true;

    // rotate and position the plane
    plane.rotation.x=-0.5*Math.PI;
    plane.position.x=0;
    plane.position.y=-59.9;
    plane.position.z=0;

    scene.add(plane);
}

FastApp.prototype.createGUI = function() {
    this.guiControls = new function() {
        this.filename = '';
    };

    //Create GUI
    var gui = new dat.GUI();
};

$(document).ready(function() {

    //Init app
    var container = document.getElementById("WebGL-output");
    var app = new FastApp();
    app.init(container);
    app.createScene();
    app.createGUI();

    app.run();
});
