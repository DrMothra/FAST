/**
 * Created by DrTone on 17/02/2015.
 */
//Loads and parses json files from local storage

var dataLoader = function () {
    THREE.Loader.call( this, false );

    this.withCredentials = false;
};

dataLoader.prototype = Object.create(THREE.Loader.prototype);

dataLoader.prototype.load = function(url, callback) {
    this.onLoadStart();
    this.loadAjaxJSON(this, url, callback);
};

dataLoader.prototype.loadAjaxJSON = function(context, url, callback) {
    var xhr = new XMLHttpRequest();

    var callbackProgress = null;

    var length = 0;

    xhr.onreadystatechange = function () {

        if ( xhr.readyState === xhr.DONE ) {

            if ( xhr.status === 200 || xhr.status === 0 ) {

                if ( xhr.responseText ) {

                    var json = JSON.parse( xhr.responseText );

                    callback( json );

                } else {

                    console.error( 'DataLoader: "' + url + '" seems to be unreachable or the file is empty.' );

                }

                // in context of more complex asset initialization
                // do not block on single failed file
                // maybe should go even one more level up

                context.onLoadComplete();

            } else {

                console.error( 'DataLoader: Couldn\'t load "' + url + '" (' + xhr.status + ')' );

            }

        } else if ( xhr.readyState === xhr.LOADING ) {

            if ( callbackProgress ) {

                if ( length === 0 ) {

                    length = xhr.getResponseHeader( 'Content-Length' );

                }

                callbackProgress( { total: length, loaded: xhr.responseText.length } );

            }

        } else if ( xhr.readyState === xhr.HEADERS_RECEIVED ) {

            if ( callbackProgress !== undefined ) {

                length = xhr.getResponseHeader( 'Content-Length' );

            }

        }

    };

    xhr.open( 'GET', url, true );
    xhr.withCredentials = this.withCredentials;
    xhr.send( null );
};
