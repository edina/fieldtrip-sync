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

define(['settings', 'utils', 'config', './login', './upload'], function(settings, utils, config, login, upload){
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
    var synUtils = {
        cloudProviderUrl: root + "/" + config["pcapi_version"] + "/pcapi",

        /**
         * Does this field define an asset?
         * @param field Annotation record field.
         * @param type Optional record type. If undefined it will be determied by the id.
         */
        isAsset: function(field, type) {
            var isAsset = false;

            if(type == undefined){
                type = this.typeFromId(field.id);
            }

            if(type === 'image' || type === 'audio' || type === 'track'){
                isAsset = true;
            }

            return isAsset;
        },

        /**
         * Get type of asset from field id.
         * @param id Field div id.
         * @return The control type for a field id.
         */
        typeFromId: function(id){
            var s = id.indexOf('-') + 1;
            return id.substr(s, id.lastIndexOf('-') - s);
        }
    }

    login.init(synUtils);
    login.checkLogin();
    upload.init(synUtils);

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
        $.proxy(upload.uploadRecords, upload)
    );

    $('head').prepend('<link rel="stylesheet" href="plugins/sync/css/style.css" type="text/css" />');
});
