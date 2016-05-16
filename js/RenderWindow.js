/**
 * Created by atg on 16/05/2016.
 */
//Render into window of many in page

var CAM_PERSPECTIVE = 45, NEAR_CLIP_PLANE = 0.1, FAR_CLIP_PLANE = 5000;
var CAM_ZPOS = 100;

function RenderWindow(element) {
    this.element = element;
    this.camPos = new THREE.Vector3(0, 0, CAM_ZPOS);
}

RenderWindow.prototype.init = function() {
    this.createCamera();
    this.createScene();
    this.createControls();
};

RenderWindow.prototype.createCamera = function() {
    this.camera = new THREE.PerspectiveCamera(CAM_PERSPECTIVE, 4/3, NEAR_CLIP_PLANE, FAR_CLIP_PLANE );
    this.camera.position.set(this.camPos.x, this.camPos.y, this.camPos.z);
};

RenderWindow.prototype.createScene = function() {
    this.scene = new THREE.Scene();

    var ambientLight = new THREE.AmbientLight(0x383838);
    this.scene.add(ambientLight);
    this.pointLight = new THREE.PointLight(0xffffff);
    this.pointLight.position.set(0,200,0);
    this.pointLight.name = 'PointLight';
    this.scene.add(this.pointLight);
};

RenderWindow.prototype.createControls = function() {
    this.controls = new THREE.TrackballControls(this.camera, this.element);
    this.controls.rotateSpeed = 1.0;
    this.controls.zoomSpeed = 1.0;
    this.controls.panSpeed = 1.0;

    this.controls.staticMoving = true;
    this.controls.dynamicDampingFactor = 0.3;

    this.controls.keys = [ 65, 83, 68 ];

    var lookAt = new THREE.Vector3(0, 0, 0);
    this.controls.setLookAt(lookAt);
};
