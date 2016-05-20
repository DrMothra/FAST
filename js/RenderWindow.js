/**
 * Created by atg on 16/05/2016.
 */
//Render into window of many in page

var CAM_PERSPECTIVE = 45, NEAR_CLIP_PLANE = 0.1, FAR_CLIP_PLANE = 5000;
var CAM_ZPOS = 100;

function RenderWindow(element, width, height) {
    this.element = document.getElementById(element);
    this.element.style.height = height+"px";
    this.aspectRatio = width/height;
    this.camPos = new THREE.Vector3(0, 0, CAM_ZPOS);
    this.dataLoader = undefined;
    this.dataReady = false;
}

RenderWindow.prototype = {
    init: function() {
        this.createCamera();
        this.createControls();
    },

    createCamera: function() {
        this.camera = new THREE.PerspectiveCamera(CAM_PERSPECTIVE, this.aspectRatio, NEAR_CLIP_PLANE, FAR_CLIP_PLANE);
        this.camera.position.set(this.camPos.x, this.camPos.y, this.camPos.z);
    },

    createScene: function(datafile) {
        this.scene = new THREE.Scene();
        //Root object
        this.root = new THREE.Object3D();
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
        this.root.add(lightMesh);

        if(!this.dataLoader) {
            console.log("No data loader");
            return;
        }

        //Now load music data
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
                _this.root.add(_this.renderAttribute.renderTimeline());
                _this.root.add(_this.renderAttribute.renderData(true));
                _this.dataReady = true;
            })
        });
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

    ready: function() {
        return this.dataReady;
    },

    setRenderAttribute: function(attribute) {
        this.renderAttribute = attribute;
    },
    
    setAudioAttribute: function(attribute) {
        this.audioAttribute = attribute;
    },

    setDataLoader: function(loader) {
        this.dataLoader = loader;
    }
};
