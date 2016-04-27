/**
 * Created by atg on 27/04/2016.
 */
// Data object for rendering musical data

function RenderAttribute() {
    this.data = undefined;
    this.scale = new THREE.Vector3();
    this.opacity = 1;
    this.startTime = 30;
    this.dimensions = [true, true, true, true, true, true, true, true, true, true, true, true, true];
    this.colour = 0xff0000;
    this.yOffset = 0;
    this.startSegment = undefined;
    this.markers = [];
    this.playHead = undefined;
    this.timeMargin = 2;
}

RenderAttribute.prototype = {
    setData: function(data) {
        this.data = data;
    },
    
    setScale: function(x, y, z) {
        this.scale.x = x;
        this.scale.y = y;
        this.scale.z = z;
    },
    
    setPlayhead: function(playhead) {
        this.playHead = playhead;
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

    getTrackID: function() {
        return this.trackID;
    }
};




