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

/* global asyncTest, ok */

define(['utils', './pcapi', './upload', 'tests/systests'], function(// jshint ignore:line
    utils, login, upload, sts) {

return {

unit: {
    run: function(){
        module("Sync");
    }
},
sys:{
    run: function(){
        var user = utils.getCloudTestUser();
        var loginCloud = function(cb){
            var allowStr = 'document.querySelector(\'button[name="allow_access"]\').click();';
            var loginStr = 'if(document.getElementsByName("login_email").length > 0){document.getElementsByName("login_email")[1].value="' + user.name + '";document.getElementsByName("login_password")[1].value="' + user.pass + '";document.querySelector(\'button[type="submit"]\').click();}else{}'; // jshint ignore:line

            login.loginCloud(
                'dropbox',
                function(){
                    console.debug("Logged into Dropbox");
                    cb();
                },
                function(cbrowser){
                    setTimeout(function(){
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
                                        function(){
                                        });
                                }, 3000); // wait for authorise page
                            });
                    }, 3000); // wait for child browser to load
                });
        };

        module("Sync");

        if(utils.isMobileDevice()){
            /* Sync disabled: view edina/fieldtrip-gb#76
            asyncTest("Test Sync", function(){
                // ensure used is logged out
                login.logoutCloud();

                loginCloud(function(){
                    // add new text record
                    sts.addRecord('test sync', function(newCount){
                        sts.goToRecordsPage(function(){
                            // click on sync button
                            $('#saved-records-page-header-login-sync').mousedown();

                            sts.intervalTest({
                                'id': '#saved-records-page-header-login-sync',
                                'poll': 1000,
                                'delay': 1000,
                                'test': function(){
                                    return ($('#saved-records-sync-popup div').length > 0);
                                },
                                'cb': function(success){
                                    ok(success, 'start sync');
                                    $('a.sync-confirm').mousedown();

                                    sts.intervalTest({
                                        'id': 'sync-confirm',
                                        'test': function(){
                                            // sync is complete when cursor is saved
                                            return login.getUser().cursor !== undefined;
                                        },
                                        'cb': function(success){
                                            ok(success, 'sync complete');
                                            sts.complete();
                                        },
                                        'attempts': 1000,
                                        'poll': 1000
                                    });
                                }
                            });
                        });
                    });
                });
            });
            */

            /*
                Feature: Upload records
                    In order to save the records capture
                    as a user
                    I want to login into my storage provider
                    And upload the records that I capture
                    And logout from my storage.
                Scenario: Upload
                    Given that the user is in the records page
                    And its logged in
                    When the user clicks the upload button
                    Then his records are uploaded to the PCAPI

                Scenario: Logout
                    Given that the user is logged in
                    When the user click the logout button
                    Then the user is logged out from the PCAPI
            */
            asyncTest("Test Upload Records", function(){
                // ensure used is logged out
                login.logoutCloud();

                // Login the user
                loginCloud(function(){
                    // add new text record
                    sts.addRecord('test sync', function(newCount){
                        // Go to the records page
                        sts.goToRecordsPage(function(){
                            // Click the upload button
                            sts.clickAndTest({
                                'id': '.sync-upload-button',
                                'poll': 2000,
                                'delay': 1000,
                                'attempts': 20, // Total 20 * 2000 = 40 seg
                                'test': function(){
                                    // Assert that the upload is done
                                    var $failed = $('#saved-records-list-list > li .saved-records-list-synced-false');
                                    var $syncing = $('#saved-records-list-list > li .saved-records-list-syncing');
                                    var total = $failed.length + $syncing.length;

                                    return total === 0;
                                },
                                'cb': function(success){
                                    ok(success, 'Upload records');
                                    sts.complete();
                                }
                            });
                        });
                    });
                });
            });

            asyncTest("Test Logout", function(){
                var doTest = function(){
                    // Click the logout button
                    sts.clickAndTest({
                        'id': '#home-content-login a',
                        'test':function(){
                            // Assert that the user has been logged out
                            if($('#home-content-login p').text() === 'Login'){
                                return true;
                            }
                        },
                        'cb': function(success){
                            ok(success, 'Logged of dropbox');
                            sts.complete();
                        }
                    });

                };

                sts.goHome(function(){
                    if($('#home-content-login p').text() === 'Login'){
                        // Login the user
                        login.loginCloud(function(){
                            doTest();
                        });
                    }
                    else{
                        doTest();
                    }
                });
            });
        }
    }
}

};

});
