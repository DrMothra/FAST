/**
 * Created by atg on 27/04/2016.
 */
// Data object for rendering musical data

var MARKER_INC = 5;

function RenderAttribute() {
    this.data = undefined;
    this.scale = new THREE.Vector3(1, 1, 1);
    this.timelineDimensions = new THREE.Vector3(0.5, 15, 37.5);
    this.timelineIndicator = undefined;
    this.timelineZPos = 17.5;
    this.opacity = 1;
    this.startTime = 30;
    this.startPlayhead = 0;
    this.timeMargin = 2;
    this.dimensions = [true, true, true, true, true, true, true, true, true, true, true, true, true];
    this.colour = 0xff0000;
    this.startSegment = undefined;
    this.markers = [];
    this.playHead = undefined;
    this.segmentWidth = 2;
    this.markers = [];
    this.numCoefficients = 12;
    this.normalise = false;
    this.root = undefined;
    this.dataGroup = undefined;
    //Heatmap materials
    this.showHeatmap = false;
    this.colourSteps = 7;
    this.heatMap = [];
    this.createHeatmap();
}

RenderAttribute.prototype = {
    setData: function(data) {
        this.data = data;
    },
    
    setScale: function(x, y, z) {
        this.dataGroup.x = x;
        this.dataGroup.y = y;
        this.dataGroup.z = z;
    },

    setXScale: function(scale) {
        this.dataGroup.scale.x = scale;
    },

    setYScale: function(scale) {
        this.dataGroup.scale.y = scale;
    },

    setZScale: function(scale) {
        this.dataGroup.scale.z = scale;
    },

    setOpacity: function(opacity) {
        for(var child=0; child<this.dataGroup.children.length; ++child) {
            this.dataGroup.children[child].material.opacity = opacity;
        }
    },

    setPlayhead: function(playhead) {
        this.playHead = playhead;
        this.playHead.scale.set(0.05, 0.05, 0.05);
        this.playHead.position.set(this.startPlayhead, 0, 35);
    },

    setPlayheadPos: function(xPos) {
        this.playHead.position.x = xPos;
    },

    setTimelinePos: function(xPos) {
        this.timelineIndicator.position.x = xPos;
    },

    createHeatmap: function() {
        //Need material for each colour
        var colours = [
            { name: "black",
                value: 0x000000 },
            { name: "blue",
                value: 0x0000ff },
            { name: "cyan",
                value: 0x00ffff },
            { name: "green",
                value: 0x00ff00 },
            { name: "yellow",
                value: 0xffff00 },
            { name: "red",
                value: 0xff0000 },
            { name: "white",
                value: 0xffffff }
        ];
        for(var i=0; i<this.colourSteps; ++i) {
            this.heatMap.push(new THREE.MeshLambertMaterial( { color: colours[i].value,
                opacity: 1.0,
                transparent: true}));
        }
    },

    parseData: function() {
        //Get artist name, track name and music data
        if(!this.data) {
            console.log("No data defined!");
            return;
        }
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

        //Get mp3 and start time
        this.startTime = this.data["start_time"];
        if(!this.startTime) {
            alert("This track not synced yet!!");
        }
        this.startPlayhead = this.timeMargin;
    },

    normaliseData: function(data) {
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
    },
    
    normaliseRequired: function(normalise) {
        this.normalise = normalise;
    },
    
    getTrackID: function() {
        return this.trackID;
    },

    getSegmentWidth: function() {
        return this.segmentWidth;
    },

    getSegmentData: function() {
        return this.segments;
    },

    getDataLength: function() {
        return this.segments.length;
    },

    getStartTime: function() {
        return this.startTime;
    },
    
    getTotalTime: function() {
        return this.segments[this.segments.length-1];
    },

    generateMarkers: function(start, end) {
        //Calculate playback speed
        this.startSegment = start;
        this.endSegment = end;
        var time = this.segments[end+1] - this.segments[start];
        var distance = end - start + 1;
        distance = distance * this.segmentWidth;
        this.unitsPerSecond = distance/time;
        var markerObj, totalTime;
        var currentSecond = Math.round(this.segments[start]);
        for(var i=start; i<end; ++i) {
            totalTime = this.segments[i];
            if(totalTime >= currentSecond) {
                distance = (currentSecond * this.unitsPerSecond);
                markerObj = {};
                markerObj.distance = distance;
                markerObj.time = currentSecond;
                this.markers.push(markerObj);
                currentSecond += MARKER_INC;
            }
        }
    },
    
    renderTimeline: function() {
        //Timeline
        var timelineGroup = new THREE.Object3D();
        timelineGroup.name = 'TimelineGroup';
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
        
        return timelineGroup;
    },
    
    renderData: function(heatmap) {
        //Render data attribute
        this.showHeatmap = heatmap;
        if(!this.root) {
            this.root = new THREE.Object3D();
            this.root.name = 'Timbre';
        }

        if(!this.dataGroup) {
            this.dataGroup = new THREE.Object3D();
            this.dataGroup.name = 'TimbreSegments';
            this.root.add(this.dataGroup);
        }

        //Timeline indicator
        if(!this.timelineIndicator) {
            var timelineMat = new THREE.MeshBasicMaterial( { color: 0xffffff,
                opacity: 0.25,
                transparent: true } );
            var timelineGeom = new THREE.BoxGeometry(this.timelineDimensions.x,
                this.timelineDimensions.y, this.timelineDimensions.z);
            this.timelineIndicator = new THREE.Mesh(timelineGeom, timelineMat);
            this.timelineIndicator.name = "timeline" + this.dataGroup.name;
            this.root.add(this.timelineIndicator);
            this.root.add(this.playHead);
            this.startPlayhead = this.timeMargin * this.unitsPerSecond;
            this.playHead.position.x = this.startPlayhead;
            this.timelineIndicator.position.set(this.startPlayhead-0.25, this.timelineDimensions.y/2, this.timelineZPos);
        }

        var numCoefficients = 12, numSegments = this.endSegment - this.startSegment + 1;
        var startX = 0, startY = 0, startZ = 0;
        var segmentGap = 0;
        var interZgap = 1;
        var timeSlice, nextTimeSlice;
        var width = 2, depth = 2;
        var xScale, xOffset;

        var boxMat = new THREE.MeshLambertMaterial( {color: this.colour,
            opacity: this.opacity,
            transparent: true
        } );
        var geom = new THREE.BoxGeometry(this.segmentWidth, 1, depth, 1, 1, 1);
        var defaultTimeSlice = (this.segments[this.endSegment + 1] - this.segments[this.startSegment]) / numSegments;
        var mesh;

        //Get relevant data
        var segmentData = this.timbreSegments;

        if(this.normalise) {
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
            this.dataGroup.add(mesh);
        }
        startX = startX + xOffset + segmentGap;

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
                this.dataGroup.add(mesh);
            }
            startX = startX + (xOffset*2) + segmentGap;
        }

        return this.root;
    },

    clearScene: function() {
        this.root.remove(this.dataGroup);
        this.dataGroup = undefined;
    },

    update: function(delta) {
        this.playHead.position.x += (this.unitsPerSecond * delta);
        this.timelineIndicator.position.x = this.playHead.position.x-0.25;
    },

    setPlayheadStartPos: function(xPos) {
        this.startPlayhead = xPos * this.unitsPerSecond;
    },

    getPlayheadStartPos: function() {
        return this.startPlayhead;
    },

    getPlaybackSpeed: function() {
        return this.unitsPerSecond;
    },

    showDimension: function(visible, row) {
        var rowName = row-1;
        this.dataGroup.traverse(function(obj) {
            if(obj instanceof THREE.Mesh) {
                if(obj.name.indexOf("row"+rowName+"col") !== -1) {
                    obj.visible = visible;
                }
            }
        })
    },

    showAllDimensions: function(visible) {
        this.dataGroup.traverse(function(obj) {
            if (obj instanceof THREE.Mesh) {
                obj.visible = visible;
            }
        });
    },

    reset: function() {
        this.playHead.position.set(this.startPlayhead, 0, 35);
        this.timelineIndicator.position.set(this.startPlayhead-0.25, (this.timelineDimensions.y/2) * this.timelineIndicator.scale.y,
            this.timelineZPos);
    }
};




