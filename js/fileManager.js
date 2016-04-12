/**
 * Created by DrTone on 16/02/2016.
 */

//Manages file selection and parsing

var fileManager = (function() {

    var files = [];
    var dataFile, fileName;

    return {
        init: function() {
            return (window.File && window.FileReader && window.FileList && window.Blob);
        },

        onSelectFile: function(event) {
            files = event.target.files;
            if(files.length === 0) {
                alert("No file specified!");
                return;
            }
            dataFile = files[0];
            return dataFile;
        }
    }
})();

