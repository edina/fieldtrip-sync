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

define(['records', 'map', 'settings', 'utils', 'config', './login', './upload', './download'], function(records, map, settings, utils, config, login, upload, download){
    var root;
    if(utils.isMobileDevice()){
        root = config["pcapi_url"];
    }
    else{
        root = 'http://' + location.hostname;
        if(location.port){
            root += ':' + location.port
        }
    }

    // some common sync utilities
    var syncUtils = {
        cloudProviderUrl: root + "/" + config.pcapi_version + "/pcapi",

        /**
         * Does this field define an asset?
         * @param field Annotation record field.
         * @param type Optional record type. If undefined it will be determied by the id.
         */
        isAsset: function(field, type) {
            var isAsset = false;

            if(type == undefined){
                type = records.typeFromId(field.id);
            }

            if(type === 'image' || type === 'audio' || type === 'track'){
                isAsset = true;
            }

            return isAsset;
        },
    };

    /**
     * Sync device with cloud.
     * @param div - The div to append confirmation popup.
     * @param options:
     *   callback - A function that will be executed for each annotation created
     *     or deleted as part of the sync.
     *   complete - A function that will be executed when sync is complete.
     */
    var sync = function(options){
        // to avoid duplication add pop up dynamically
        $('#' + options.div).empty();
        $('#' + options.div).append(
            '<div data-theme="d" class="ui-corner-all ui-content">\
               <p>All records and forms will be downloaded and all local records will be uploaded (since last sync). To upload records only, use upload button.\
               </p>\
               <a href="#"\
                  data-theme="a"\
                  data-role="button"\
                  data-inline="true"\
                  data-rel="back">Cancel</a>\
               <a class="sync-confirm"\
                  data-theme="a"\
                  href="#"\
                  data-role="button"\
                  data-inline="true">Continue</a>\
             </div>').trigger('create');

        $(document).off('vmousedown', '.sync-confirm');
        $(document).on(
            'vmousedown',
            '.sync-confirm',
            function(event){
                event.preventDefault();
                $('#' + options.div).popup('close');

                // upload unsynced records
                var doUpload = function(){
                    upload.uploadRecords(function(){
                        syncStoreCursor();
                        map.refreshRecords();
                        $.mobile.hidePageLoadingMsg();

                        if(options.complete){
                            options.complete();
                        }
                    });
                };

                // sync uploaded records with dropbox
                if(login.getUserCursor() === undefined){
                    // no cursor found do a full sync
                    download.downloadEditors(function(success){
                        if(success){
                            download.downloadRecords(doUpload, options.callback);
                        }
                        else{
                            $.mobile.hidePageLoadingMsg();
                            utils.inform("Problem syncing editors.");
                        }
                    });
                }
                else{
                    // sync using cursor
                    syncWithCursor(
                        function(success){
                            if(success){
                                doUpload();
                            }
                            else{
                                $.mobile.hidePageLoadingMsg();
                                utils.inform("Problem syncing with cursor.");
                            }
                        },
                        options.callback
                    );
                }
            }
        );

        // timeout allows popup to stay visible on the saved records page on all
        // devices see https://redmine.edina.ac.uk/issues/8228
        setTimeout(function(){
            $('#' + options.div).popup('open');
        }, 750);
    };

    /**
     * Store current dropbox state cursor with cloud login details.
     */
    var syncStoreCursor = function(){
        var userId = login.getUserId();
        //var user = this.db.getCloudLogin();
        var url = syncUtils.cloudProviderUrl + '/sync/dropbox/' + userId;
        $.ajax({
            type: "GET",
            dataType: "json",
            url: url,
            success: function(data){
                console.debug("Save cursor: " + data.cursor);
                login.setCloudLogin(userId, data.cursor);
            },
            error: function(jqXHR, status, error){
                console.error("syncStoreCursor: Problem fetching cursor " + url +
                              " : " + status + " : " + error);
            },
            cache: false
        });
    };

    /**
     * Sync records and editors.
     * @param complete Function executed when sync is complete.
     * @param callback Function executed each time an annotation is added or deleted.
     */
    var syncWithCursor = function(complete, callback) {
        var user = login.getUser();

        // track asynchronous jobs
        var jobs = 0;
        var finished = function(){
            --jobs;
            if(jobs === 0){
                complete(true);
            }
        };

        // retrieve file type and value
        var getDetails = function(path){
            var val;
            var start = path.indexOf('/', 1) + 1;
            var end = path.indexOf('/', start);
            if(end === -1){
                // no end slash its a directory
                val = path.substr(start);
            }
            else{
                val = path.substr(start, end - start);
            }

            return {
                'type': path.substr(1, 7),
                'val': val
            }
        };

        // sync records
        var url = syncUtils.cloudProviderUrl + '/sync/dropbox/' +
            user.id + "/" + user.cursor;
        console.debug("Sync download with cursor: " + url);

        $.ajax({
            type: "GET",
            dataType: "json",
            url: url,
            success: function(data){
                utils.printObj(data);
                var rList = [];

                // deleted records and editors
                $.each(data.deleted, function(i, path){
                    var details = getDetails(path);
                    if(details.type === 'records'){
                        if($.inArray(details.val, rList) === -1){
                            var id = records.deleteAnnotationByName(details.val);
                            if(callback){
                                callback(false, id);
                            }
                            rList.push(details.val);
                        }
                    }
                    else if(details.type === 'editors'){
                        records.deleteEditor(details.val);
                    }
                    else{
                        console.warn("No such record type: " + details.type);
                    }
                });

                rList = [];

                // updated records and editors
                $.each(data.updated, function(i, path){
                    var details = getDetails(path);
                    if(details.type === 'records'){
                        // a record update could be the directory, the record json
                        // and assets, this check ensures that the record is only
                        // fetched once
                        if($.inArray(details.val, rList) === -1){
                            // just download the record and assets
                            var record = this.getAnnotationDetails(details.val);
                            ++jobs;
                            rList.push(details.val);
                            download.downloadRecord(
                                details.val,
                                function(success, id, annotation){
                                    if(success && record === undefined && callback){
                                        // record undefined means a new record has been
                                        // downloaded, perhaps as a rename
                                        callback(true, id, annotation);
                                    }

                                    finished();
                                },
                                record
                            );
                        }
                    }
                    else if(details.type === 'editors'){
                        ++jobs;
                        download.downloadEditor(details.val, function(){
                            finished();
                        });
                    }
                    else{
                        console.warn("No such record type:" + details.type);
                    }
                });

                if(jobs === 0){
                    complete(true);
                }
            },
            error: function(jqXHR, status, error){
                console.error("SyncWithCursor: Problem fetching " + url + " : " +
                              status + " : " + error);
                complete(false);
            },
            cache: false
        });
    };

    login.init(syncUtils);
    login.checkLogin();
    upload.init(syncUtils);
    download.init(syncUtils);

    // listen on home page
    $(document).on('pageshow', '#home-page', function(event){
        login.checkLogin();
    });

    // listen on any page with class sync-page
    $(document).on('pageshow', '.sync-page', function(event){
        login.checkLogin();
    });

    $(document).on('vclick', '#home-content-login', function(){
        login.loginCloud();
    });

    $(document).on(
        'vclick',
        '.sync-upload-button',
        function(event){
            event.preventDefault();
            utils.showPageLoadingMsg('Upload Records ...');
            upload.uploadRecords(function(){
                $.mobile.hidePageLoadingMsg();
                $.mobile.changePage("saved-records.html");
            });
        }
    );
    $(document).on(
        'vclick',
        '.sync-download-button',
        function(){
            utils.showPageLoadingMsg('Download Editors ...');
            download.downloadEditors(function(){
                $.mobile.hidePageLoadingMsg();
                $.mobile.changePage('capture.html');
            });
        }
    );
    $(document).on(
        'vclick',
        '#home-content-sync',
        function(event){
            //event.preventDefault();
            sync({
                div: 'home-sync-popup',
                complete: function(){
                    $.mobile.changePage('capture.html')
                }
            });
        }
    );

    $('head').prepend('<link rel="stylesheet" href="plugins/sync/css/style.css" type="text/css" />');
});
