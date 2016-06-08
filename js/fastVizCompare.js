/**
 * Created by DrTone on 26/01/2016.
 */

var X_AXIS= 0, Y_AXIS= 1, Z_AXIS=2;
var STOP = -1, ROT_UP = 0, ROT_LEFT = 1, ROT_RIGHT = 2, ROT_DOWN = 3;
var ROT_INC = Math.PI/64;
var ZOOMOUT_INC = 1.1, ZOOMIN_INC = 0.9;
var ZOOM_IN = 4, ZOOM_OUT = 5, PAN_UP = 6, PAN_DOWN = 7, PAN_LEFT = 8, PAN_RIGHT = 9;
var MOVE_INC = 10;

//Init this app from base
function FastApp() {
    this.numRenderWindows = 4;
    this.renderWindows = [];
}

FastApp.prototype.init = function(container) {
    //Set up renderer
    this.canvas = container;
    var width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    this.renderer = new THREE.WebGLRenderer( { canvas: container, antialias: true, alpha: true});
    this.renderer.setClearColor(0x5c5f64, 1.0);
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize(width, height);
    this.renderer.setScissorTest(true);

    //Set up render windows
    var content = document.getElementById("content"),
        element, renderAttribute, audioAttribute;
    this.renderAttributes = [];
    this.audioAttributes = [];
    for(var i=0; i<this.numRenderWindows; ++i) {
        element = document.getElementById("scene" + i);
        this.renderWindows.push(new RenderWindow(element.id, width/2, height/2));
        this.renderWindows[i].init();
        renderAttribute = new RenderAttribute();
        this.renderAttributes.push(renderAttribute);
        this.renderWindows[i].setRenderAttribute(renderAttribute);
        audioAttribute = new AudioAttribute();
        this.audioAttributes.push(audioAttribute);
        this.renderWindows[i].setAudioAttribute(audioAttribute);
    }

    //Camera and controls
    //this.controls.disableMovement();
    //this.setCamera(cameraViews.front);
    this.cameraView = 'front';
    this.updateRequired = false;
    this.freeMovement = false;
    this.cameraStartZPos = 700;
    this.lookAt = new THREE.Vector3();
    this.xRot = 0;
    this.yRot = 0;
    this.xTrans = 0;
    this.yTrans = 0;
    this.zTrans = 0;
    this.rotQuatRight = new THREE.Quaternion();
    this.rotQuatRight.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ROT_INC);
    this.rotQuatLeft = new THREE.Quaternion();
    this.rotQuatLeft.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ROT_INC);
    this.rotating = false;
    this.numCoefficients = 12;
    this.activeSlot = 0;
    this.trackInfoUpdate = true;
    //Renderable attributes


    this.checkTime = 100;
    this.tempVec = new THREE.Vector3();
    //Audio attributes

};

FastApp.prototype.update = function() {
    var window;
    for(var i=0; i<this.renderWindows.length; ++i) {
        window = this.renderWindows[i];
        window.update();
    }
};

FastApp.prototype.run = function() {
    this.update();

    var _this = this;
    this.renderWindows.forEach( function(renderWindow) {
        if(!renderWindow.ready()) return;

        //if(!renderWindow.updateRequired()) return;
        
        //renderWindow.setUpdateRequired(false);
        
        if(_this.trackInfoUpdate) {
            _this.updateTrackInfo();
            _this.trackInfoUpdate = false;
        }
        renderWindow.controls.update();
        var rect = renderWindow.element.getBoundingClientRect();

        // check if it's offscreen. If so skip it
        if ( rect.bottom < 0 || rect.top  > _this.renderer.domElement.clientHeight ||
            rect.right  < 0 || rect.left > _this.renderer.domElement.clientWidth ) {
            return;  // it's off screen
        }
        // set the viewport
        var width  = rect.right - rect.left;
        var height = rect.bottom - rect.top;
        var left   = rect.left;
        var bottom = _this.renderer.domElement.clientHeight - rect.bottom;
        _this.renderer.setViewport( left, bottom, width, height );
        _this.renderer.setScissor( left, bottom, width, height );

        _this.renderer.render(renderWindow.scene, renderWindow.camera);
    });

    requestAnimationFrame(function() {
        _this.run();
    })
};

