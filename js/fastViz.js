/**
 * Created by DrTone on 26/01/2016.
 */

var X_AXIS= 0, Y_AXIS= 1, Z_AXIS=2;
var STOP = -1, ROT_UP = 0, ROT_LEFT = 1, ROT_RIGHT = 2, ROT_DOWN = 3;
var ROT_INC = Math.PI/64;
var ZOOMOUT_INC = 1.1, ZOOMIN_INC = 0.9;
var ZOOM_IN = 4, ZOOM_OUT = 5, PAN_UP = 6, PAN_DOWN = 7, PAN_LEFT = 8, PAN_RIGHT = 9;
var MOVE_INC = 10;
var START_TIME = 30;
var SAMPLE_RATE = 44100;

//Camera views
var cameraViews = {
    front: [ new THREE.Vector3(50, 70, 120),
             new THREE.Vector3(50, 10, 20)],
    end: [ new THREE.Vector3(286, 36, 16),
           new THREE.Vector3(60, 0, 0)],
    top: [ new THREE.Vector3(80, 170, 20),
           new THREE.Vector3(80, 0, 10)]
};

//Init this app from base
function FastApp() {
    BaseApp.call(this);
}

FastApp.prototype = new BaseApp();

FastApp.prototype.init = function(container) {
    BaseApp.prototype.init.call(this, container);
    this.controls.disableMovement();
    this.setCamera(cameraViews.front);
    this.cameraView = 'front';
    this.updateRequired = false;
    this.freeMovement = false;
    this.fileName = null;
    this.data = null;
    this.artistName = null;
    this.trackName = null;
    this.numCoefficients = 12;
    this.segments = [];
    this.segmentGap = 0;
    this.segmentWidth = 2;
    this.timbreSegments = [];
    this.startSegment = undefined;
    this.markers = [];
    this.timbreSegmentsNormalised = null;
    this.pitchSegments = [];
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
    this.checkTime = 100;
    this.playHead = undefined;
    this.startPlayhead = 0;
    this.timeMargin = 2;
    this.timelineDimensions = new THREE.Vector3(0.5, 15, 37.5);
    this.timelineZPos = 17.5;
    this.duration = 0;
    this.playingTime = 0;
    this.tempVec = new THREE.Vector3();
    //Web audio
    var webkitAudio = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new webkitAudio();
};

FastApp.prototype.update = function() {
    var delta = this.clock.getDelta();

    //Animate
    if(this.playing) {
        this.playingTime += delta;
        if(this.playingTime > this.duration) {
            this.playingTime = 0;
            this.resetTrack();
            return;
        }
        var deltaPos = this.unitsPerSecond * delta;
        this.playHead.position.x += deltaPos;
        this.camera.position.x += deltaPos;
        this.lookAt = this.controls.getLookAt();
        this.lookAt.x += deltaPos;
        this.controls.setLookAt(this.lookAt);
        this.timelineIndicatorPitch.position.x = this.playHead.position.x-0.25;
        this.timelineIndicatorTimbre.position.x = this.playHead.position.x-0.25;
    }

    if(this.updateRequired) {
        this.camera.position.set(this.tempVec.x, this.tempVec.y, this.tempVec.z);
        this.updateRequired = false;
    }

    BaseApp.prototype.update.call(this);
};

FastApp.prototype.createScene = function() {
    BaseApp.prototype.createScene.call(this);

    //Root object
    this.root = new THREE.Object3D();
    this.scene.add(this.root);

    //Light box
    var size = 0.5;
    var lightMat = new THREE.MeshBasicMaterial( { color: 0xffffff});
    var lightGeom = new THREE.BoxGeometry(size, size, size);
    var lightMesh = new THREE.Mesh(lightGeom, lightMat);
    lightMesh.name = "LightBox";
    lightMesh.position.set(0, 200, 0);
    this.root.add(lightMesh);

    //Load objects
    var _this = this;
    var manager = new THREE.LoadingManager();
    var loader = new THREE.OBJLoader( manager );
    loader.load("models/arrow.obj", function(object) {
        object.scale.set(0.05, 0.05, 0.05);
        object.position.set(_this.startPlayhead, 0, 35);
        _this.root.add(object);
        _this.playHead = object;
    });

    //Rendering attributes
    this.timbreAttributes = {
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        opacity: 1,
        colour: 0xff0000,
        yOffset: 20,
        dimensions: [true, true, true, true, true, true, true, true, true, true, true, true, true]
    };

    this.pitchAttributes = {
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        opacity: 1,
        colour: 0x0000ff,
        yOffset: 0,
        dimensions: [true, true, true, true, true, true, true, true, true, true, true, true, true]
    };

    //Load json data

    this.dataLoader = new dataLoader();

    this.dataLoader.load("data/williams.json", function(data) {
        _this.data = data;
        //DEBUG
        console.log("File loaded");
        _this.parseData();
    });

};

