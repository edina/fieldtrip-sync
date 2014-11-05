/*
Copyright (c) 2014, EDINA.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software must
   display the following acknowledgement: This product includes software
   developed by the EDINA.
4. Neither the name of the EDINA nor the names of its contributors may be used to
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
    var createRemoteRecord = function(id, userId, record, callback) {
        var cloudProviderUrl = pcapi.getCloudProviderUrl();

        // clone the record for preprocessing it before upload it
        // note that original record is used for uploading the assets because
        // contains the fullPath to them
        var processedRecord = jQuery.extend(true, {}, record);

        if( typeof(processedRecord.geometry) === 'object' &&
            processedRecord.geometry.coordinates !== undefined){
            // convert remote record coords to WGS84
            var coords = map.pointToExternal(processedRecord.geometry.coordinates);
            processedRecord.geometry.coordinates = [coords.lon, coords.lat];

            // convert asset URLs to simple filename
            $.each(processedRecord.properties.fields, function(i, field){
                if(field.val && records.isAsset(field)){
                    field.val = field.val.substr(field.val.lastIndexOf('/') + 1);
                }
            });

            var assetCount = 0;
            var finished = function(success, msg){
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
                            pcapi.exportRecord(record.name, function(result){
                                console.log(result);
                            });
                        }
                    }

                    setTimeout(function(){
                        callback(success);
                    }, delay);
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
                        if(records.isAsset(field, type)){
                            ++assetCount;
                            var options = new FileUploadOptions();

                            if(type === 'audio'){
                                options.mimeType = "audio/3gpp";
                            }
                            else if(type === 'track'){
                                options.mimeType = "text/xml";
                            }

                            var fileName = field.val.substr(field.val.lastIndexOf('/') + 1);
                            var assetUrl = pcapi.buildUserUrl(userId, "records", record.name) + '/' + fileName;
                            options.fileName = fileName;

                            setTimeout(function(){
                                var ft = new FileTransfer();
                                ft.upload(
                                    field.val,
                                    encodeURI(assetUrl),
                                    function(result){
                                        utils.printObj(result);
                                        var success;
                                        try{
                                            var res = JSON.parse(result.response);
                                            if(res.error === 0){
                                                success = true;
                                            }else{
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
                                                      assetUrl + ", error = " + error.code);
                                        finished(false);
                                    },
                                    options
                                );
                            }, 1000);
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
        $.each(annotations, function(id, annotation){
            if(!annotation.isSynced){
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

                $('#' + id + ' .ui-block-a').removeClass(
                    'saved-records-list-synced-false');
                $('#' + id + ' .ui-block-a').addClass(
                    'saved-records-list-syncing');

                ++uploadCount;
                createRemoteRecord(id, userId, annotation.record, function(success){
                    --uploadCount;
                    $('#' + id + ' .ui-block-a').removeClass(
                        'saved-records-list-syncing');
                    if(success){
                        $('#' + id + ' .ui-block-a').addClass(
                            'saved-records-list-synced-true');

                        annotation.isSynced = true;
                        records.saveAnnotation(id, annotation);
                    }
                    else{
                        $('#' + id + ' .ui-block-a').addClass(
                            'saved-records-list-synced-false');
                    }

                    if(uploadCount === 0){
                        complete();
                    }
                });
            }
        });

        if(uploadCount === 0){
            complete();
            utils.inform('Nothing to upload');
        }
    };

    return {
        uploadRecords: uploadRecords
    };

});
