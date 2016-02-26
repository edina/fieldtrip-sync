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

/**
 * Module deals with download records/forms from the Personal Cloud.
 */
/* global zip */
define(['records', 'map', 'file', 'utils', './pcapi'], function(// jshint ignore:line
    records, map, file, utils, pcapi){

    var EDITOR_ASSETS = {
        dtree: {
            remoteDir: 'editors'
        },
        layers: {
            remoteDir: 'layers'
        }
    };

    var PRIVATE_USER_FORM_PATH = 'editors';

    /**
     * Download the editors or surveys if the formspath variable is present
     * @returns a {Promise} that is resolved when the process is finished
     *     or is rejected with an error message
     */
    var downloadEditorsOrSurveys = function() {
        var deferred = $.Deferred();
        var _this = this;
        var config = utils.getConfig();
        var fetchedItems;

        if ('formspath' in config) {
            fetchedItems =
                records.deleteAllEditors()
                    .then(downloadSurveys)
                    .then(function(entries) {
                        return records.addEditors(entries, records.EDITOR_GROUP.PRIVATE);
                    });
        }
        else {
            fetchedItems =
                records.deleteAllEditors()
                    .then(function() {
                        var localDir = records.getEditorsDir();
                        var remoteDir = PRIVATE_USER_FORM_PATH;

                        return _this.downloadEditors(localDir, remoteDir);
                    });
        }

        return fetchedItems;
    };

    /**
     * Download item from cloud provider.
     * @param options:
     *   userId - User id (optional)
     *   fileName - the name of item
     *   remoteDir - the name of the directory on the server
     *   localDir - cordova fileEntry pointing to the local directory where the item will be downloaded.
     *   targetName - the name with which the file will be stored on the phone
     * @param success Function will be called when item is successfully downloaded.
     * @param error Function will be called when an error has occurred.
     */
    var downloadItem = function(options, success, error) {
        var itemUrl = pcapi.buildUrl(options.remoteDir, options.fileName);
        //if there's a userId then change the userID
        if(options.userId){
            itemUrl = pcapi.buildUserUrl(options.userId, options.remoteDir, options.fileName);
        }

        var target = file.getFilePath(options.localDir)+'/'+options.targetName;

        file.ftDownload(itemUrl, target, success, error);
    };

    /**
     * Download a list of items
     * @param items {Array} an array of items to download, each item is
     *   described by an options {Object} as expected for the downloadItem
     *   function:
     *     - fileName {String} the remote filename
     *     - remoteDir {String} the remote path
     *     - localDir {FileEntry} where the file will be stored
     *     - targetName {String} the local name for the file
     * @returns {Promise} a promise that resolved in an Array of entries {FileEntry}
     */
    var downloadItems = function(items) {
        var fetchedFileEntries;
        var downloadedItems;

        downloadedItems = items.map(function(item) {
            var deferred = $.Deferred();
            downloadItem(item, deferred.resolve, deferred.reject);
            return deferred.promise();
        });

        fetchedFileEntries =
            $.when.apply(null, downloadedItems)
                // pack the resolved values in an Array
                .then(function() {
                    return Array.prototype.slice.call(arguments);
                });

        return fetchedFileEntries;
    };

    /**
     * Download surveys
     * @returns a promise that resolves in an {Array} of {FileEntry}
     */
    var downloadSurveys = function() {
        var formspath = utils.getConfig().formspath;

        return fetchItems(formspath)
                .then(normalizeSurveys)
                .then(downloadItems);
    };

    /**
     * Download the assets associated to the editor
     * @implements records.processEditor
     * @param editorName name of the editor
     * @param html html content of the editor
     * @param group the records.EDITOR_GROUP
     * @param online boolean value if the processing is held online
     */
    var downloadAssets = function(editorName, text, group, online) {
        var form = JSON.parse(text);
        var assetType;
        var assetOptions;
        //the folder name of that derives from the editorName without the extension
        var editorFolder = editorName.substr(0, editorName.lastIndexOf('.'));

        $.each(EDITOR_ASSETS, function(assetType, assetOptions) {
            form.fields.forEach(function(element, index){
                if(element.type === assetType){
                    var assetName =element.properties.filename;
                    if (assetName !== undefined) {
                        console.debug(assetName);

                        if (online) {
                            var options = {};

                            options.remoteDir = assetOptions.remoteDir;
                            options.fileName = editorFolder + "/" +assetName;
                            options.targetName = editorFolder + "/" + assetName;

                            switch (assetType) {
                                case 'dtree':
                                    if (group === records.EDITOR_GROUP.PUBLIC) {
                                        options.userId = pcapi.getAnonymousUserId();
                                        options.localDir = records.getEditorsDir(records.EDITOR_GROUP.PUBLIC);
                                    }
                                    else {
                                        options.userId = pcapi.getUserId();
                                        options.localDir = records.getEditorsDir();
                                    }
                                break;
                                default: // Other assets get the path from the core
                                    if (group === records.EDITOR_GROUP.PUBLIC) {
                                        options.userId = pcapi.getAnonymousUserId();
                                    }
                                    else
                                    {
                                        options.userId = pcapi.getUserId();
                                    }
                                    options.localDir = records.getAssetsDir(assetType);

                                    if (!options.localDir) {
                                        console.warn('Not directory defined for asset type: ' + assetType);
                                        console.warn('Skipping: ' + assetName);
                                        return;
                                    }
                            }

                            downloadItem(
                                options,
                                function(entry) {
                                    console.debug('Asset ' + assetName + ' downloaded');
                                    //for zip files unzip them and delete the zip file
                                    if(utils.endsWith(assetName, ".zip")) {
                                        var fileUrl = entry.toURL();
                                        var fileUrlNoExtension = fileUrl.substr(0, fileUrl.lastIndexOf("."));
                                        var subfolderName = assetName.substr(0, assetName.lastIndexOf("."));
                                        var targetUrl = fileUrlNoExtension;
                                        zip.unzip(fileUrl, targetUrl, function(result){
                                            if(result === 0) {
                                                file.deleteFile(assetName, options.localDir);
                                                //rename json file
                                                file.findFile(".json", targetUrl).done(function(dirEntry, fileEntry){
                                                    file.moveTo({
                                                        "path": fileEntry,
                                                        "to": dirEntry,
                                                        "newName": subfolderName+".json",
                                                        'success': function(newEntry){
                                                            console.log("The file was moved here "+newEntry.toURL());
                                                        },
                                                        'error': function(error){
                                                            console.error("There was an error with moving file "+fileEntry.toURL());
                                                        }
                                                    });
                                                });
                                            }
                                        });
                                    }
                                },
                                function() {
                                    console.error('Error downloading ' + assetName);
                                });
                        }else {
                            // TODO: Check the presense of the asset
                            console.debug('Associated asset: ' + assetName);
                        }
                    }
                }
            });
        });

        //radio and checkbox are the elements that might have pictures
        var imageTypeOptions = ["checkbox", "radio"];
        //download images that are part of the editor
        $.each(imageTypeOptions, function(index, type) {
            form.fields.find(function(element, index){
                if(element.type === type) {
                    element.properties.options.forEach(function(el, i) {
                        if("image" in el) {
                            var elementValue = el.image.src;
                            var options = {};
                            if (group === records.EDITOR_GROUP.PUBLIC) {
                                options.userId = pcapi.getAnonymousUserId();
                                options.localDir = records.getEditorsDir(records.EDITOR_GROUP.PUBLIC);
                            }
                            else {
                                options.userId = pcapi.getUserId();
                                options.localDir = records.getEditorsDir();
                            }
                            file.createDir({
                                'parent': options.localDir,
                                'name': editorFolder,
                                'success': function(dir){
                                    options.localDir = dir;
                                    console.log("folder " + options.localDir.toURL() + " was created");
                                }
                            });
                            options.remoteDir = "editors";
                            options.fileName = editorFolder+"/"+elementValue;
                            options.targetName = editorFolder+"/"+elementValue;
                            downloadItem(
                                options,
                                function() {
                                    console.debug('Asset ' + elementValue + ' downloaded');
                                },
                                function() {
                                    console.error('Error downloading ' + elementValue);
                                });
                        }
                    });
                }
            });
        });
    };

    /**
     * Wraps the pcapi call in a {Promise}
     *
     * @param itemsType {String} with the name of the objects to retrieve
     * @returns a {Promise} that resolves in usually an {Array} of {Objects}
     *     of the asked type
     */
    var fetchItems = function(itemsType) {
        var deferred = $.Deferred();

        var options = {
            remoteDir: itemsType
        };

        pcapi.getItems(options, function(success, items) {
            if (success) {
                deferred.resolve(items);
            }
            else {
                deferred.reject('Network error');
            }

        });

        return deferred.promise();
    };

    /**
     * Takes an {Array} of {Object} returned from the pcapi surveys call and
     * add some extra info for make it compatible with the addEditor function
     * @param items an {Array} of {Objects} where each item has:
     *     - metadata {Array} of {String} with the name of each survey
     *     - names {Array} of {String} with the alias of each survey
     * @returns {Array} an array of items each item is described by an options
     *     {Object} as expected for the downloadItem function:
     *     - fileName {String} the remote filename
     *     - remoteDir {String} the remote path
     *     - localDir {FileEntry} where the file will be stored
     *     - targetName {String} the local name for the file
     */
    var normalizeSurveys = function(items) {
        var surveys;
        var metadata = items.metadata || [];
        var localDir = records.getEditorsDir();
        var remoteDir = 'surveys';

        surveys = metadata.map(function(name) {
            return {
                fileName: name,
                remoteDir: remoteDir,
                localDir: localDir,
                targetName: name + '.edtr'
            };
        });

        return surveys;
    };

    // remove for the time being - waiting for pcapi changes
    records.addProcessEditor(downloadAssets);

return {

    /**
     * Download an editor and add it to the editors list
     * @param type name of editors group (records.EDITOR_GROUP)
     * @param editor Editor name
     */
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
            if(entry.name.indexOf(".json") > -1){
                records.addEditor(entry, type);
            }
        });
    },

    /**
     * Download the editors or surveys
     */
    downloadEditorsOrSurveys: downloadEditorsOrSurveys,

    /**
     * Download an item from an {Object} of options
     */
    downloadItem: downloadItem,

    /**
     * Download an {Array} of items from and {Array} of {Object} option
     */
    downloadItems: downloadItems,

    /**
     * Download an {Array} of surveys
     */
    downloadSurveys: downloadSurveys,

    /**
     * Download items from cloud provider.
     * @param localDir the local directory where things are downloaded
     * @param remoteDir the name of the remote directory
     * @param callback Function executed after sync is complete.
     */
    downloadEditors: function(localDir, remoteDir, callback) {
        var deferred = $.Deferred();

        utils.inform("Sync "+remoteDir+" ...");

        var downloads = [];
        //var userId = pcapi.getUserId();

        var finished = function(success){
            deferred.resolve(success);
            utils.doCallback(callback, success, downloads);
        };

        var downloadOptions = {
            "remoteDir": remoteDir
        };
        pcapi.getItems(downloadOptions, $.proxy(function(status, data){
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
                        this.downloadItem(options, function(entry) {
                            var promise;

                            if (entry.name.indexOf('.edtr') > -1 || entry.name.indexOf('.') === -1) {
                                promise = records.addEditor(entry, records.EDITOR_GROUP.PRIVATE);

                                ++count;
                                promise.done(function() {
                                    downloads.push(fileName);
                                });

                                promise.always(function() {
                                    if (count === noOfItems) {
                                        finished(true);
                                    }
                                });
                            }

                        });

                        //utils.printObj(data);
                    }, this));
                }
            }
        }, this));

        return deferred.promise();
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
            success: $.proxy(function(data){

                // If it has an error it's not a record
                if(data.error !== undefined){
                    console.error(data.msg);
                    finished({}, false);
                    return;
                }

                var record = data;

                // convert coordinates to national grid
                var coords = map.pointToInternal(record.geometry.coordinates);
                record.geometry.coordinates = [coords.lon, coords.lat];

                //  fetch assets and convert URLs
                $.each(record.properties.fields, $.proxy(function(i, field){
                    var type = records.typeFromId(field.id);
                    if(records.isAsset(field, type)){
                        ++assetCount;

                        var source = rootUrl + "/" + field.val;
                        var nameEnc = encodeURI(name);
                        var fieldValEnc = encodeURI(field.val);

                        var target = file.getFilePath(records.getAssetsDir(type)) +
                            "/" + nameEnc + "/" + fieldValEnc;

                        console.debug("download: " + source + " to " + target);

                        file.ftDownload(
                            source,
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
