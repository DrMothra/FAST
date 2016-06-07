/**
 * Created by atg on 16/05/2016.
 */
//Render into window of many in page

var CAM_PERSPECTIVE = 45, NEAR_CLIP_PLANE = 0.1, FAR_CLIP_PLANE = 5000;

//Camera views - position + lookat
var cameraViews = {
    front: [ new THREE.Vector3(10, 70, 70),
        new THREE.Vector3(10, 10, 20)],
    end: [ new THREE.Vector3(286, 36, 16),
        new THREE.Vector3(60, 0, 0)],
    top: [ new THREE.Vector3(80, 170, 20),
        new THREE.Vector3(80, 0, 10)]
};

function RenderWindow(element, width, height) {
    this.element = document.getElementById(element);
    this.element.style.height = height+"px";
    this.rect = this.element.getBoundingClientRect();
    this.aspectRatio = width/height;
    this.dataLoader = undefined;
    this.dataReady = false;
    this.file = undefined;
    this.renderUpdate = true;

    this.cameraView = 'front';
    this.clock = new THREE.Clock();

    //Message display
    this.msgElement = document.createElement("div");
    this.msgElement.id = element + 'Msg';
    this.msgElement.classList.add("displayInfo", "noDisplay");
    var left = ((this.rect.right - this.rect.left)/3) + this.rect.left,
        top = ((this.rect.bottom - this.rect.top)/2) + this.rect.top;
    this.msgElement.style.top = top + "px";
    this.msgElement.style.left = left + "px";
    document.body.appendChild(this.msgElement);
}

