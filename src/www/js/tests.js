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

/* global asyncTest */

define(['utils', './login', './upload', 'tests/systests'], function(// jshint ignore:line
    utils, login, upload, sts) {

return {

unit: {
    run: function(){
        module("Sync");
    }
},
sys:{
    run: function(){
        var loginCloud = function(cb){
            var allowStr = 'document.querySelector(\'input[name="allow_access"]\').click();';
            var loginStr = 'if(document.getElementById("login_email")){document.getElementById("login_email").value="george.hamilton@ed.ac.uk";document.getElementById("login_password").value="un5afe";document.querySelector(\'input[type="submit"]\').click();}else{}'; // jshint ignore:line

            login.loginCloud(
                function(){
                    console.debug("Logged into Dropbox");
                    cb();
                },
                function(cbrowser){
                    console.log("=>");
                    setTimeout(function(){
                        console.log(cbrowser);
                        cbrowser.executeScript(
                            {
                                code: loginStr
                            },
                            function(){
                                setTimeout(function(){
                                    cbrowser.executeScript(
                                        {
                                            code: allowStr
                                        },
                                        function(){}
                                    );
                                }, 3000); // wait for authorise page
                            }
                        );
                    }, 3000); // wait for child browser to load
                }
            );
        };

        module("Sync");
        console.log("Do sync " + utils.isMobileDevice());

        if(utils.isMobileDevice()){
            asyncTest("Test Sync", function(){

                loginCloud(function(){
                    console.log("logged in");
                // add new text record
                // sts.addRecord('test sync', function(newCount){
                //     console.log("add record");
                //     sts.goToRecordsPage(function(){
                //         // click on sync button
                //         $('#saved-annotations-page-header-login-sync').mousedown();

                //         intervalTest({
                //             'id': '#saved-annotations-page-header-login-sync',
                //             'poll': 1000,
                //             'delay': 1000,
                //             'test': function(){
                //                 return ($('#saved-annotation-sync-popup div').length > 0);
                //             },
                //             'cb': function(success){
                //                 ok(success, 'start sync');
                //                 //$('a.sync-confirm').click();
                //                 $('a.sync-confirm').mousedown();

                //                 // force close of popup
                //                 //$('#saved-annotation-sync-popup').popup('close');

                //                 intervalTest({
                //                     'id': 'sync-confirm',
                //                     'test': function(){
                //                         // sync is complete when cursor is saved
                //                         return that.storage.getCloudLogin().cursor !== undefined;
                //                     },
                //                     'cb': function(success){
                //                         ok(success, 'sync complete');
                //                         start();
                //                     },
                //                     'attempts': 1000,
                //                     'poll': 1000
                //                 })
                //             }
                //         });
                //     })
                //});
                });
            });
        }
    }
}

};

});