FastApp.prototype.createScene = function() {

    //Load objects
    var _this = this;

    //Load music data
    this.dataLoader = new dataLoader();
    var manager = new THREE.LoadingManager();
    var loader = new THREE.OBJLoader( manager );
    var window;
    var startTracks = ['data/BambergOrch_Presto.json',
                        'data/ledZeppelinPoorTom.json',
                        'data/JuanFlorezAllegro.json',
                        'data/prodigyFirestarter.json'];

    loader.load("models/arrow.obj", function(object) {
        for(var i=0; i<_this.renderAttributes.length; ++i) {
            _this.renderAttributes[i].setPlayhead(object);
            window = _this.renderWindows[i];
            window.setDataLoader(_this.dataLoader);
            window.createScene(startTracks[i]);
        }
    });
};

FastApp.prototype.loadNewFile = function(file) {
    if(!file) {
        alert("No file selected!");
        return;
    }
    //Reset everything
    var window = this.renderWindows[this.activeSlot];
    
    window.loadNewFile(file);
};

FastApp.prototype.onShowDimension = function(value, dim) {
    //Get group and traverse meshes
    var window = this.renderWindows[this.activeSlot];

    window.showDimension(value, dim);
};

FastApp.prototype.onShowAllDimensions = function(status) {
    var window = this.renderWindows[this.activeSlot];

    window.showAllDimensions(status);
};

FastApp.prototype.onStartChanged = function(value) {
    //Adjust playhead
    var window = this.renderWindows[this.activeSlot];

    var newPos = value * window.getPlaybackSpeed();
    window.setPlayheadStartPos(newPos);
    window.setPlayheadPos(newPos);
    window.setTimelinePos(newPos-0.25);
};

FastApp.prototype.createGUI = function() {
    var _this = this;
    this.guiControls = new function() {
        this.Start = 0.001;
        this.ScaleX = 1.0;
        this.ScaleY = 1.0;
        this.ScaleZ = 1.0;
        this.Opacity = 1;
        this.Heatmap = true;
    };

    //Create GUI
    var gui = new dat.GUI();
    //Appearance
    this.guiAppear = gui.addFolder("Appearance");
    //Scale the dataset
    var scaleX = this.guiAppear.add(this.guiControls, 'ScaleX', 0.25, 20).step(0.25);
    scaleX.listen();
    scaleX.onChange(function(value) {
        _this.onScaleChanged(X_AXIS, value);
    });
    var scaleY = this.guiAppear.add(this.guiControls, 'ScaleY', 0.25, 100).step(0.25);
    scaleY.listen();
    scaleY.onChange(function(value) {
        _this.onScaleChanged(Y_AXIS, value);
    });
    var scaleZ = this.guiAppear.add(this.guiControls, 'ScaleZ', 0.25, 20).step(0.25);
    scaleZ.listen();
    scaleZ.onChange(function(value) {
        _this.onScaleChanged(Z_AXIS, value);
    });
    var opacity = this.guiAppear.add(this.guiControls, 'Opacity', 0, 1);
    opacity.onChange(function(value) {
        _this.onOpacityChanged(value);
    });
    opacity.listen();

    //Heatmap
    var heatmap = this.guiAppear.add(this.guiControls, 'Heatmap').onChange(function(value) {
        _this.renderHeatmap(value);
    });
    heatmap.listen();

    //Data
    this.guiData = gui.addFolder("Data");
    var start = this.guiData.add(this.guiControls, 'Start', 0, 3).step(0.1);
    start.onChange(function(value) {
        _this.onStartChanged(value);
    });
    start.listen();

    //Dimensions
    var i;
    this.guiDimensions = gui.addFolder("Dimensions");
    this.dimensions = [];
    gui.ShowAll = true;

    //Dimension numbering starts from 1
    for (i=1; i<=this.numCoefficients; i++) {
        this.dimensions[i] = true;
    }

    var dimFunc;
    for (i=1; i<=this.numCoefficients; i++) (function(n){
        dimFunc = _this.guiDimensions.add(_this.dimensions, n);
        dimFunc.onChange(function(value) {
            _this.onShowDimension(value, n);
        });
        dimFunc.listen();
    })(i);

    this.guiDimensions.add(gui, "ShowAll").onChange(function(value) {
        for (i=1; i<=_this.numCoefficients; i++) {
            _this.dimensions[i] = value;
        }
        _this.onShowAllDimensions(value);
    });
};

