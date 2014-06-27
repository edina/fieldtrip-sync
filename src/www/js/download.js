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
define(['records', 'map', 'utils', './login'],
       function(records, map, utils, login){ // jshint ignore:line

return {

    /**
     * Initialise upload module.
     * @param syncUtils common sync utilities.
     */
    init: function(syncUtils){
        this.syncUtils = syncUtils;
    },

    /**
     * Download item from cloud provider.
     * @param options.fileName the name of item
     * @param options.remoteDir the name of the directory on the server
     * @param options.localDir the local directory where the item will be downloaded.
     * @param callback Function will be called when editor is successfully downloaded.
     */
    downloadItem: function(options, callback){
        var userId = login.getUser().id;
        var root = this.syncUtils.getCloudProviderUrl() + '/fs/dropbox/' + userId;
        var itemUrl = root + "/"+ options.remoteDir +"/" + options.fileName;
        console.log("downloading "+itemUrl);

        var target = utils.getFilePath(options.localDir)+'/'+options.fileName

        utils.fileTransfer(itemUrl, target, function(success){
            if(success){
                callback();
            }
        });

    },

    /**
     * Download editors from cloud provider.
     * @param callback Function executed after sync is complete.
     */
    downloadEditors: function(callback) {
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
        var userId = login.getUser().id;

        var finished = function(success){
            if(callback){
                callback(success);
            }
        };

        utils.deleteAllFilesFromDir(localDir, remoteDir, $.proxy(function(){
            var url = this.syncUtils.getCloudProviderUrl() + '/'+remoteDir+'/dropbox/' +
                userId +'/';

            console.debug("Sync "+remoteDir+" with " + url);

            $.ajax({
                type: "GET",
                dataType: "json",
                url: url,
                success: $.proxy(function(data){
                    if(data.error === 1 || data.metadata.length === 0){
                        // nothing to do
                        utils.inform('No editors to sync');
                        finished(true);
                    }
                    else{
                        var count = 0;
                        var noOfItems = data.metadata.length;

                        //utils.printObj(data.metadata);

                        // do sync
                        $.each(data.metadata, $.proxy(function(i, item){
                            // TODO work would correct filename and path
                            var fileName = item.substring(item.lastIndexOf('/') + 1, item.length);
                            var options = {"fileName": fileName, "remoteDir": remoteDir, "localDir": localDir};
                            this.downloadItem(options, function(){
                                ++count;
                                if(count === noOfItems){
                                    finished(true);
                                }
                            });

                            //utils.printObj(data);
                        }, this));
                    }
                }, this),
                error: function(jqXHR, status, error){
                    console.error("Problem with " + url + " : status=" +
                                  status + " : " + error);
                    finished(false);
                },
                cache: false
            });
        }, this));
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
        var userId = login.getUser().id;

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

        var recordsDir = this.syncUtils.getCloudProviderUrl() +
            '/records/dropbox/' + userId + "/";
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
                    $.mobile.showPageLoadingMsg();
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
                    $.mobile.hidePageLoadingMsg();
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
        var rootUrl = this.syncUtils.getCloudProviderUrl() + '/records/dropbox/' +
            login.getUser().id + "/" + name;
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
                record.point = map.pointToInternal(record.point);

                //  fetch assets and convert URLs
                $.each(record.fields, $.proxy(function(i, field){
                    if(this.syncUtils.isAsset(field)){
                        ++assetCount;

                        var source = rootUrl + "/" + field.val;
                        var target = utils.getFilePath(records.getAssetsDir()) + "/" +
                            name + "/" + field.val;

                        console.debug("download: " + source + " to " + target);

                        //TO-DO integrate this with the utils.fileTransfer function
                        new FileTransfer().download(
                            encodeURI(source),
                            target,
                            function(entry) {
                                console.debug("download complete: " + utils.getFilePath(entry));

                                // asset local path becomes new record field val
                                field.val = utils.getFilePath(entry);

                                finished(record, true);
                            },
                            function(error) {
                                // if this fails first check whitelist in cordova.xml
                                utils.informError("Problem syncing " + name);
                                console.error("Problem downloading asset: " + error.source +
                                              " to: " + error.target +
                                              " error: " + utils.getFileTransferErrorMsg(error) +
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
    }
};

});
