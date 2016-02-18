/**
 * Created by DrTone on 26/01/2016.
 */

var X_AXIS= 0, Y_AXIS= 1, Z_AXIS=2;
var ROT_UP = 0, ROT_LEFT = 1, ROT_RIGHT = 2, ROT_DOWN = 3;
var ROT_INC = Math.PI/32;
var ZOOM_IN = 0, ZOOM_OUT = 1, PAN_UP = 2, PAN_DOWN = 3, PAN_LEFT = 4, PAN_RIGHT = 5;
var MOVE_INC = 10;

//Init this app from base
function FastApp() {
    BaseApp.call(this);
}

FastApp.prototype = new BaseApp();

FastApp.prototype.init = function(container) {
    BaseApp.prototype.init.call(this, container);
    this.fileName = null;
    this.data = null;
    this.artistName = null;
    this.trackName = null;
    this.numCoefficients = 12;
    this.timbreSegments = [];
    this.timbreSegmentsNormalised = [];
    this.pitchSegments = [];
    this.pitchSegmentsNormalised = [];
    this.visibleModel = undefined;
    this.cameraStartZPos = 700;
};

FastApp.prototype.update = function() {
    var clicked = this.mouseDown;

    BaseApp.prototype.update.call(this);
};

FastApp.prototype.createScene = function() {
    BaseApp.prototype.createScene.call(this);

    //Light box
    var size = 0.5;
    var lightMat = new THREE.MeshBasicMaterial( { color: 0xffffff});
    var lightGeom = new THREE.BoxGeometry(size, size, size);
    var lightMesh = new THREE.Mesh(lightGeom, lightMat);
    lightMesh.name = "LightBox";
    lightMesh.position.set(0, 200, 0);
    this.scene.add(lightMesh);

    //Load json data
    var _this = this;
    this.dataLoader = new dataLoader();

    //DEBUG

    this.dataLoader.load("data/metallica_EndoftheLine.json", function(data) {
        _this.data = data;
        //DEBUG
        console.log("File loaded");
        _this.parseData();
    });

};

FastApp.prototype.loadNewFile = function(fileName) {
    if(!fileName) {
        alert("No file selected!");
        return;
    }
    this.fileName = fileName;
    //Reset current scene
    var removeGroup = this.scene.getObjectByName('timbre');
    if(!removeGroup) {
        console.log("No timbre group");
    }
    this.scene.remove(removeGroup);
    removeGroup = this.scene.getObjectByName('pitch');
    if(!removeGroup) {
        console.log("No pitch group");
    }
    this.scene.remove(removeGroup);

    //Render new data
    var _this = this;
    this.dataLoader.load("data/" + this.fileName, function(data) {
        _this.data = data;
        //DEBUG
        console.log("File loaded");
        _this.parseData();
    });
};

FastApp.prototype.parseData = function() {
    //Get artist name, track name and timbre
    var datasets = this.data.datasets;
    var prop;
    var alias, songData;
    for(prop in datasets) {
        alias = datasets[prop].alias;
        if(alias[0] === '/metadata/songs') {
            songData = datasets[prop].value;
            this.artistName = songData[0][9];
            this.trackName = songData[0][18];
            $('#trackInfoArtist').html("Artist: " + this.artistName);
            $('#trackInfoTrack').html("Track: " + this.trackName);
            console.log(this.artistName + ' ' + this.trackName);
            break;
        }
    }

    for(prop in datasets) {
        alias = datasets[prop].alias;
        if(alias[0] === '/analysis/segments_timbre') {
            this.timbreSegments = datasets[prop].value;
            console.log("Got timbre");
            break;
        }
    }

    this.renderTimbre();
    this.onShowGroup('timbre', this.guiControls.Timbre);

    for(prop in datasets) {
        alias = datasets[prop].alias;
        if(alias[0] === '/analysis/segments_pitches') {
            this.pitchSegments = datasets[prop].value;
            console.log("Got pitches");
            break;
        }
    }

    this.renderPitches();
    this.onShowGroup('pitch', this.guiControls.Pitch);
};