FastApp.prototype.updateGUI = function() {
    var window = this.renderWindows[this.activeSlot];

    this.guiControls.ScaleX = window.getXScale();
    this.guiControls.ScaleY = window.getYScale();
    this.guiControls.ScaleZ = window.getZScale();

    this.guiControls.Opacity = window.getOpacity();
    this.guiControls.Heatmap = window.heatmapEnabled();
    
    this.guiControls.Start = window.getPlayheadPos() / window.getPlaybackSpeed();

    var dimensions = window.getDimensions();
    for(var i=0; i<dimensions.length; ++i) {
        this.dimensions[i] = dimensions[i];
    }
};

FastApp.prototype.onOpacityChanged = function(value) {
    var window = this.renderWindows[this.activeSlot];

    window.setOpacity(value);
};

FastApp.prototype.onScaleChanged = function(axis, value) {
    //Scale along relevant axis
    var window = this.renderWindows[this.activeSlot];

    switch(axis) {
        case X_AXIS:
            window.setXScale(value);
            break;

        case Y_AXIS:
            window.setYScale(value);
            break;

        case Z_AXIS:
            window.setZScale(value);
            break;

        default:
            break;
    }
};

FastApp.prototype.renderHeatmap = function(heatmap) {
    var window = this.renderWindows[this.activeSlot];

    window.clearRenderData();
    window.renderData(heatmap);
};

FastApp.prototype.rotateScene = function(direction) {
    //Get vector from camera to lookat
    var lookAt = this.controls.getLookAt();
    //this.root.applyMatrix( new THREE.Matrix4().makeTranslation(0, 0, -5));
    switch (direction) {
        case ROT_LEFT:
            this.root.rotation.y += ROT_INC;
            break;

        case ROT_RIGHT:
            this.root.rotation.y -= ROT_INC;
            break;

        default:
            break;
    }
};

FastApp.prototype.rotateCamera = function(direction) {
    //Rotate camera around lookat point
    this.tempVec.copy(this.camera.position);
    var vec = this.controls.getLookAt();
    this.tempVec.sub(vec);

    switch(direction) {
        case ROT_RIGHT:
            this.tempVec.applyQuaternion(this.rotQuatRight);
            break;

        case ROT_LEFT:
            this.tempVec.applyQuaternion(this.rotQuatLeft);
            break;

        default:
            break;
    }

    this.tempVec.add(this.controls.getLookAt());
    this.updateRequired = true;
    //this.camera.position.set(this.tempVec.x, this.tempVec.y, this.tempVec.z);
};

FastApp.prototype.translateCamera = function(direction) {
    //Translate along lookat vector
    this.tempVec.copy(this.camera.position);
    var vec = this.controls.getLookAt();
    this.tempVec.sub(vec);

    switch (direction) {
        case ZOOM_IN:
            this.tempVec.multiplyScalar(ZOOMIN_INC);
            break;

        case ZOOM_OUT:
            this.tempVec.multiplyScalar(ZOOMOUT_INC);
            break;
    }

    this.tempVec.add(this.controls.getLookAt());
    this.updateRequired = true;
};

FastApp.prototype.resetCamera = function() {
    //Camera back to start position
    var window = this.renderWindows[this.activeSlot];

    window.resetCamera();
};

FastApp.prototype.repeat = function(direction) {
    if(direction === STOP) {
        if(this.repeatTimer) {
            clearInterval(this.repeatTimer);
        }
        return;
    }

    var _this = this;
    switch(direction) {
        case ROT_UP:
            this.xRot = -ROT_INC;
            this.yRot = 0;
            this.rotating = true;
            break;

        case ROT_DOWN:
            this.xRot = ROT_INC;
            this.yRot = 0;
            this.rotating = true;
            break;

        case ROT_LEFT:
            this.xRot = 0;
            this.yRot = -ROT_INC;
            this.rotating = true;
            break;

        case ROT_RIGHT:
            this.xRot = 0;
            this.yRot = ROT_INC;
            this.rotating = true;
            break;

        case ZOOM_IN:
            this.xTrans = this.yTrans = this.zTrans = 0;
            this.zTrans = MOVE_INC;
            this.rotating = false;
            break;

        case ZOOM_OUT:
            this.xTrans = this.yTrans = this.zTrans = 0;
            this.zTrans = -MOVE_INC;
            this.rotating = false;
            break;

        case PAN_UP:
            this.xTrans = this.yTrans = this.zTrans = 0;
            this.yTrans = MOVE_INC;
            this.rotating = false;
            break;

        case PAN_DOWN:
            this.xTrans = this.yTrans = this.zTrans = 0;
            this.yTrans = -MOVE_INC;
            this.rotating = false;
            break;

        case PAN_LEFT:
            this.xTrans = this.yTrans = this.zTrans = 0;
            this.xTrans = -MOVE_INC;
            this.rotating = false;
            break;

        case PAN_RIGHT:
            this.xTrans = this.yTrans = this.zTrans = 0;
            this.xTrans = MOVE_INC;
            this.rotating = false;
            break;

        default:
            break;
    }

    this.repeatTimer = setInterval(function() {
        if(_this.rotating) {

        } else {

        }
    }, this.checkTime)
};