RenderWindow.prototype = {
    init: function() {
        this.rootOffset = new THREE.Vector3(-50, 0, 0);
        this.createCamera();
        this.createControls();
        this.setCamera(cameraViews.front);
    },

    createCamera: function() {
        this.camera = new THREE.PerspectiveCamera(CAM_PERSPECTIVE, this.aspectRatio, NEAR_CLIP_PLANE, FAR_CLIP_PLANE);
    },

    setCamera: function(cameraProp) {
        this.camera.position.set(cameraProp[0].x, cameraProp[0].y, cameraProp[0].z);
        this.controls.setLookAt(cameraProp[1]);
    },

    resetCamera: function() {
        //Camera back to start position
        this.controls.reset();
        this.setCamera(cameraViews[this.cameraView]);
    },

    createScene: function(datafile) {
        this.scene = new THREE.Scene();
        //Root object
        this.root = new THREE.Object3D();
        this.root.position.set(this.rootOffset.x, this.rootOffset.y, this.rootOffset.z);
        this.scene.add(this.root);
        
        var ambientLight = new THREE.AmbientLight(0x383838);
        this.scene.add(ambientLight);
        this.pointLight = new THREE.PointLight(0xffffff);
        this.pointLight.position.set(0, 200, 0);
        this.pointLight.name = 'PointLight';
        this.scene.add(this.pointLight);

        //Light box
        var size = 0.5;
        var lightMat = new THREE.MeshBasicMaterial( { color: 0xffffff});
        var lightGeom = new THREE.BoxGeometry(size, size, size);
        var lightMesh = new THREE.Mesh(lightGeom, lightMat);
        lightMesh.name = "LightBox";
        lightMesh.position.set(0, 200, 0);
        this.scene.add(lightMesh);

        if(!this.dataLoader) {
            console.log("No data loader");
            return;
        }

        //Now load music data
        this.loadData(datafile);
    },

    clearScene: function() {
        this.root.remove(this.renderAttribute.getTimeline());
        this.root.remove(this.renderAttribute.getRenderData());
        this.renderUpdate = true;
    },

    clearRenderData: function() {
        this.root.remove(this.renderAttribute.getRenderData());
    },

    loadData: function(datafile) {
        var _this = this;
        this.dataLoader.load(datafile, function(data) {
            _this.renderAttribute.setData(data);
            _this.renderAttribute.parseData();
            var segments = _this.renderAttribute.getSegmentData();
            _this.renderAttribute.normaliseRequired(true);
            _this.audioAttribute.getAudioData(_this.renderAttribute.getTrackID(), function() {
                var totalTime = 0, startTime = _this.renderAttribute.getStartTime();
                var margin = _this.audioAttribute.getTimeMargin(), duration = _this.audioAttribute.getDuration();
                var clipStart = startTime - margin;
                var endTime = startTime + duration + margin;
                var clipDuration = endTime - clipStart;
                var i;
                for(i=0; i<_this.renderAttribute.getDataLength(); ++i){
                    totalTime = segments[i];
                    if(totalTime >= clipStart) {
                        _this.startSegment = _this.startSegment === undefined ? i-1 : _this.startSegment;
                        if(totalTime >= endTime) {
                            _this.endSegment = i-1;
                            break;
                        }
                    }
                }

                //Generate markers
                _this.renderAttribute.generateMarkers(_this.startSegment, _this.endSegment);
                
                //Render it all
                _this.root.add(_this.renderAttribute.renderIndicator());
                _this.root.add(_this.renderAttribute.renderTimeline());
                _this.root.add(_this.renderAttribute.renderData(true));
                _this.dataReady = true;
                _this.renderUpdate = true;
                $('#' + _this.msgElement.id).hide();
            }, function() {
                console.log("Couldn't get audio preview");
                $('#' + _this.msgElement.id).html("Couldn't download audio");
                $('#' + _this.msgElement.id).show();
            })
        });
    },

    renderData: function(heatmap) {
        this.root.add(this.renderAttribute.renderData(heatmap));
    },

    getArtist: function() {
        return this.renderAttribute.getArtist();
    },
    
    getTrack: function() {
        return this.renderAttribute.getTrack();
    },
    
    createControls: function() {
        this.controls = new THREE.TrackballControls(this.camera, this.element);
        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.0;
        this.controls.panSpeed = 1.0;

        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0.3;

        this.controls.keys = [65, 83, 68];

        var lookAt = new THREE.Vector3(0, 0, 0);
        this.controls.setLookAt(lookAt);
    },

    update: function() {
        var delta = this.clock.getDelta();
        var audio = this.audioAttribute, render = this.renderAttribute;

        if(audio.isPlaying()) {
            this.renderUpdate = true;
            audio.updatePlayingTime(delta);
            if(audio.finished()) {
                audio.reset();
                render.reset();
                this.resetCamera();
                return;
            }
            render.update(delta);
            var deltaPos = render.getPlaybackSpeed() * delta;
            this.camera.position.x += deltaPos;
            this.lookAt = this.controls.getLookAt();
            this.lookAt.x += deltaPos;
            this.controls.setLookAt(this.lookAt);
        }
    },

    updateRequired: function() {
        return this.renderUpdate;
    },

    setUpdateRequired: function(update) {
        this.renderUpdate = update;
    },

    ready: function() {
        return this.dataReady;
    },

    loadNewFile: function(file) {
        this.file = file;
        this.clearScene();
        this.startSegment = undefined;
        this.renderAttribute.clearMarkers();
        //Render new data
        var _this = this;
        window.URL = window.URL || window.webkitURL;

        var fileUrl = window.URL.createObjectURL(this.file);
        this.loadData(fileUrl);
    },

    setRenderAttribute: function(attribute) {
        this.renderAttribute = attribute;
    },
    
    setAudioAttribute: function(attribute) {
        this.audioAttribute = attribute;
    },

    setDataLoader: function(loader) {
        this.dataLoader = loader;
    },

    setPlaying: function() {
        this.audioAttribute.setPlaying(state);
    },

    togglePlaying: function() {
        this.audioAttribute.togglePlaying();
    },
    
    isPlaying: function() {
        return this.audioAttribute.isPlaying();
    },

    resetPlaybackTime: function() {
        this.audioAttribute.resetPlaybackTime();
    },

    updatePlaybackTime: function() {
        this.audioAttribute.updatePlaybackTime();
    },
    
    reset: function() {
        this.audioAttribute.reset();
        this.renderAttribute.reset();
        //Reset camera
        this.setCamera(cameraViews[this.cameraView]);
    },

    setXScale: function(scale) {
        this.renderAttribute.setXScale(scale);
    },

    getXScale: function() {
        return this.renderAttribute.getXScale();
    },
    
    setYScale: function(scale) {
        this.renderAttribute.setYScale(scale);
    },

    getYScale: function() {
        return this.renderAttribute.getYScale();
    },

    setZScale: function(scale) {
        this.renderAttribute.setZScale(scale);
    },

    getZScale: function() {
        return this.renderAttribute.getZScale();
    },

    setOpacity: function(opacity) {
        this.renderAttribute.setOpacity(opacity);
    },

    getOpacity: function() {
        return this.renderAttribute.getOpacity();
    },

    getPlaybackSpeed: function() {
        return this.renderAttribute.getPlaybackSpeed();
    },

    setPlayheadStartPos: function(newPos) {
        this.renderAttribute.setPlayheadStartPos(newPos);
    },

    setPlayheadPos: function(newPos) {
        this.renderAttribute.setPlayheadPos(newPos);
    },

    getPlayheadPos: function() {
        return this.renderAttribute.getPlayheadPos();
    },
    
    setTimelinePos: function(newPos) {
        this.renderAttribute.setTimelinePos(newPos);
    },

    heatmapEnabled: function() {
        return this.renderAttribute.heatmapEnabled();

    },

    showDimension: function(value, dim) {
        this.renderAttribute.showDimension(value, dim);
    },

    showAllDimensions: function(status) {
        this.renderAttribute.showAllDimensions(status);
    },
    
    getDimensions: function() {
        return this.renderAttribute.getDimensions();
    }
};