function addGroundPlane(scene, width, height) {
    // create the ground plane
    var planeGeometry = new THREE.PlaneGeometry(width,height,1,1);
    var planeMaterial = new THREE.MeshLambertMaterial({color: 0xb5b5b5, transparent: false, opacity: 0.5});
    var plane = new THREE.Mesh(planeGeometry,planeMaterial);

    //plane.receiveShadow  = true;

    // rotate and position the plane
    plane.rotation.x=-0.5*Math.PI;
    plane.position.x=0;
    plane.position.y=-59.9;
    plane.position.z=0;

    scene.add(plane);
}

FastApp.prototype.renderTimbre = function() {
    //Render timbre
    //12 coefficients per segment
    var timbreGroup = new THREE.Object3D();
    timbreGroup.name = 'timbre';
    var numCoefficients = 12, numSegments = this.timbreSegments.length;
    var startX = 0, startY = 0, startZ = 0;
    var interZgap = 1, interXgap = 1;
    var width = 2, depth = 5;

    this.normaliseData(this.timbreSegments);

    //var boxMat = new THREE.MeshLambertMaterial( {color: 0xff0000} );

    //Points for now
    var geom = new THREE.BufferGeometry();

    var numPoints = numSegments;
    var positions = new Float32Array(numPoints * 3);
    var sizes = new Float32Array(numPoints);

    var coefficients, height;
    var pointNum = 0;
    for(var i= 0; i<numPoints; ++i) {
        coefficients = this.timbreSegments[i];
        for(var j=0; j<numCoefficients; ++j) {
            height = coefficients[j] < 0 ? coefficients[j] * -1 : coefficients[j];
            startY = coefficients[j] < 0 ? -height/2 : height/2;
            positions[pointNum++] = startX;
            positions[pointNum++] = startY;
            positions[pointNum++] = startZ - (j * (interZgap + depth));
        }
        startX += interXgap;
    }

    geom.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeBoundingSphere();

    //var mesh = new THREE.Mesh(geom, boxMat);
    var pointSize = 1.5;
    var mat = new THREE.PointsMaterial( { size: pointSize, vertexColors: THREE.VertexColors } );
    var particles = new THREE.Points(geom, mat);
    timbreGroup.add(particles);

    this.scene.add(timbreGroup);
};

FastApp.prototype.renderPitches = function() {
    //Render pitches
    //12 coefficients per segment
    var pitchGroup = new THREE.Object3D();
    pitchGroup.name = 'pitch';
    var numCoefficients = 12, numSegments = this.pitchSegments.length;
    var startX = 0, startY = 0, startZ = 0;
    var interZgap = 1, interXgap = 1;
    var width = 2, depth = 2;

    var boxMat = new THREE.MeshLambertMaterial( {color: 0x0000ff} );
    var geom, mesh;

    var coefficients, height;
    for(var i=0; i<numSegments/2; ++i) {
        coefficients = this.pitchSegments[i];
        for(var j=0; j<numCoefficients; ++j) {
            height = coefficients[j] < 0 ? coefficients[j] * -1 : coefficients[j];
            startY = coefficients[j] < 0 ? -height/2 : height/2;
            geom = new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
            mesh = new THREE.Mesh(geom, boxMat);
            mesh.position.set(startX, startY, startZ - (j * (interZgap + depth)));
            pitchGroup.add(mesh);
        }
        startX += interXgap;
    }

    this.scene.add(pitchGroup);
};

FastApp.prototype.normaliseData = function(data) {
    var minArray = [];
    var maxArray = [];
    var value, minValue = 1000000, maxValue = -1000000;
    var coefficients;
    for(var i=0; i<data.length; ++i) {
        coefficients = data[i];
        for(var j=0; j<this.numCoefficients; ++j) {
            value = coefficients[j];
            value < minValue ? minValue = value : null;
            value > maxValue ? maxValue = value : null;
        }
        minArray.push(minValue);
        maxArray.push(maxValue);
        minValue = 1000000;
        maxValue = -1000000;
    }
    maxValue = Math.max.apply(null, maxArray);
    minValue = Math.min.apply(null, minArray);
    var range = maxValue - minValue;

    //Normalise data
    for(i=0; i<data.length; ++i) {
        value = (data[i] - minValue) / range;
        this.timbreSegmentsNormalised.push(value);
    }
};

