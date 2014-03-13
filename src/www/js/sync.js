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

define(['settings', 'utils', 'config', './login'], function(settings, utils, config, login){
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

    var cloudProviderUrl = root + "/" + config["pcapi_version"] + "/pcapi";

    login.init(cloudProviderUrl);
    login.checkLogin();

    // TODO - what about unknown pages (e.g download)
    $(document).on('pageshow', '#home-page', function(event){
        login.checkLogin();
    });

    $(document).on('vclick', '#home-content-login', function(){
        login.loginCloud(cloudProviderUrl);
    });

    $(document).on('vclick', '#home-content-upload', function(){
        upload.loginRecords();
    });
});