FastApp.prototype.loadNewFile = function(file) {
    if(!file) {
        alert("No file selected!");
        return;
    }
    this.file = file;
    //Reset current scene
    var removeGroup = this.scene.getObjectByName('Timbre');
    if(!removeGroup) {
        console.log("No timbre group");
    }
    this.root.remove(removeGroup);
    removeGroup = this.scene.getObjectByName('Pitch');
    if(!removeGroup) {
        console.log("No pitch group");
    }
    this.root.remove(removeGroup);

    //Reset any data
    this.markers = [];

    //Render new data
    var _this = this;
    window.URL = window.URL || window.webkitURL;

    var fileUrl = window.URL.createObjectURL(this.file);
    this.dataLoader.load(fileUrl, function(data) {
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
            this.trackID = songData[0][19];
            $('#trackInfoArtist').html("Artist: " + this.artistName);
            $('#trackInfoTrack').html("Track: " + this.trackName);
            console.log(this.artistName + ' ' + this.trackName);
            break;
        }
    }

    //Get segments
    for(prop in datasets) {
        alias = datasets[prop].alias;
        if(alias[0] === '/analysis/segments_start') {
            this.segments = datasets[prop].value;
            console.log("Got segments");
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

    for(prop in datasets) {
        alias = datasets[prop].alias;
        if(alias[0] === '/analysis/segments_pitches') {
            this.pitchSegments = datasets[prop].value;
            console.log("Got pitches");
            break;
        }
    }

    //Get mp3 and start time
    this.startPlayhead = this.data["start_time"];
    this.guiControls.Start = this.startPlayhead;

    //Calculate segments per second
    var numSegments = this.segments.length;
    var segmentWidth = 2;
    var distance;

    var _this = this;
    this.getAudioData(url, function() {
        //Set up audio
        _this.source = _this.audioContext.createBufferSource();
        _this.source.buffer = _this.audioBuffer;
        _this.source.connect(_this.audioContext.destination);
        _this.playbackTime = 0;

        var totalTime = 0, startTime = START_TIME - _this.timeMargin, endTime = START_TIME + _this.source.buffer.duration + _this.timeMargin;
        _this.duration = endTime - startTime;
        var i;
        for(i=0; i<_this.segments.length; ++i){
            totalTime = _this.segments[i];
            if(totalTime >= startTime) {
                _this.startSegment = _this.startSegment === undefined ? i-1 : _this.startSegment;
                if(totalTime >= endTime) {
                    _this.endSegment = i-1;
                    break;
                }
            }
        }

        //Calculate playback speed
        var time = _this.segments[_this.endSegment+1] - _this.segments[_this.startSegment];
        var distance = (_this.endSegment - _this.startSegment) + 1;
        distance = distance * _this.segmentWidth;
        _this.unitsPerSecond = distance/time;

        //Create markers
        var MARKER_INC = 5;
        var markerObj;
        var currentSecond = Math.round(_this.segments[_this.startSegment]);
        for(i=_this.startSegment; i<_this.endSegment+1; ++i) {
            totalTime = _this.segments[i];
            if(totalTime >= currentSecond) {
                distance = (currentSecond * _this.unitsPerSecond);
                markerObj = {};
                markerObj.distance = distance;
                markerObj.time = currentSecond;
                _this.markers.push(markerObj);
                currentSecond += MARKER_INC;
            }
        }

        _this.renderTimeline();
        _this.renderAttribute('Timbre', _this.timbreSegments, _this.timbreAttributes, true);
        _this.renderAttribute('Pitch', _this.pitchSegments, _this.pitchAttributes, false);
        _this.timelineIndicatorTimbre = _this.scene.getObjectByName('timelineTimbre');
        if(!_this.timelineIndicatorTimbre) {
            alert("No timbre timeline");
        }
        _this.timelineIndicatorPitch = _this.scene.getObjectByName('timelinePitch');
        if(!_this.timelineIndicatorPitch) {
            alert("No pitch timeline");
        }
        _this.onStartChanged(_this.startPlayhead);
    });
};

FastApp.prototype.getAudioData = function(fileURL, callback) {
    //Get audio preview
    var _this = this;
    var now = Math.floor(new Date().getTime() / 1000);
    var httpMethod = "GET",
        url = "http://previews.7digital.com/clip/",
        parameters = {
            country : "GB",
            oauth_consumer_key : "7dqw7pfc7sbw",
            oauth_nonce : "633782801",
            oauth_signature_method : "HMAC-SHA1",
            oauth_timestamp : now,
            oauth_version : "1.0"
        },
        consumerSecret = "qqx9pe6s6rfhnv37",
        tokenSecret = "",
    // generates a RFC 3986 encoded, BASE64 encoded HMAC-SHA1 hash
        encodedSignature = oauthSignature.generate(httpMethod, url+this.trackID, parameters, consumerSecret, tokenSecret),
    // generates a BASE64 encode HMAC-SHA1 hash
        signature = oauthSignature.generate(httpMethod, url, parameters, consumerSecret, tokenSecret,
            { encodeSignature: false});

    var xhr = new XMLHttpRequest();
    url = "http://previews.7digital.com/clip/";
    var key = "&oauth_consumer_key=" + parameters.oauth_consumer_key;
    var country = "?country=GB";
    var oauthNonce = "&oauth_nonce=" + parameters.oauth_nonce;
    var sigMethod = "&oauth_signature_method=" + parameters.oauth_signature_method;
    var oauthTimestamp = "&oauth_timestamp=" + now;
    var oauthVersion = "&oauth_version=1.0";
    var oauthSig = "&oauth_signature=" + encodedSignature;

    var previewURL = url + this.trackID + country + key + oauthNonce + sigMethod + oauthTimestamp + oauthVersion + oauthSig;
    xhr.open("GET", previewURL, true);
    xhr.responseType = 'arraybuffer';
    xhr.onreadystatechange = function() {
        if(xhr.readyState === 4) {
            if(xhr.status === 200) {
                console.log("Downloaded preview");
                $('#downloadError').hide();
                _this.audioContext.decodeAudioData(xhr.response, function(buffer) {
                    _this.audioBuffer = buffer;
                    callback();
                }, onError);
            } else {
                $('#downloadError').show();
            }
        }
    };

    xhr.send();

    function onError() {
        //DEBUG
        console.log("There was an audio error");
    }

    /*
    //Load mp3 file
    var _this = this;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onreadystatechange = function() {
        if(xhr.readyState === 4) {
            if(xhr.status === 200) {
                console.log("Loaded soundfile");
                $('#downloadError').hide();
                _this.audioContext.decodeAudioData(xhr.response, function(buffer) {
                    _this.audioBuffer = buffer;
                    callback();
                }, onError);
            } else {
                $('#downloadError').show();
            }
        }
    };

    xhr.send();

    function onError() {
        //DEBUG
        console.log("There was an audio error");
    }
    */
};

FastApp.prototype.renderAttribute = function(name, data, attributes, normalise) {
    //Render data attribute
    var dataGroup = new THREE.Object3D();
    dataGroup.name = name;
    dataGroup.position.y = attributes.yOffset;
    //Timeline indicator
    var timelineMat = new THREE.MeshBasicMaterial( { color: 0xffffff,
                                                     opacity: 0.25,
                                                     transparent: true});
    var timelineGeom = new THREE.BoxGeometry(this.timelineDimensions.x,
        this.timelineDimensions.y, this.timelineDimensions.z);
    var timelineIndicator = new THREE.Mesh(timelineGeom, timelineMat);
    timelineIndicator.name = "timeline" + name;
    timelineIndicator.position.set(this.startPlayhead-0.25, this.timelineDimensions.y/2, this.timelineZPos);
    dataGroup.add(timelineIndicator);

    var numCoefficients = 12, numSegments = this.endSegment - this.startSegment + 1;
    var startX = 0, startY = 0, startZ = 0;
    var interZgap = 1;
    var timeSlice, nextTimeSlice;
    var width = 2, depth = 2;
    var xScale, xOffset;

    var boxMat = new THREE.MeshLambertMaterial( {color: attributes.colour,
                                                 opacity: attributes.opacity,
                                                 transparent: true
    } );
    var geom = new THREE.BoxGeometry(this.segmentWidth, 1, depth, 1, 1, 1);
    var defaultTimeSlice = (this.segments[this.endSegment + 1] - this.segments[this.startSegment]) / numSegments;
    var mesh;

    //Get relevant data
    var segmentData = data;

    if(normalise) {
        segmentData = this.normaliseData(segmentData);
    }

    //Render first segment
    var coefficients, height;
    coefficients = segmentData[this.startSegment];
    timeSlice = this.segments[this.startSegment+1] - this.segments[this.startSegment];
    xScale = timeSlice/defaultTimeSlice;
    xOffset = (xScale * this.segmentWidth)/2;
    for(var j=0; j<numCoefficients; ++j) {
        height = coefficients[j] < 0 ? coefficients[j] * -1 : coefficients[j];
        startY = coefficients[j] < 0 ? -height/2 : height/2;
        mesh = new THREE.Mesh(geom, boxMat);
        mesh.name = "row" + j + "col" + this.startSegment;
        mesh.position.set(startX, startY, startZ + (j * (interZgap + depth)));
        mesh.visible = height > 0;
        mesh.scale.y = height <= 0 ? 0.001 : height;
        mesh.scale.x = xScale;
        dataGroup.add(mesh);
    }
    startX = startX + xOffset+ this.segmentGap;

    for(var i=this.startSegment+1; i<=this.endSegment; ++i) {
        coefficients = segmentData[i];
        timeSlice = this.segments[i+1] - this.segments[i];
        xScale = timeSlice/defaultTimeSlice;
        xOffset = (xScale * this.segmentWidth)/2;

        for(var j=0; j<numCoefficients; ++j) {
            height = coefficients[j] < 0 ? coefficients[j] * -1 : coefficients[j];
            startY = coefficients[j] < 0 ? -height/2 : height/2;
            mesh = new THREE.Mesh(geom, boxMat);
            mesh.name = "row" + j + "col" + i;
            mesh.position.set(startX + xOffset, startY, startZ + (j * (interZgap + depth)));
            mesh.visible = height > 0;
            mesh.scale.y = height <= 0 ? 0.001 : height;
            mesh.scale.x = xScale;
            dataGroup.add(mesh);
        }
        startX = startX + (xOffset*2) + this.segmentGap;
    }

    this.root.add(dataGroup);
};

FastApp.prototype.renderTimeline = function() {
    //Timeline
    var timelineGroup = new THREE.Object3D();
    this.root.add(timelineGroup);
    var depth = 2, interZgap = 1;
    var numSegments = this.endSegment - this.startSegment + 1;
    var lineGeom = new THREE.Geometry();
    var timeLineX = (numSegments * this.segmentWidth);
    var timeLineZ = (this.numCoefficients-1) * (depth + interZgap) + 7.5;
    lineGeom.vertices.push(new THREE.Vector3(0, 0, timeLineZ));
    lineGeom.vertices.push(new THREE.Vector3(timeLineX, 0, timeLineZ));
    var lineMat = new THREE.MeshBasicMaterial( {color: 0xffffff});
    var line = new THREE.Line(lineGeom, lineMat);
    timelineGroup.add(line);

    //Divisions
    var labelPos = new THREE.Vector3(-3, -4, timeLineZ), labelScale = new THREE.Vector3(24, 8, 1);
    var timeLabel = spriteManager.create("Time", labelPos, labelScale, 12, 1, true, false);
    timelineGroup.add(timeLabel);
    //Time markers
    labelPos.x = 0;
    spriteManager.setTextColour([255, 255, 255]);
    var numberLabel = spriteManager.create(this.markers[0].time + " s", labelPos, labelScale, 12, 1, true, false);
    timelineGroup.add(numberLabel);
    for(var i=1; i<this.markers.length; ++i) {
        labelPos.x = this.markers[i].distance - this.markers[0].distance;
        numberLabel = spriteManager.create(this.markers[i].time + " s", labelPos, labelScale, 12, 1, true, false);
        timelineGroup.add(numberLabel);
    }
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
    var normalData = data.slice();
    var normalCoeffs;
    for(i=0; i<data.length; ++i) {
        coefficients = data[i];
        normalCoeffs = normalData[i];
        for(j=0; j<this.numCoefficients; ++j) {
            value = (coefficients[j] - minValue) / range;
            normalCoeffs[j] = value;
        }
    }

    return normalData;
};

FastApp.prototype.onShowGroup = function(name, value) {
    //Show relevant dataset
    var group = this.scene.getObjectByName(name);
    if(group) {
        group.traverse(function (obj) {
            if (obj instanceof THREE.Mesh) {
                obj.visible = value;
            }
        });
    }
};

FastApp.prototype.onShowDimension = function(value, dim) {
    //DEBUG
    //console.log("Value = ", value, dim);
    //Get group and traverse meshes
    var attribute = this.guiControls.Attribute === 'Timbre' ? this.timbreAttributes : this.pitchAttributes;
    var group = this.scene.getObjectByName(this.guiControls.Attribute);
    if(group) {
        var rowName = dim-1;
        group.traverse(function(obj) {
            if (obj instanceof THREE.Mesh) {
                if(obj.name.indexOf("row"+rowName+"col") !== -1) {
                    obj.visible = value;
                }
            }
        });
        attribute.dimensions[dim] = value;
    }
};

FastApp.prototype.onShowAllDimensions = function(status) {
    var group = this.scene.getObjectByName(this.guiControls.Attribute);
    if(group) {
        group.traverse(function(obj) {
            if (obj instanceof THREE.Mesh) {
                obj.visible = status;
            }
        });
    }
};

FastApp.prototype.onStartChanged = function(value) {
    //Adjust playhead
    this.startPlayhead = value * this.unitsPerSecond;
    this.playHead.position.x = this.startPlayhead;
    this.timelineIndicatorPitch.position.x = this.startPlayhead -0.25;
    this.timelineIndicatorTimbre.position.x = this.startPlayhead -0.25;
};

FastApp.prototype.createGUI = function() {
    var _this = this;
    this.guiControls = new function() {
        this.Timbre = true;
        this.Pitch = true;
        this.Attribute = 'Timbre';
        this.Start = 0.001;
        this.ScaleX = 1.0;
        this.ScaleY = 1.0;
        this.ScaleZ = 1.0;
        this.Opacity = 1;
        this.TimbreOffset = 0;
        this.LightX = 0.0;
        this.LightY = 200;
        this.LightZ = 0;
    };

    //Create GUI
    var gui = new dat.GUI();
    this.guiAppear = gui.addFolder("Appearance");
    //Scale the dataset
    this.guiAppear.add(this.guiControls, 'Attribute', ['Timbre', 'Pitch']).onChange(function(value) {
        _this.onAttributeChanged(value);
    });
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
    this.guiAppear.add(this.guiControls, 'TimbreOffset', -20, 20).onChange(function(value) {
        _this.onOffsetChanged(value);
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
    var timbre = this.guiData.add(this.guiControls, 'Timbre').onChange(function(value) {
        _this.onShowGroup('Timbre', value);
    });
    timbre.listen();

    var pitch = this.guiData.add(this.guiControls, 'Pitch').onChange(function(value) {
        _this.onShowGroup('Pitch', value);
    });
    pitch.listen();

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

FastApp.prototype.onAttributeChanged = function(value) {
    var attribute = value === 'Timbre' ? this.timbreAttributes : this.pitchAttributes;
    this.guiControls.ScaleX = attribute.scaleX;
    this.guiControls.ScaleY = attribute.scaleY;
    this.guiControls.ScaleZ = attribute.scaleZ;
    this.guiControls.Opacity = attribute.opacity;
    for(var i=0; i<this.dimensions.length; ++i) {
        this.dimensions[i] = attribute.dimensions[i];
    }
};

FastApp.prototype.onOffsetChanged = function(value) {
    //Alter timbre group only
    var group = this.scene.getObjectByName('Timbre');
    if(group) {
        group.position.y = this.timbreAttributes.yOffset + value;
    }
};

FastApp.prototype.onOpacityChanged = function(value) {
    var group = this.guiControls.Attribute === 'Timbre' ? this.scene.getObjectByName('Timbre') : this.scene.getObjectByName('Pitch');
    if(group) {
        var attributes = this.guiControls.Attribute === 'Timbre' ? this.timbreAttributes : this.pitchAttributes;
        for(var child=0; child<group.children.length; ++child) {
            group.children[child].material.opacity = value;
        }
        attributes.opacity = value;
    }
};

FastApp.prototype.onScaleChanged = function(axis, value) {
    //Scale along relevant axis
    var group, attribute, timeline;
    if(this.guiControls.Attribute === 'Timbre') {
        group = this.scene.getObjectByName('Timbre');
        attribute = this.timbreAttributes;
        timeline = this.timelineIndicatorTimbre;
    } else {
        group = this.scene.getObjectByName('Pitch');
        attribute = this.pitchAttributes;
        timeline = this.timelineIndicatorPitch;
    }
    if(!group) {
        console.log("No group!");
        return;
    }

    switch(axis) {
        case X_AXIS:
            group.scale.x = value;
            attribute.scaleX = value;
            break;

        case Y_AXIS:
            group.scale.y = value;
            attribute.scaleY = value;
            timeline.scale.y = 1/value;
            timeline.position.y = (this.timelineDimensions.y/2) * timeline.scale.y;
            break;

        case Z_AXIS:
            group.scale.z = value;
            attribute.scaleZ = value;
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
    this.controls.reset();
    this.setCamera(cameraViews[this.cameraView]);
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

FastApp.prototype.changeView = function(viewName) {
    if(!viewName) {
        console.log("No camera view name!");
        return;
    }
    this.cameraView = viewName;
    this.setCamera(cameraViews[this.cameraView]);
};

FastApp.prototype.changeControls = function() {
    this.freeMovement = !this.freeMovement;
    this.freeMovement ? this.controls.enableMovement() : this.controls.disableMovement();
};

FastApp.prototype.playTrack = function(trackState) {
    this.playing = trackState;
    if(this.playing) {
        this.playbackStartTime = Date.now();
        this.source.start(0, this.playbackTime);
    } else {
        this.playbackTime += ((Date.now() - this.playbackStartTime)/1000);
        this.source.stop(0);
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.audioContext.destination);
    }
};

FastApp.prototype.resetTrack = function() {
    if(this.playing) {
        this.source.stop(0);
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.audioContext.destination);
    }
    this.playing = false;
    this.playbackTime = 0;
    this.playHead.position.set(this.startPlayhead, 0, 35);
    this.timelineIndicatorPitch.position.set(this.startPlayhead-0.25, (this.timelineDimensions.y/2) * this.timelineIndicatorPitch.scale.y,
        this.timelineZPos);
    this.timelineIndicatorTimbre.position.set(this.startPlayhead-0.25, (this.timelineDimensions.y/2) * this.timelineIndicatorTimbre.scale.y,
        this.timelineZPos);
    $('#playState').attr("src", "images/play.png");
    this.setCamera(cameraViews[this.cameraView]);
};

FastApp.prototype.isPlaying = function() {
    return this.playing;
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
    
    $('#reset').on("click", function(event) {
        event.preventDefault();
        app.resetCamera();
    });

    $('#playState').on("click", function() {
        app.playTrack(!app.isPlaying());
        $('#playState').attr("src", app.isPlaying() ? "images/pause.png" : "images/play.png");
    });

    $('#rewind').on("click", function() {
        app.resetTrack();
    });
    app.run();
});
