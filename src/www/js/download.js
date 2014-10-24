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

/**
 * Module deals with download records/forms from the Personal Cloud.
 */
define(['records', 'map', 'file', 'utils', './pcapi'], function(// jshint ignore:line
    records, map, file, utils, pcapi){

    /**
     * set class name for editors on localstorage
     * @param FileEntry entry
     * @param group that holds all the editors class names
     */
    var setClassNames = function(entry, group){
        //read the class for the editor button and store it to session storage
        //read the file and check for class for the button as hidden value
        if(entry.name.indexOf(".edtr") > -1){
            entry.file(function(file) {
                var reader = new FileReader();

                reader.onloadend = function(e) {
                    records.setEditorClass(entry.name, this.result, group);
                };

                reader.readAsText(file);
            }, function(e){
                console.log(e);
            });
        }
    };

return {

    downloadEditor: function(type, editor){
        var userId;
        var path;

        switch(type){
            case records.EDITOR_GROUP.PUBLIC:
                userId = pcapi.getAnonymousUserId();
                path = records.getEditorsDir(records.EDITOR_GROUP.PUBLIC);
            break;
            default:
                userId = pcapi.getUserId();
                path = records.getEditorsDir();
        }

        var fileName = editor.substring(editor.lastIndexOf('/') + 1, editor.length);
        var options = {"userId": userId, "fileName": editor, "remoteDir": "editors", "localDir": path, "targetName": editor};
        this.downloadItem(options, function(entry){
            setClassNames(entry, type);
        });
    },

    /**
     * Download editors from cloud provider.
     * @param callback Function executed after sync is complete.
     */
    downloadEditors: function(callback) {
        console.log(records.getEditorsDir());
        this.downloadItems(records.getEditorsDir(),'editors', function(success){
            callback(success);
        });
    },

    /**
     * Download items from cloud provider.
     * @param localDir the local directory where things are downloaded
     * @param remoteDir the name of the remote directory
     * @param callback Function executed after sync is complete.
     */
    downloadItems: function(localDir, remoteDir, callback) {
        utils.inform("Sync "+remoteDir+" ...");

        var downloads = [];
        //var userId = pcapi.getUserId();

        var finished = function(success){
            utils.doCallback(callback, success, downloads);
        };

        file.deleteAllFilesFromDir(localDir, remoteDir, $.proxy(function(){

            pcapi.getFSItems(remoteDir, $.proxy(function(status, data){
                if(status === false){
                    // nothing to do
                    utils.inform('No editors to sync');
                    finished(true);
                }
                else{
                    if(data.metadata.length ===0){
                        // nothing to do
                        utils.inform('No editors to sync');
                        finished(true);
                    }
                    else{
                        var count = 0;
                        var noOfItems = data.metadata.length;

                        //utils.printObj(data.metadata);
                        var editorClassObj = {};

                        // do sync
                        $.each(data.metadata, $.proxy(function(i, item){
                            // TODO work would correct filename and path
                            var fileName = item.substring(item.lastIndexOf('/') + 1, item.length);
                            var options = {"fileName": fileName, "remoteDir": remoteDir, "localDir": localDir, "targetName": fileName};
                            this.downloadItem(options, function(entry){

                                setClassNames(entry, records.EDITOR_GROUP.PRIVATE);

                                ++count;
                                downloads.push(fileName);
                                if(count === noOfItems){
                                    finished(true);
                                }
                            });

                            //utils.printObj(data);
                        }, this));
                    }
                }
            }, this));
        }, this));
    },

    /**
     * Download item from cloud provider.
     * @param options:
     *   fileName the name of item
     *   remoteDir the name of the directory on the server
     *   localDir the local directory where the item will be downloaded.
     *   localFileName is the local filename, use it when you want the downloaded
     *     item to have different name from the remote one
     *   targetName the name with which the file will be stored on the phone
     * @param callback Function will be called when editor is successfully downloaded.
     */
    downloadItem: function(options, callback){
        var itemUrl = pcapi.buildFSUrl(options.remoteDir, options.fileName);
        //if there's a userId then change the userID
        if(options.userId){
            itemUrl = pcapi.buildUserUrl(options.userId, options.remoteDir, options.fileName);
        }

        var target = file.getFilePath(options.localDir)+'/'+options.targetName;

        file.fileTransfer(itemUrl, target, function(success, entry){
            if(success){
                callback(entry);
            }
        });
    },

    /**
     * Sync records with cloud provider.
     * @param complete Function executed when sync is complete.
     * @param callback Function executed each time an annotation is added or deleted.
     */
    downloadRecords: function(complete, callback) {
        console.debug("Sync download all records");
        utils.inform("Sync records ...");

        var annotations = records.getSavedRecords();
        var userId = pcapi.getUserId();

        // all locally synced records will first be deleted
        $.each(annotations, function(id, annotation){
            if(annotation.isSynced){
                console.debug("Delete synced record: " + id);
                records.deleteAnnotation(id);

                if(callback){
                    callback(false, id);
                }
            }
        });

        var recordsDir = pcapi.getCloudProviderUrl() +
            '/records/'+pcapi.getProvider()+'/' + userId + "/";
        var downloadQueue = [];
        var count = 0;

        console.debug("Fetch current records: " + recordsDir);

        // function for downloading next record in queue
        var _downloadNextRecord = $.proxy(function(){
            var recordName = downloadQueue.pop();
            if(recordName){
                utils.inform("Download " + recordName);

                this.downloadRecord(
                    recordName,
                    function(success, id, annotation){
                        --count;
                        // add new record
                        if(callback && success){
                            callback(true, id, annotation);
                        }

                        // get next in queue
                        _downloadNextRecord();
                    }
                );
            }

            if(count === 0){
                complete();
            }
        }, this);

        // fetch records
        $.ajax({
            type: "GET",
            dataType: "json",
            url: recordsDir,
            success: function(data){
                if(data.error === 0){
                    $.mobile.loading('show');
                    $.each(data.records, function(i, record){
                        // the first property of each object is the name
                        for(var name in record){
                            downloadQueue.push(name);
                            break;
                        }
                    });

                    if(downloadQueue.length === 0){
                        complete();
                    }
                    else{
                        count = downloadQueue.length;
                        console.debug(downloadQueue.length + " to download");
                        // create thread threads for downloading
                        var downloadThreads = 3;
                        for(var i = 0; i < downloadThreads; i++){
                            _downloadNextRecord();
                        }
                    }
                }
                else{
                    // TODO the user should be informed of a failure
                    // (when https://redmine.edina.ac.uk/issues/5812 is resolved)
                    console.error("Error with fetching records:" + data.msg);
                    $.mobile.loading('hide');
                    utils.inform("Sync Error " + data.msg, 5000);

                    complete();
                }
            },
            error: function(jqXHR, status, error){
                console.error("Problem fetching " + recordsDir + " : " +
                              status + " : " + error);
                complete();
            },
            cache: false
        });
    },

    /**
     * Download remote record from dropbox.
     * @param name Record name/title.
     * @param callback Function will be called when the new record is successfully
     * updated.
     * @param orgRecord Object containing id and original record, if record is to be
     * downloaded.
     */
    downloadRecord: function(name, callback, orgRecord){
        var rootUrl = pcapi.getCloudProviderUrl() + '/records/'+pcapi.getProvider()+'/' +
            pcapi.getUserId() + "/" + name;
        var recordUrl = rootUrl + "/record.json";

        var assetCount = 0;
        var finished = function(record, success){
            --assetCount;

            if(assetCount < 1){
                var id, annotation;
                var delay = 0;

                if(success){
                    if(orgRecord === undefined){
                        // create brand new record
                        annotation = {
                            "record": record,
                            "isSynced": true
                        };
                    }
                    else{
                        // update existing record
                        annotation = orgRecord.annotation;
                        annotation.record = record;
                        id = orgRecord.id;
                    }

                    if(name !== annotation.record.name){
                        // update record name if they don't match, this is for cases
                        // where the record name (directory name) is different from
                        // the name inside the record
                        annotation.record.name = name;
                    }

                    id = records.saveAnnotation(id, annotation);
                }
                else{
                    // allow time to display any error
                    delay = 3000;
                }

                if(callback){
                    setTimeout(function(){
                        callback(success, id, annotation);
                    }, delay);
                }
            }
        };

        console.debug("Fetch " + recordUrl);
        $.ajax({
            type: "GET",
            dataType: "json",
            url: recordUrl,
            cache: false,
            success: $.proxy(function(record){
                //utils.printObj(record);

                // convert coordinates to national grid
                record.geometry.coordinates = map.pointToInternal(record.geometry.coordinates);

                //  fetch assets and convert URLs
                $.each(record.properties.fields, $.proxy(function(i, field){
                    if(records.isAsset(field)){
                        ++assetCount;

                        var source = rootUrl + "/" + field.val;
                        var nameEnc = encodeURI(name);
                        var fieldValEnc = encodeURI(field.val);

                        var target = file.getFilePath(records.getAssetsDir()) + "/" + nameEnc + "/" + fieldValEnc;

                        console.debug("download: " + source + " to " + target);

                        //TO-DO integrate this with the file.fileTransfer function
                        new FileTransfer().download(
                            encodeURI(source),
                            target,
                            function(entry) {
                                console.debug("download complete: " + file.getFilePath(entry));

                                // asset local path becomes new record field val
                                field.val = file.getFilePath(entry);

                                finished(record, true);
                            },
                            function(error) {
                                // if this fails first check whitelist in cordova.xml
                                utils.informError("Problem syncing " + name);
                                console.error("Problem downloading asset: " + error.source +
                                              " to: " + error.target +
                                              " error: " + file.getFileTransferErrorMsg(error) +
                                              "http status: " + error.http_status);// jshint ignore:line
                                finished(record, false);
                            }
                        );
                    }
                }, this));

                if(assetCount === 0){
                    finished(record, true);
                }
            }, this),
            error: function(error){
                var msg = "Failed to fetch record " + name;
                console.error(msg);
                utils.informError(msg);
                finished(undefined, false);
            }
        });
    },

    /**
     * List the editors available for an user
     * @param userId The editor name.
     * @param success function called after success
     * @param error function called in case of an error
     */
    listEditors: function(userId, success, error){
        var url = pcapi.buildUserUrl(userId, 'editors');
        console.debug(url);

        $.get(url)
         .success(function(data){
            utils.doCallback(success, data);
         })
         .fail(function(xhr, msg){
            utils.doCallback(error, msg);
         });
    },

    /**
     * Wraps the listEditor function as a promise
     *
     * @param userId
     * @return a promise that resolves in a list of available editors for given userId
     */
    listEditorsPromise: function(userId){
        var deferred = new $.Deferred();
        this.listEditors(
            userId,
            function(data){
                if(typeof(data) !== 'object'){
                    deferred.reject({msg: 'Non json response'});
                    return;
                }

                switch(data.error){
                    case 0:
                        deferred.resolve(data);
                        break;
                    default: // Any errors
                        deferred.reject(data.msg);
                        console.error(data.msg);
                }
            },
            function(err){
                 deferred.reject(err);
            });

        return deferred.promise();
    }
};

});