FastApp.prototype.onShowGroup = function(name, value) {
    //Show relevant dataset
    var group = this.scene.getObjectByName(name);
    if(group) {
        if(value) {
            this.visibleModel = group;
        }
        group.traverse(function (obj) {
            if (obj instanceof THREE.Mesh) {
                obj.visible = value;
            }
        });
    }
};

FastApp.prototype.createGUI = function() {
    this.guiControls = new function() {
        this.Timbre = true;
        this.Pitch = false;
        this.ScaleX = 1.0;
        this.ScaleY = 1.0;
        this.ScaleZ = 1.0;
        this.LightX = 0.0;
        this.LightY = 200;
        this.LightZ = 0;
    };

    //Create GUI
    var gui = new dat.GUI();
    var _this = this;
    this.guiAppear = gui.addFolder("Appearance");
    //Scale the dataset
    var scaleX = this.guiAppear.add(this.guiControls, 'ScaleX', 0.25, 20).step(0.25);
    scaleX.listen();
    scaleX.onChange(function(value) {
        _this.onScaleChanged(X_AXIS, value);
    });
    var scaleY = this.guiAppear.add(this.guiControls, 'ScaleY', 0.25, 20).step(0.25);
    scaleY.listen();
    scaleY.onChange(function(value) {
        _this.onScaleChanged(Y_AXIS, value);
    });
    var scaleZ = this.guiAppear.add(this.guiControls, 'ScaleZ', 0.25, 20).step(0.25);
    scaleZ.listen();
    scaleZ.onChange(function(value) {
        _this.onScaleChanged(Z_AXIS, value);
    });

    //Move the light
    var lightX = this.guiAppear.add(this.guiControls, 'LightX', -500, 500).step(1.0);
    lightX.listen();
    lightX.onChange(function(value) {
        _this.onLightChanged(X_AXIS, value);
    });
    var lightY = this.guiAppear.add(this.guiControls, 'LightY', -500, 500).step(1.0);
    lightY.listen();
    lightY.onChange(function(value) {
        _this.onLightChanged(Y_AXIS, value);
    });
    var lightZ = this.guiAppear.add(this.guiControls, 'LightZ', -500, 500).step(1.0);
    lightZ.listen();
    lightZ.onChange(function(value) {
        _this.onLightChanged(Z_AXIS, value);
    });

    this.guiData = gui.addFolder("Data");
    var timbre = this.guiData.add(this.guiControls, 'Timbre', this.Timbre).onChange(function(value) {
        _this.onShowGroup('timbre', value);
    });
    timbre.listen();

    var pitch = this.guiData.add(this.guiControls, 'Pitch', this.Pitch).onChange(function(value) {
        _this.onShowGroup('pitch', value);
    });
    pitch.listen();
};

FastApp.prototype.onScaleChanged = function(axis, value) {
    //Scale along relevant axis
    var group = this.guiControls.Timbre ? this.scene.getObjectByName('timbre') : this.scene.getObjectByName('pitch');
    if(!group) {
        console.log("No group!");
        return;
    }
    switch(axis) {
        case X_AXIS:
            group.scale.x = value;
            break;

        case Y_AXIS:
            group.scale.y = value;
            break;

        case Z_AXIS:
            group.scale.z = value;
            break;

        default:
            break;
    }
};