FastApp.prototype.changeControls = function() {
    this.freeMovement = !this.freeMovement;
    this.freeMovement ? this.controls.enableMovement() : this.controls.disableMovement();
};

FastApp.prototype.playTrack = function() {
    var window = this.renderWindows[this.activeSlot];
    var playState = $('#playState');
    
    window.togglePlaying();
    if(window.isPlaying()) {
        window.resetPlaybackTime();
        playState.attr("src", "images/pause.png");
    } else {
        window.updatePlaybackTime();
        playState.attr("src", "images/play.png");
    }
};

FastApp.prototype.changeView = function(slotId) {
    var slot = slotId.slice(-1);
    slot = parseInt(slot, 10);
    if(isNaN(slot)) {
        console.log("Not a valid slot");
        return;
    }
    this.activeSlot = --slot;
    this.updateTrack();
    this.updateGUI();
};

FastApp.prototype.updateTrack = function() {
    //Music controls
    var playState = $('#playState');
    var window = this.renderWindows[this.activeSlot];

    if(window.isPlaying()) {
        playState.attr("src", "images/pause.png");
    } else {
        playState.attr("src", "images/play.png");
    }
    this.updateTrackInfo();
};

FastApp.prototype.updateTrackInfo = function() {
    var window = this.renderWindows[this.activeSlot];

    $('#trackInfoArtist').html("Artist: " + window.getArtist());
    $('#trackInfoTrack').html("Track: " + window.getTrack());
};

FastApp.prototype.resetTrack = function() {
    var window = this.renderWindows[this.activeSlot];
    window.reset();

    $('#playState').attr("src", "images/play.png");
};

$(document).ready(function() {

    //See if we have WebGL support
    if(!Detector.webgl) {
        $('#notSupported').show();
    }

    //Init app
    if(!fileManager.init()) {
        alert("Cannot read files!");
    }

    var container = document.getElementById("WebGL-output");
    var app = new FastApp();
    app.init(container);
    app.createGUI();
    app.createScene();

    //GUI callbacks
    $('#camFront').on("click", function() {
        app.changeView('front');
    });
    $('#camTop').on("click", function() {
        app.changeView('top');
    });
    $('#camEnd').on("click", function() {
        app.changeView('end');
    });

    $("#chooseFile").on("change", function(evt) {
        app.loadNewFile(fileManager.onSelectFile(evt));
    });

    //View movement
    $('#rotateLeft').on("mousedown", function(event) {
        event.preventDefault();
        app.rotateCamera(ROT_LEFT);
    });

    $('#rotateRight').on("mousedown", function(event) {
        event.preventDefault();
        app.rotateCamera(ROT_RIGHT);
    });

    $('[id^=rotate]').on("mouseup", function(event) {
        app.repeat(STOP);
    });

    $('#zoomIn').on("mousedown", function(event) {
        event.preventDefault();
        app.translateCamera(ZOOM_IN);
    });

    $('#zoomOut').on("mousedown", function(event) {
        event.preventDefault();
        app.translateCamera(ZOOM_OUT);
    });

    $('[id^=zoom]').on("mouseup", function(event) {
        event.preventDefault();
        app.repeat(STOP);
    });

    $('#freeMove').on("change", function(event) {
        event.preventDefault();
        app.changeControls();
    });

    var slots = $('[id^=slot]');
    slots.on('click', function(event) {
        event.preventDefault();
        slots.removeClass('active');
        $(this).addClass('active');
        app.changeView(this.id);
    });

    $('#reset').on("click", function(event) {
        event.preventDefault();
        app.resetCamera();
    });

    $('#playState').on("click", function() {
        app.playTrack();
    });

    $('#rewind').on("click", function() {
        app.resetTrack();
    });
    app.run();
});
