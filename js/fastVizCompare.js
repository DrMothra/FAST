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
    //this.renderer.setScissorTest(false);
    //this.renderer.clear();

    this.renderer.setScissorTest(true);
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
    var startTracks = ['data/CarrollThompsonChange.json',
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
    this.startTime = this.data["start_time"];
    if(!this.startTime) {
        alert("This track not synced yet!!");
        this.startTime = 30;
    }
    
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

        var totalTime = 0, startTime = _this.startTime - _this.timeMargin, endTime = _this.startTime + _this.source.buffer.duration + _this.timeMargin;
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
        //_this.renderHeatmap(_this.showHeatmap);
    });
};

FastApp.prototype.getAudioData = function(fileURL, callback) {
    //Get audio preview
    $('#waiting').show();
    $('#downloadError').hide();
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
                $('#waiting').hide();
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
                                                     transparent: true } );
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
    var coefficients, height, index;
    coefficients = segmentData[this.startSegment];
    timeSlice = this.segments[this.startSegment+1] - this.segments[this.startSegment];
    xScale = timeSlice/defaultTimeSlice;
    xOffset = (xScale * this.segmentWidth)/2;
    for(var j=0; j<numCoefficients; ++j) {
        height = coefficients[j] < 0 ? coefficients[j] * -1 : coefficients[j];
        startY = coefficients[j] < 0 ? -height/2 : height/2;
        if(this.showHeatmap) {
            index = Math.floor(height * this.colourSteps);
            if(index === 7) index = 6;
            mesh = new THREE.Mesh(geom, this.heatMap[index]);
        } else {
            mesh = new THREE.Mesh(geom, boxMat);
        }
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
            if(this.showHeatmap) {
                index = Math.floor(height * this.colourSteps);
                if(index === 7) index = 6;
                mesh = new THREE.Mesh(geom, this.heatMap[index]);
            } else {
                mesh = new THREE.Mesh(geom, boxMat);
            }
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
    timelineGroup.name = 'TimelineGroup';
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

FastApp.prototype.onShowDimension = function(value, dim) {
    //Get group and traverse meshes
    var attribute = this.renderAttributes[this.activeSlot];

    attribute.showDimension(value, dim);
};

FastApp.prototype.onShowAllDimensions = function(status) {
    var attribute = this.renderAttributes[this.activeSlot];

    attribute.showAllDimensions(status);
};

FastApp.prototype.onStartChanged = function(value) {
    //Adjust playhead
    var attribute = this.renderAttributes[this.activeSlot];

    var newPos = value * attribute.getPlaybackSpeed();
    attribute.setPlayheadStartPos(newPos);
    attribute.setPlayheadPos(newPos);
    attribute.setTimelinePos(newPos-0.25);
};

FastApp.prototype.createGUI = function() {
    var _this = this;
    this.guiControls = new function() {
        this.Start = 0.001;
        this.ScaleX = 1.0;
        this.ScaleY = 1.0;
        this.ScaleZ = 1.0;
        this.Opacity = 1;
        this.LightX = 0.0;
        this.LightY = 200;
        this.LightZ = 0;
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
    this.guiAppear.add(this.guiControls, 'Heatmap').onChange(function(value) {
        _this.renderHeatmap(value);
    });

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

FastApp.prototype.onOpacityChanged = function(value) {
    var attribute = this.renderAttributes[0];

    attribute.setOpacity(value);
};

FastApp.prototype.renderHeatmap = function(render) {
    var attribute = this.renderAttributes[this.activeSlot];
    attribute.clearScene();
    attribute.renderData(render);
};

FastApp.prototype.clearScene = function(groups) {
    if(groups === undefined) {
        console.log("Nothing to clear");
        return;
    }
    var removeGroup;
    for(var i=0; i<groups.length; ++i) {
        removeGroup = this.scene.getObjectByName(groups[i]);
        if(!removeGroup) {
            console.log("No group ", groups[i]);
            continue;
        }
        this.root.remove(removeGroup);
    }
};

FastApp.prototype.onScaleChanged = function(axis, value) {
    //Scale along relevant axis
    var attribute = this.renderAttributes[0];

    switch(axis) {
        case X_AXIS:
            attribute.setXScale(value);
            break;

        case Y_AXIS:
            attribute.setYScale(value);
            break;

        case Z_AXIS:
            attribute.setZScale(value);
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
    //this.setCamera(cameraViews[this.cameraView]);
};

FastApp.prototype.isPlaying = function() {
    return this.audioAttributes[0].isPlaying();
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
    //app.createGUI();
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
