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
 * TODO
 */
define(['utils'], function(utils){
    var $loginDiv = $('#home-content-login');
    var cloudProviderUrl;

    /**
     * TODO
     */
    var setCloudLogin = function(userId){
        localStorage.setItem('cloud-user', JSON.stringify({'id': userId}));
    };

    /**
     * TODO
     */
    var getCloudLogin = function(){
        return JSON.parse(localStorage.getItem('cloud-user'));
    };

    /**
     * TODO
     */
    var clearCloudLogin = function(){
        localStorage.setItem('cloud-user', JSON.stringify({'id': undefined}));
    };

    /**
     * TODO
     */
    var hideSyncAndShowLogin = function(){
        $('#home-content-sync').hide();
        $('#home-content-upload').hide();

        // Bug 5997 have to use full url due to jqm issue
        $('#home-content-login img').attr(
            'src',
            utils.getDocumentBase() + 'plugins/sync/css/images/login-large.png');
        $('#home-content-login p').text('Login');
    };

    /**
     * TODO
     */
    var doLogin = function(callback, cbrowser){
        var loginUrl = cloudProviderUrl + '/auth/dropbox';

        var pollTimer, pollTimerCount = 0, pollInterval = 3000, pollForMax = 5 * 60 * 1000; //min

        var userId = getCloudLogin().id
        if(userId != undefined){
            console.debug("got a user id: " + userId);
            loginUrl += '/' + userId;
        }

        // clear user id
        clearCloudLogin();
        console.debug('Login with: ' + loginUrl + '?async=true');

        $.ajax({
            url: loginUrl + '?async=true',
            timeout: 3000,
            cache: false,
            success: $.proxy(function(data){
                console.debug("Redirect to: " + data.url);
                var cloudUserId = data.userid;

                // close child browser
                var closeCb = function(){
                    clearInterval(pollTimer);
                    callback();
                }

                // open dropbox login in child browser
                var cb = window.open(data.url, '_blank', 'location=no');
                //cb.addEventListener('exit', closeCb);

                var pollUrl = loginUrl + '/' + cloudUserId + '?async=true';
                console.debug('Poll: ' + pollUrl);
                pollTimer = setInterval(function(){
                    $.ajax({
                        url: pollUrl,
                        success: function(pollData){
                            pollTimerCount += pollInterval;

                            if(pollData.state === 1 || pollTimerCount > pollForMax){
                                if(pollData.state === 1 ){
                                    setCloudLogin(cloudUserId);
                                }
                                cb.close();
                                closeCb();
                            }

                        },
                        error: function(error){
                            console.error("Problem polling api: " + error.statusText);
                            closeCb();
                        },
                        cache: false
                    });
                }, pollInterval);

                if(cbrowser){
                    // caller may want access to child browser reference
                    cbrowser(cb);
                }
            }, this),
            error: function(jqXHR, textStatus){
                var msg;
                if(textStatus === undefined){
                    textStatus = ' Unspecified Error.'
                }
                else if(textStatus === "timeout") {
                    msg = "Unable to login, please enable data connection.";
                }
                else{
                    msg = "Problem with login: " + textStatus;
                }

                utils.printObj(jqXHR);
                console.error(msg);
                utils.inform(msg);
            }
        });
    };

return {

    /**
     * TODO
     */
    init: function(url){
        cloudProviderUrl = url;
    },

    /**
     * Check if users session is valid.
     */
    checkLogin: function(){
        console.log("=> " + this.userId);
        if(!this.userId){
            var userId = getCloudLogin().id;
            if(userId){
                var url = cloudProviderUrl + '/auth/dropbox/' + userId;
                console.debug("Check user with: " + url);
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: url,
                    cache: false,
                    success: $.proxy(function(data){
                        if(data.state === 1){
                            this.userId = userId;
                        }

                        //callback(data.state);
                        this.showLogoutAndSync();
                    }, this),
                    error: function(error){
                        console.error("Error with user: " + url + " : " + error.msg);
                        login.logoutCloud();
                    }
                });
            }
            else{
                console.debug("No user session saved");
                login.logoutCloud();
            }
        }
        else{
            this.showLogoutAndSync();
        }
    },

    /**
     * TODO
     */
    loginCloud: function(url){
        var icon = $loginDiv.find('img').attr('src');
        icon = icon.substr(icon.lastIndexOf('/') + 1);

        if(icon === 'login-large.png'){
            doLogin($.proxy(function(){
                $.mobile.hidePageLoadingMsg();
                var userId = getCloudLogin().id;
                if(userId){
                    this.showLogoutAndSync();
                }
            }, this));
        }
        else {
            this.logoutCloud();
        }
    },

    /**
     * TODO
     */
    logoutCloud: function(){
        clearCloudLogin();
        hideSyncAndShowLogin();
    },

    /**
     * TODO
     */
    showLogoutAndSync: function(){
        // Bug 5997 have to use full url due to jqm issue
        $('#home-content-login img').attr(
            'src',
            utils.getDocumentBase() + 'plugins/sync/css/images/logout.png');
        $('#home-content-login p').text('Logout');

        // show sync button
        $('#home-content-sync').show();
        $('#home-content-upload').show();
    },

}

});
