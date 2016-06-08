/**
 * Created by atg on 27/04/2016.
 */

// Audio object for playing music snippets

function AudioAttribute() {
    //Web audio
    var webkitAudio = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new webkitAudio();
    this.startTime = 30;
    this.timeMargin = 2;
    this.playing = false;
    this.playingTime = 0;
    this.playbackTime = 0;
    this.duration = undefined;
}

AudioAttribute.prototype = {
    getAudioData: function(trackID, callback, error) {
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
            encodedSignature = oauthSignature.generate(httpMethod, url+trackID, parameters, consumerSecret, tokenSecret),
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

        var previewURL = url + trackID + country + key + oauthNonce + sigMethod + oauthTimestamp + oauthVersion + oauthSig;
        //DEBUG
        //console.log("URL = ", previewURL);

        xhr.open("GET", previewURL, true);
        xhr.responseType = 'arraybuffer';
        xhr.onreadystatechange = function() {
            if(xhr.readyState === 4) {
                if(xhr.status === 200) {
                    console.log("Downloaded preview");
                    _this.audioContext.decodeAudioData(xhr.response, function(buffer) {
                        _this.audioBuffer = buffer;
                        _this.source = _this.audioContext.createBufferSource();
                        _this.source.buffer = _this.audioBuffer;
                        _this.source.connect(_this.audioContext.destination);
                        _this.duration = _this.source.buffer.duration;
                        if(callback) callback();
                    });
                } else {
                    if(error) error();
                }
            }
        };

        xhr.send();
    },
    
    getStartTime: function() {
        return this.startTime;
    },
    
    getTimeMargin: function() {
        return this.timeMargin;
    },
    
    getDuration: function() {
        return this.duration;
    },

    setPlaying: function(playing) {
        this.playing = playing;
    },

    togglePlaying: function() {
        this.playing = !this.playing;
    },
    
    resetPlaybackTime: function() {
        this.playbackStartTime = Date.now();
        this.source.start(0, this.playbackTime);
    },

    updatePlaybackTime: function() {
        this.playbackTime += ((Date.now() - this.playbackStartTime)/1000);
        this.source.stop(0);
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.connect(this.audioContext.destination);
    },

    isPlaying: function() {
        return this.playing;
    },

    updatePlayingTime: function(delta) {
        this.playingTime += delta;
    },

    finished: function() {
        return this.playingTime > this.duration;
    },

    reset: function() {
        if(this.playing) {
            this.source.stop(0);
            this.source = this.audioContext.createBufferSource();
            this.source.buffer = this.audioBuffer;
            this.source.connect(this.audioContext.destination);
        }
        this.playing = false;
        this.playbackTime = 0;
        this.playingTime = 0;
    }
};

