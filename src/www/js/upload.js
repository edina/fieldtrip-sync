/*
Copyright (c) 2015, EDINA
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.
* Redistributions in binary form must reproduce the above copyright notice, this
  list of conditions and the following disclaimer in the documentation and/or
  other materials provided with the distribution.
* Neither the name of EDINA nor the names of its contributors may be used to
  endorse or promote products derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY EDINA ''AS IS'' AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL EDINA BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
*/

"use strict";

/* global FileUploadOptions */

/**
 * Module deals with uploading records to Personal Cloud.
 */
define(['records', 'map', 'utils', './pcapi'],
       function(records, map, utils, pcapi){// jshint ignore:line

    /**
     * Create remote record.
     * @param record Record object to create remotely.
     * @param callback
     */
    var createRemoteRecord = function(id, userId, record, callback) { //jshint ignore:line
        var cloudProviderUrl = pcapi.getCloudProviderUrl();

        // clone the record for preprocessing it before upload it
        // note that original record is used for uploading the assets because
        // contains the fullPath to them
        var processedRecord = jQuery.extend(true, {}, record);

        var getAssetFileName = function(path){
            var name = path.substr(path.lastIndexOf('/') + 1);
            if(name.indexOf('?')){
                // make sure any arguments on the file name are removed
                // note: cordova (3.6.3) on android now copies files
                // from the gallery to the app cache adding a parameter,
                // presumably for uniqueness
                name = name.split('?')[0];
            }

            return name;
        };

        /**
         * get rid of full path from files inside the record.json
         * @param {String/Object} the element tha contains the images' paths
         * @returns {String/Object} of the filenames
         */
        var processAssetField = function(assetFieldValue){
            var res;
            if(typeof(assetFieldValue) === "string"){
                res = getAssetFileName(assetFieldValue);
            }
            else if(typeof(assetFieldValue) === "object"){
                var newImages = [];
                for(var j=0; j<assetFieldValue.length;j++){
                    newImages.push(getAssetFileName(assetFieldValue[j]));
                }
                res = newImages;
            }
            return res;
        };

        if( typeof(processedRecord.geometry) === 'object' &&
            processedRecord.geometry.coordinates !== undefined){
            // convert remote record coords to WGS84
            processedRecord = map.toExternalGeojson(processedRecord);

            // convert asset URLs to simple filename
            $.each(processedRecord.properties.fields, function(i, field){
                if(field.val && records.isAsset(field)){
                    field.val = processAssetField(field.val);
                }
            });

            var assetCount = 0;

            /*
             * @param success boolean
             * @param msg the message to show to the user
             * @param error object with the detailed type of error that'll be
             *        passed to the callback
             */
            var finished = function(success, msg, error){
                // default values
                msg = msg || 'An error has occurred syncing';

                --assetCount;
                if(assetCount < 1){
                    var delay = 0;
                    if(!success){
                        delay = 3000;
                        utils.inform(msg);
                    }else{
                        if(utils.getConfig().ogcsync){
                            pcapi.exportRecord(userId, record.name, function(result){
                                console.log(result);
                            });
                        }
                    }

                    setTimeout(function(){
                        callback(success, error);
                    }, delay);
                }
            };

            /**
             * upload assets
             * @param {String} file full path of asset
             * @param {String} fileName filename of asset
             * @param {Object} options upload options
             */
            var uploadAsset = function(file, fileName, options){
                var assetUrl = pcapi.buildUserUrl(userId, "records", record.name) + '/' + fileName;
                console.debug("Asset url is "+assetUrl);

                options.fileName = fileName;
                options.chunkedMode = false;

                setTimeout(function(){
                    var ft = new FileTransfer();
                    ft.upload(
                        file,
                        encodeURI(assetUrl),
                        function(result){
                            //utils.printObj(result);
                            var success;
                            try{
                                var res = JSON.parse(result.response);
                                if(res.error === 0){
                                    success = true;
                                }
                                else{
                                    success = false;
                                    console.error(res.msg);
                                }
                            }catch(e){
                                console.debug('Non json response');
                                console.debug(result);
                                success = false;
                            }finally{
                                finished(success);
                            }
                        },
                        function(error){
                            utils.printObj(error);
                            console.error("Problem uploading asset: " +
                                            assetUrl + ", error = " + error.exception);
                            // No user message but pass the FileTransferError
                            finished(false, null, error);
                        },
                        options
                    );
                }, 1000);

                // if configured, create thumbnail of image
                if(utils.str2bool(utils.getConfig().clientthumbgen)){
                    // append canvas to page
                    var canvasId = "canvas-" + fileName;
                    $('#saved-records-page').append('<canvas id="' + canvasId + '" style="display: none;"></canvas>');

                    var thumbSize = 100;
                    var canvas = document.getElementById(canvasId);
                    canvas.width = thumbSize;
                    canvas.height = thumbSize;
                    var c = canvas.getContext("2d");
                    var img = new Image();
                    img.onload = function(e) {
                        c.drawImage(this, 0, 0, thumbSize, thumbSize);
                        var b64 = canvas.toDataURL("image/jpeg").split(',')[1];
                        var tUrl = assetUrl.substring(0, assetUrl.lastIndexOf(".")) + "_thumb.jpg";
                        $.ajax({
                            type: "POST",
                            url: tUrl + "?base64=true",
                            data: b64,
                            success: function(){
                                //
                            },
                            error: function(jqXHR, status, error){
                                console.error("Problem posting " + tUrl + ": " + error);
                            },
                        });
                    };
                    img.src = file;
                }
            };

            //console.debug("Post: " + recordDir);
            pcapi.saveItem(userId, "records", processedRecord, function(status, data){
                if(status){
                    // check if new record name
                    var s = data.path.indexOf('/', 1) + 1;
                    var name = data.path.substr(s, data.path.lastIndexOf('/') - s);

                    if(record.name !== name){
                        // name has been changed by api
                        console.debug(record.name + " renamed to " + name);
                        utils.inform(record.name + " renamed to " + name);
                        record.name = name;
                        $('#' + id + ' .saved-records-view > a').text(name);

                    }

                    // create any assets associated with record
                    $.each(record.properties.fields, function(i, field){
                        var type = records.typeFromId(field.id);
                        if(records.isAsset(field, type) && field.val !== null){
                            var options = new FileUploadOptions();

                            if(type === 'audio'){
                                options.mimeType = "audio/3gpp";
                            }
                            else if(type === 'track'){
                                // TODO track is a plugin,
                                // sync shouldn't know anything about another plugin
                                options.mimeType = "text/xml";
                            }

                            var fileName = processAssetField(field.val);
                            if(typeof(fileName) === "string"){
                                ++assetCount;
                                uploadAsset(field.val, fileName, options);
                            }
                            else if(typeof(fileName) === "object"){
                                assetCount = assetCount+fileName.length;
                                for(var j=0; j<fileName.length;j++){
                                    uploadAsset(field.val[j], fileName[j], options);
                                }
                            }
                        }
                    });

                    if(assetCount === 0){
                        finished(true);
                    }
                }
                else{
                    finished(false);
                }
            });

        }
        else{
            console.error("record has no location delete it: " + record.name);

            // executing callback synchronously causes problems for the calling function
            setTimeout(function(){
                callback(false);
            }, 500);
        }
    };

    /**
     * Upload unsynced records.
     * @param complete Function executed when upload is complete.
     */
    var uploadRecords = function(complete) {
        // do upload sync
        var annotations = records.getSavedRecords();
        var uploadCount = 0;
        var uploadQueue = [];

        var uploadNextRecord = function(){
            var id = uploadQueue.pop();
            if(id){
                var annotation = annotations[id];
                var userId;

                switch(annotation.editorGroup){
                case 'public':
                    userId = pcapi.getAnonymousUserId();
                    break;
                default:
                    userId = pcapi.getUserId();
                }

                if(!userId){
                    console.debug('No user authenticated for this group: ' + annotation.editorGroup);
                    return;
                }

                // ++uploadCount;
                createRemoteRecord(
                    id,
                    userId,
                    annotation.record,
                    function(success, error){
                        --uploadCount;
                        var statusIcon = '#' + id + ' .ui-block-a';

                        $(statusIcon).removeClass(
                            'saved-records-list-syncing');
                        if(success){
                            $(statusIcon).addClass(
                                'saved-records-list-synced-true');

                            annotation.isSynced = true;
                            records.saveAnnotation(id, annotation);
                        }
                        else{
                            if(error instanceof FileTransferError &&
                               error.code === FileTransferError.FILE_NOT_FOUND_ERR){
                                $(statusIcon).addClass(
                                    'saved-records-list-synced-incomplete');
                                annotation.isIncomplete = true;
                                records.saveAnnotation(id, annotation);

                            }
                            else{
                                $(statusIcon).addClass(
                                    'saved-records-list-synced-false');
                            }
                        }

                        // get next in queue
                        uploadNextRecord();
                    }
                );
            }

            if(uploadCount === 0){
                complete();
            }
        };

        $.each(annotations, function(id, annotation){
            if(!annotation.isSynced && !annotation.isIncomplete){
                $('#' + id + ' .ui-block-a').removeClass(
                    'saved-records-list-synced-false');
                $('#' + id + ' .ui-block-a').addClass(
                    'saved-records-list-syncing');

                uploadQueue.push(id);
            }
        });

        if(uploadQueue.length === 0){
            complete();
            utils.inform('Nothing to upload');
        }
        else{
            uploadCount = uploadQueue.length;
            console.debug(uploadCount + " to upload");

            // create thread threads for downloading
            var uploadThreads = 3;
            for(var i = 0; i < uploadThreads; i++){
                uploadNextRecord();
            }
        }
    };

    return {
        uploadRecords: uploadRecords
    };

});