FastApp.prototype.onLightChanged = function(axis, value) {
    var light = this.scene.getObjectByName("PointLight");
    if(!light) {
        console.log("No light!");
        return;
    }

    switch (axis) {
        case X_AXIS:
            light.position.x = value;
            break;

        case Y_AXIS:
            light.position.y = value;
            break;

        case Z_AXIS:
            light.position.z = value;
            break;

        default:
            break;
    }
    var lightBox = this.scene.getObjectByName("LightBox");
    if(!lightBox) {
        console.log("No lightbox!");
        return;
    }
    lightBox.position.set(light.position.x, light.position.y, light.position.z);
};

FastApp.prototype.rotateObject = function(direction) {
    //Get rotation
    if(this.visibleModel === undefined) return;
    switch(direction) {
        case ROT_UP:
            this.visibleModel.rotation.x += ROT_INC;
            break;
        case ROT_DOWN:
            this.visibleModel.rotation.x -= ROT_INC;
            break;
        case ROT_LEFT:
            this.visibleModel.rotation.y += ROT_INC;
            break;
        case ROT_RIGHT:
            this.visibleModel.rotation.y -= ROT_INC;
            break;
        default:
            break;
    }
};

FastApp.prototype.translateObject = function(direction) {
    if(this.visibleModel === undefined) return;
    switch (direction) {
        case ZOOM_IN:
            this.visibleModel.position.z += MOVE_INC;
            break;
        case ZOOM_OUT:
            this.visibleModel.position.z -= MOVE_INC;
            break;
        case PAN_UP:
            this.visibleModel.position.y += MOVE_INC;
            break;
        case PAN_DOWN:
            this.visibleModel.position.y -= MOVE_INC;
            break;
        case PAN_LEFT:
            this.visibleModel.position.x -= MOVE_INC;
            break;
        case PAN_RIGHT:
            this.visibleModel.position.x += MOVE_INC;
            break;
        default:
            break;
    }
};

FastApp.prototype.resetObject = function() {
    if(this.visibleModel === undefined) return;

    this.visibleModel.position.set(0, 0, 0);
    this.visibleModel.rotation.set(0, 0, 0);

    //Reset camera as well
    this.controls.reset();
    this.camera.position.set(0, 0, this.cameraStartZPos );
    this.controls.setLookAt(new THREE.Vector3(0, 0, 0));
    this.camera.rotation.set(0, 0, 0 );
};

$(document).ready(function() {

    //Init app
    if(!fileManager.init()) {
        alert("Cannot read files!");
    }

    var container = document.getElementById("WebGL-output");
    var app = new FastApp();
    app.init(container);
    app.createScene();
    app.createGUI();

    //GUI callbacks
    $("#chooseFile").on("change", function(evt) {
        app.loadNewFile(fileManager.onSelectFile(evt));
    });

    //Model movement
    $('#rotateUp').on("click", function(event) {
        event.preventDefault();
        app.rotateObject(ROT_UP);
    });

    $('#rotateDown').on("click", function(event) {
        event.preventDefault();
        app.rotateObject(ROT_DOWN);
    });

    $('#rotateLeft').on("click", function(event) {
        event.preventDefault();
        app.rotateObject(ROT_LEFT);
    });

    $('#rotateRight').on("click", function(event) {
        event.preventDefault();
        app.rotateObject(ROT_RIGHT);
    });

    $('#zoomIn').on("click", function(event) {
        event.preventDefault();
        app.translateObject(ZOOM_IN);
    });

    $('#zoomOut').on("click", function(event) {
        event.preventDefault();
        app.translateObject(ZOOM_OUT);
    });

    $('#panUp').on("click", function(event){
        event.preventDefault();
        app.translateObject(PAN_UP);
    });

    $('#panDown').on("click", function(event){
        event.preventDefault();
        app.translateObject(PAN_DOWN);
    });

    $('#panLeft').on("click", function(event){
        event.preventDefault();
        app.translateObject(PAN_LEFT);
    });

    $('#panRight').on("click", function(event){
        event.preventDefault();
        app.translateObject(PAN_RIGHT);
    });

    $('#reset').on("click", function(event) {
        event.preventDefault();
        app.resetObject();
    });

    app.run();
});
