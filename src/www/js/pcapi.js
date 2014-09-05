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
 * interface for the PCAPI
 */
define(['utils'], function(utils){

return {

    /**
     * Initialize pcapi object
     * @param options:
     *   url - URL of the PCAPI
     *   version - version number of PCAPI
     */
    init: function(options){
        this.cloudProviderUrl = options.url + "/" + options.version + "/pcapi";
    },

    /**
     * @return The URL to the cloud provider.
     */
    getCloudProviderUrl: function(){
        return this.cloudProviderUrl;
    },

    /**
     * Fetch all the items on the cloud
     * @param remoteDir remote directory
     * @param callback function after fetching the items
     */
    getItems: function(remoteDir, callback){
        var userId = "";
        if (this.getProvider() != "local") {
            userId = "/"+this.getUserId();
        }
        var url = this.getCloudProviderUrl() + '/fs/' +
            this.getProvider() + userId +'/' + remoteDir +'/';

        console.debug("Get items of "+remoteDir+" with " + url);

        $.ajax({
            type: "GET",
            dataType: "json",
            url: url,
            cache: false,
            success: function(data){
                if(data.error == 1){
                    callback(false);
                }
                else{
                    callback(true, data);
                }
            },
            error: function(jqXHR, status, error){
                console.error("Problem with " + url + " : status=" +
                              status + " : " + error);
                callback(false);
            }
        });
    },

    /**
     * Get all providers PCAPI supports
     * @param function called after fetching the providers
     */
    getProviders: function(callback){
        var url = this.getCloudProviderUrl()+"/auth/providers";
        $.ajax({
            url: url,
            dataType: "json",
            cache: false,
            success: function(data){
                callback(true, data);
            },
            error: function(jqXHR, status, error){
                console.error("Problem with " + url + " : status=" +
                              status + " : " + error);
                callback(false);
            }
        });
    },

    /**
     * TODO
     */
    getProvider: function(){
        return localStorage.getItem('cloud-provider');
    },

    /**
     * TODO
     */
    getUserId: function(){
        return this.userId;
    },

    /**
     * Set the cloud provider URL.
     * @param root The Server URL root.
     */
    setCloudProviderUrl: function(root) {
        this.cloudProviderUrl = root + "/" + utils.getPCAPIVersion() + "/pcapi";
    },

    /**
     * TODO
     */
    setProvider: function(provider){
        localStorage.setItem('cloud-provider', provider);
    },

    /**
     * TODO
     */
    setUserId: function(userId){
        this.userId = userId;
    }
};

});