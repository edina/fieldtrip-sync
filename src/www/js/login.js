define(['utils'], function(utils){
    var $loginDiv = $('#home-content-login'),
    homepageDisplay,
    cloudProviderUrl;

    var setCloudLogin = function(userId){
        localStorage.setItem('cloud-user', JSON.stringify({'id': userId}));
    };

    var getCloudLogin = function(){
        return JSON.parse(localStorage.getItem('cloud-user'));
    };

    var clearCloudLogin = function(){
        localStorage.setItem('cloud-user', JSON.stringify({'id': undefined}));
    };

    var initLoginButton = function(){
        var FIELDTRIPGB_NEWS_FEED_URL = utils.getServerUrl() + "/splash.html";

        return {
            hideSyncAndShowLogin: function(){
                $('#home-content-sync').hide();
                $('#home-content-upload').hide();

                //Bug 5997 have to use full url due to jqm issue
                $('#home-content-login img').attr('src',  utils.getDocumentBase() + 'theme/css/images/login-large.png');
                $('#home-content-login p').text('Login');
            },
    
            showLogoutAndSync: function(){
    
                //Bug 5997 have to use full url due to jqm issue
                $('#home-content-login img').attr('src',  utils.getDocumentBase() + 'theme/css/images/logout.png');
                $('#home-content-login p').text('Logout');
    
                //show sync button
                $('#home-content-sync').show();
                $('#home-content-upload').show();
            },
            getNewsFeed: function(selector){
    
                $.ajax({url:FIELDTRIPGB_NEWS_FEED_URL, success:function(result) {
                    if (result) {
                       $(selector).html(result);
                    };
                }, cache: false});

            }

        };
    };
    
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
                    console.log("skata")
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
        "init": function(url){
            console.log(url)
            cloudProviderUrl = url;
            setCloudLogin();
            homepageDisplay = new initLoginButton();
        },
        "loginCloud": function(){
            console.log(cloudProviderUrl)
            var icon = $loginDiv.find('img').attr('src');
            icon = icon.substr(icon.lastIndexOf('/') + 1);

            if(icon === 'login-large.png'){
                doLogin($.proxy(function(){
                    $.mobile.hidePageLoadingMsg();
                    var userId = getCloudLogin().id;
                    if(userId){
                        homepageDisplay.showLogoutAndSync();
                    }
                }, this));
            }
            else {
                this.logoutCloud();
            }
        },
        "logoutCloud": function(){
            clearCloudLogin();
            homepageDisplay.hideSyncAndShowLogin();
        }
    };
});