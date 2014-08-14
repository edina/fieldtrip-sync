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
define(['utils', './pcapi'], function(utils, pcapi){
    /**
     * Get the cloud login from local storage.
     */
    var getCloudLogin = function(){
        var login = null;
        var user = localStorage.getItem('cloud-user');
        if(user){
            login = JSON.parse(user);
        }

        return login;
    };

    /**
     * Get the cloud login id from local storage.
     */
    var getCloudLoginId = function(){
        var id;
        var login = JSON.parse(localStorage.getItem('cloud-user'));
        if(login){
            id = login.id;
        }

        return id;
    };

    /**
     * Unset user login id.
     */
    var clearCloudLogin = function(){
        localStorage.setItem('cloud-user', JSON.stringify({'id': undefined}));
    };

    /**
     * Login to cloud provider.
     * @param callback Function called after login attemt.
     * @param cbrowser Function to allow caller requires access to childbrowser.
     */
    var doLogin = function(provider, callback, cbrowser){
        var loginUrl = _this.syncUtils.getCloudProviderUrl() + '/auth/'+provider;
        if (provider === 'local') {
            $('#login-form').toggle();
            $(document).off('vmousedown', '#local-login');
            $(document).on('vmousedown', '#local-login', function(event){
                loginUrl += '/' + $("#login-username").val();
                console.debug('Login with: ' + loginUrl + '?async=true');

                $.ajax({
                    url: loginUrl + '?async=true',
                    timeout: 3000,
                    cache: false,
                    success: function(data){
                        console.debug("Redirect to: " + data.url);
                        var cloudUserId = data.userid;
                        _this.setCloudLogin(cloudUserId);
                        callback(cloudUserId);
                    }
                });
            });
        }
        else{

            var pollTimer, pollTimerCount = 0, pollInterval = 3000, pollForMax = 5 * 60 * 1000; //min

            var userId = getCloudLoginId();
            if(userId !== undefined){
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
                success: function(data){
                    console.debug("Redirect to: " + data.url);
                    var cloudUserId = data.userid;

                    // close child browser
                    var closeCb = function(userId){
                        clearInterval(pollTimer);
                        callback(userId);
                    };

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
                                        _this.setCloudLogin(cloudUserId);
                                    }
                                    cb.close();
                                    closeCb(cloudUserId);
                                }
                            },
                            error: function(error){
                                console.error("Problem polling api: " + error.statusText);
                                closeCb(-1);
                            },
                            cache: false
                        });
                    }, pollInterval);

                    if(cbrowser){
                        // caller may want access to child browser reference
                        cbrowser(cb);
                    }
                },
                error: function(jqXHR, textStatus){
                    var msg;
                    if(textStatus === undefined){
                        textStatus = ' Unspecified Error.';
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
        }
    };

var _this = {

    /**
     * Initialise this module.
     * @param syncUtils Sync utility object.
     */
    init: function(syncUtils){
        this.syncUtils = syncUtils;
    },

    /**
     * Check if users session is valid.
     * @param TODO
     */
    checkLogin: function(callback){
        if(!this.userId){
            var user = getCloudLogin();
            if(user !== null && user.id){
                var url = this.syncUtils.getCloudProviderUrl() + '/auth/'+pcapi.getProvider()+'/' + user.id;
                console.debug("Check user with: " + url);
                $.ajax({
                    type: 'GET',
                    dataType: 'json',
                    url: url,
                    cache: false,
                    success: $.proxy(function(data){
                        if(data.state === 1){
                            this.setCloudLogin(user.id, user.cursor);
                        }

                        callback(user.id);
                    }, this),
                    error: $.proxy(function(error){
                        console.error("Error with user: " + url + " : " + error.msg);
                        this.logoutCloud();
                    }, this)
                });
            }
            else{
                console.debug("No user session saved");
                this.logoutCloud();
            }
        }
        else{
            callback(this.userId);
        }
    },

    /**
     * @return The cloud login user.
     *   id - cloud user id
     *   cursor - cursor of last sync.
     */
    getUser: function(){
        return this.user;
    },

    /**
     * Login to cloud provider.
     */
    loginCloud: function(provider, cb, cbrowser){
        doLogin(provider, cb, cbrowser);
    },

    /**
     * Login to cloud provider.
     */
    logoutCloud: function(){
        this.user = undefined;
        clearCloudLogin();
    },

    /**
     * Store cloud user id in local storage.
     */
    setCloudLogin: function(userId, cursor){
        this.user = {
            'id': userId,
            'cursor': cursor
        };

        localStorage.setItem('cloud-user', JSON.stringify(this.user));
    }
};

return _this;

});
